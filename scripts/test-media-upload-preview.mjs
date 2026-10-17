import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";
import { createApp } from "../dist/app.js";
import { pool } from "../dist/db/pool.js";

const publicDirectory = path.resolve(process.cwd(), "public");
const documentsDirectory = path.join(publicDirectory, "uploads", "documents");
const legacyFileName = `media-preview-legacy-${process.pid}.png`;
const legacyFilePath = path.join(documentsDirectory, legacyFileName);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" fill="#0866ff"/></svg>`;
let uploadedFileId = "";
let uploadedFilePath = "";
let server;
let browser;
let socket;
let profileDirectory = "";
const pendingCommands = new Map();
let commandId = 0;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function sendBrowserCommand(method, params = {}) {
  const id = ++commandId;
  return new Promise((resolve, reject) => {
    pendingCommands.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluateInBrowser(expression) {
  const response = await sendBrowserCommand("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) {
    const detail = response.exceptionDetails.exception?.description
      || response.exceptionDetails.exception?.value
      || response.exceptionDetails.text
      || "Browser evaluation failed.";
    throw new Error(String(detail));
  }
  return response.result?.value;
}

async function pollBrowser(expression, timeoutMs = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluateInBrowser(expression)) return true;
    await wait(100);
  }
  return false;
}

async function connectTestBrowser() {
  const browserCandidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium"
  ].filter(Boolean);
  const browserPath = browserCandidates.find(existsSync);
  assert.ok(browserPath, "Chrome or Edge is required for the media preview browser test.");
  profileDirectory = mkdtempSync(path.join(tmpdir(), "zigo-media-preview-"));
  browser = spawn(browserPath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDirectory}`,
    "about:blank"
  ], { stdio: "ignore", windowsHide: true });

  const portFile = path.join(profileDirectory, "DevToolsActivePort");
  for (let attempt = 0; attempt < 100 && !existsSync(portFile); attempt += 1) {
    if (browser.exitCode != null) throw new Error("Headless browser exited before opening the debugging port.");
    await wait(50);
  }
  assert.equal(existsSync(portFile), true, "Timed out waiting for the headless browser debugging port.");
  const port = Number(readFileSync(portFile, "utf8").split(/\r?\n/)[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((entry) => entry.type === "page");
  assert.ok(target?.webSocketDebuggerUrl, "Headless browser page target was not available.");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pendingCommands.has(message.id)) return;
    const entry = pendingCommands.get(message.id);
    pendingCommands.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result || {});
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  await sendBrowserCommand("Runtime.enable");
  await sendBrowserCommand("Page.enable");
}

try {
  mkdirSync(documentsDirectory, { recursive: true });
  writeFileSync(legacyFilePath, svg, "utf8");

  const user = (await pool.query(`
    select u.id
    from zigo.users u
    join zigo.customers c on c.user_id = u.id
    where u.deleted_at is null
      and coalesce(u.metadata->>'accountStatus', 'active') = 'active'
    order by u.updated_at desc
    limit 1
  `)).rows[0];
  assert.ok(user?.id, "An active customer is required for the media upload preview test.");

  const secret = process.env.JWT_SECRET || "zigo-development-secret";
  const accessToken = jwt.sign(
    { sub: user.id, app: "customer_portal", roles: ["customer"], tokenType: "access" },
    secret,
    { expiresIn: "15m" }
  );

  const app = createApp();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object", "Media test server did not start.");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const legacyResponse = await fetch(`${baseUrl}/uploads/documents/${legacyFileName}`);
  assert.equal(legacyResponse.status, 200, "Legacy mismatched attachment was not served.");
  assert.match(legacyResponse.headers.get("content-type") || "", /^image\/svg\+xml/i);
  assert.equal(legacyResponse.headers.get("cache-control"), "no-store");
  assert.match(legacyResponse.headers.get("content-security-policy") || "", /sandbox/i);

  const uploadResponse = await fetch(`${baseUrl}/portal/task-media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      originalName: "booking-image.png",
      mimeType: "image/png",
      dataBase64: `data:image/png;base64,${Buffer.from(svg).toString("base64")}`,
      context: "booking"
    })
  });
  const uploadPayload = await uploadResponse.json();
  assert.equal(uploadResponse.status, 201, JSON.stringify(uploadPayload));
  assert.match(uploadPayload.data.previewUrl, /^\/uploads\/documents\/.+\.svg$/i);
  uploadedFileId = String(uploadPayload.data.fileId || "");
  uploadedFilePath = path.resolve(publicDirectory, `.${uploadPayload.data.previewUrl}`);
  assert.ok(uploadedFilePath.startsWith(`${documentsDirectory}${path.sep}`), "Uploaded media escaped the public documents directory.");
  assert.equal(existsSync(uploadedFilePath), true, "Uploaded media was not written to the served public directory.");

  const previewResponse = await fetch(`${baseUrl}${uploadPayload.data.previewUrl}`);
  assert.equal(previewResponse.status, 200, "New attachment preview was not served.");
  assert.match(previewResponse.headers.get("content-type") || "", /^image\/svg\+xml/i);
  assert.equal(await previewResponse.text(), svg);

  await connectTestBrowser();
  await sendBrowserCommand("Page.navigate", { url: `${baseUrl}/customer` });
  assert.equal(
    await pollBrowser("document.readyState === 'complete' && typeof assetUrl === 'function' && typeof normalizePortalUploadFile === 'function'"),
    true,
    "Customer portal media helpers did not load."
  );
  const clientResult = await evaluateInBrowser(`(async () => {
    const svgText = ${JSON.stringify(svg)};
    const disguisedFile = new File([svgText], 'customer-image.png', { type: 'image/png', lastModified: 123 });
    const normalizedFile = await normalizePortalUploadFile(disguisedFile);
    const previewUrl = URL.createObjectURL(normalizedFile);
    const localPreview = await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ loaded: true, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ loaded: false, width: 0, height: 0 });
      image.src = previewUrl;
    });
    URL.revokeObjectURL(previewUrl);
    const storedPreview = await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ loaded: true, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ loaded: false, width: 0, height: 0 });
      image.src = assetUrl(${JSON.stringify(`/uploads/documents/${legacyFileName}`)});
    });
    return {
      normalizedName: normalizedFile.name,
      normalizedType: normalizedFile.type,
      localPreview,
      storedPreview,
      rootUpload: assetUrl('/uploads/documents/example.png'),
      localAbsoluteUpload: assetUrl('http://localhost:4003/admin/uploads/documents/example.png'),
      liveAbsoluteUpload: assetUrl('https://zigonow.in/admin/uploads/documents/example.png'),
      windowsUpload: assetUrl(${JSON.stringify("C:\\server\\app\\public\\uploads\\documents\\example.png")}),
      externalUpload: assetUrl('https://cdn.example.com/uploads/example.png')
    };
  })()`);
  const expectedRootUpload = "/uploads/documents/example.png?zv=attachment-preview-20261013";
  assert.deepEqual(clientResult, {
    normalizedName: "customer-image.svg",
    normalizedType: "image/svg+xml",
    localPreview: { loaded: true, width: 24, height: 24 },
    storedPreview: { loaded: true, width: 24, height: 24 },
    rootUpload: expectedRootUpload,
    localAbsoluteUpload: expectedRootUpload,
    liveAbsoluteUpload: expectedRootUpload,
    windowsUpload: expectedRootUpload,
    externalUpload: "https://cdn.example.com/uploads/example.png"
  });

  const routeResult = await evaluateInBrowser(`(() => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:0;top:0;width:390px;opacity:0;pointer-events:none;z-index:-1";
    host.innerHTML = '<section class="customer-track-page">' + customerTrackLocationsHtml({ locations: [
      { label: "Start", address: "Start address", latitude: 28.451, longitude: 77.101 },
      { label: "Middle", address: "A deliberately longer middle-stop address that wraps without moving the navigation action", latitude: 28.452, longitude: 77.102 },
      { label: "End", address: "End address", latitude: 28.453, longitude: 77.103 }
    ] }) + "</section>";
    const hadCustomerClass = document.body.classList.contains("portal-customer");
    document.body.classList.add("portal-customer");
    document.body.append(host);

    const round = (value) => Math.round(value * 10) / 10;
    const rows = [...host.querySelectorAll(".customer-track-location-row-static")];
    const result = {
      classes: rows.map((row) => ["start", "middle", "end"].find((name) => row.classList.contains(name))),
      colors: rows.map((row) => getComputedStyle(row.querySelector(".customer-track-location-pin")).color),
      pinCenters: rows.map((row) => {
        const pin = row.querySelector(".customer-track-location-pin").getBoundingClientRect();
        return round(pin.left + pin.width / 2);
      }),
      connectorCenters: rows.slice(0, -1).map((row) => {
        const bounds = row.getBoundingClientRect();
        return round(bounds.left + parseFloat(getComputedStyle(row, "::before").left));
      }),
      hasThreeColumns: rows.map((row) => getComputedStyle(row).gridTemplateColumns.split(" ").length === 3),
      navigationAligned: rows.map((row) => {
        const bounds = row.getBoundingClientRect();
        const copy = row.querySelector(".customer-track-location-copy").getBoundingClientRect();
        const button = row.querySelector("[data-customer-stop-map]").getBoundingClientRect();
        return button.top >= bounds.top && button.bottom <= bounds.bottom + 1 && button.left > copy.right;
      }),
      navigationIcons: rows.map((row) => Boolean(row.querySelector("[data-customer-stop-map] polygon"))),
      oldCardConnector: getComputedStyle(host.querySelector(".customer-track-location-card"), "::before").display,
      oldCardDot: getComputedStyle(host.querySelector(".customer-track-location-card"), "::after").display
    };
    host.remove();
    if (!hadCustomerClass) document.body.classList.remove("portal-customer");
    return result;
  })()`);
  assert.deepEqual(routeResult.classes, ["start", "middle", "end"]);
  assert.deepEqual(routeResult.colors, ["rgb(17, 150, 83)", "rgb(7, 94, 234)", "rgb(220, 48, 64)"]);
  assert.equal(new Set(routeResult.pinCenters).size, 1, "Route pins are not vertically aligned.");
  assert.deepEqual(routeResult.connectorCenters, routeResult.pinCenters.slice(0, -1), "Route connectors do not meet the pin centres.");
  assert.deepEqual(routeResult.hasThreeColumns, [true, true, true], "Location rows must retain marker, address and navigation columns.");
  assert.deepEqual(routeResult.navigationAligned, [true, true, true], "Navigation actions wrapped below their location rows.");
  assert.deepEqual(routeResult.navigationIcons, [true, true, true], "Location actions are not using navigation icons.");
  assert.equal(routeResult.oldCardConnector, "none");
  assert.equal(routeResult.oldCardDot, "none");

  let adminBaseTested = false;
  const adminPageResponse = await fetch(`${baseUrl}/admin/customer`);
  const adminPageHtml = adminPageResponse.ok ? await adminPageResponse.text() : "";
  if (adminPageResponse.ok && /name="zigo-base-path" content="\/admin"/.test(adminPageHtml)) {
    adminBaseTested = true;
    await sendBrowserCommand("Page.navigate", { url: `${baseUrl}/admin/customer` });
    assert.equal(await pollBrowser("document.readyState === 'complete' && typeof assetUrl === 'function'"), true);
    assert.equal(
      await evaluateInBrowser("assetUrl('https://zigonow.in/uploads/documents/example.png')"),
      "/admin/uploads/documents/example.png?zv=attachment-preview-20261013"
    );
  }

  console.log(`Media upload and preview integration passed${adminBaseTested ? " with /admin live base-path coverage" : ""}.`);
} finally {
  if (socket) socket.close();
  if (browser && browser.exitCode == null) {
    browser.kill();
    await Promise.race([once(browser, "exit"), wait(2000)]);
  }
  await wait(250);
  if (server) await new Promise((resolve) => server.close(resolve));
  if (uploadedFileId) await pool.query("delete from zigo.files where id = $1", [uploadedFileId]);
  if (uploadedFilePath && uploadedFilePath.startsWith(`${documentsDirectory}${path.sep}`) && existsSync(uploadedFilePath)) unlinkSync(uploadedFilePath);
  if (legacyFilePath.startsWith(`${documentsDirectory}${path.sep}`) && existsSync(legacyFilePath)) unlinkSync(legacyFilePath);
  const tempRoot = `${path.resolve(tmpdir())}${path.sep}`;
  if (profileDirectory && path.resolve(profileDirectory).startsWith(tempRoot) && existsSync(profileDirectory)) {
    try {
      rmSync(profileDirectory, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
    } catch (error) {
      console.warn(`Unable to remove temporary browser profile: ${error.message}`);
    }
  }
  await pool.end();
}
