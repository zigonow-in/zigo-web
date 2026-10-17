import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import jwt from 'jsonwebtoken';
import { pool } from '../dist/db/pool.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browserCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].filter(Boolean);
const browserPath = browserCandidates.find(existsSync);
assert.ok(browserPath, 'Chrome or Edge is required for the customer location UI test.');

const user = (await pool.query(`
  select u.id
  from zigo.users u
  join zigo.customers c on c.user_id = u.id
  where u.deleted_at is null
    and coalesce(u.metadata->>'accountStatus', 'active') = 'active'
  order by u.updated_at desc
  limit 1
`)).rows[0];
assert.ok(user?.id, 'An active customer is required for the customer location UI test.');

const secret = process.env.JWT_SECRET || 'zigo-development-secret';
const accessToken = jwt.sign({ sub: user.id, app: 'customer_portal', roles: ['customer'], tokenType: 'access' }, secret, { expiresIn: '15m' });
const refreshToken = jwt.sign({ sub: user.id, app: 'customer_portal', roles: ['customer'], tokenType: 'refresh' }, secret, { expiresIn: '30d' });
const profileDirectory = mkdtempSync(join(tmpdir(), 'zigo-location-search-'));
const browser = spawn(browserPath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--remote-debugging-port=0',
  `--user-data-dir=${profileDirectory}`,
  'about:blank'
], { stdio: 'ignore', windowsHide: true });

let socket;
const pending = new Map();
let commandId = 0;

async function waitForDebugPort() {
  const portFile = join(profileDirectory, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (existsSync(portFile)) return Number(readFileSync(portFile, 'utf8').split(/\r?\n/)[0]);
    if (browser.exitCode != null) throw new Error('Headless browser exited before opening the debugging port.');
    await wait(50);
  }
  throw new Error('Timed out waiting for the headless browser debugging port.');
}

function send(method, params = {}) {
  const id = ++commandId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || 'Browser evaluation failed.');
  return response.result?.value;
}

async function poll(expression, timeoutMs = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(expression)) return true;
    await wait(100);
  }
  return false;
}

async function typeLocationQuery(value) {
  await evaluate(`(() => {
    const input = window.__locationSheetTest.input;
    input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(value.slice(-1))} }));
    return true;
  })()`);
}

try {
  const port = await waitForDebugPort();
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((entry) => entry.type === 'page');
  assert.ok(target?.webSocketDebuggerUrl, 'Headless browser page target was not available.');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const entry = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result || {});
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://localhost:4003/customer' });
  assert.equal(await poll(`document.readyState === 'complete'`), true, 'Customer page did not load.');
  await evaluate(`localStorage.setItem('zigoPortalToken:customer', ${JSON.stringify(accessToken)}); localStorage.setItem('zigoPortalRefreshToken:customer', ${JSON.stringify(refreshToken)});`);
  await send('Page.reload', { ignoreCache: true });
  assert.equal(await poll(`typeof state === 'object' && typeof render === 'function' && Boolean(state.token)`), true, 'Customer application did not initialize.');
  await wait(1800);
  await evaluate(`(() => {
    state.splashDone = true;
    state.sessionRestoring = false;
    state.customerView = 'home';
    state.customerLocationPickerSheetOpen = true;
    state.customerLocationPickerClosing = false;
    state.customerLocationPermissionPopupOpen = false;
    state.locationSearchQuery = '';
    state.locationResults = [];
    state.locationBusy = false;
    render();
    return true;
  })()`);
  assert.equal(await poll(`Boolean(document.querySelector('[data-location-picker-overlay] [data-location-search-input]'))`), true, 'Location picker did not open.');
  await wait(250);
  const setup = await evaluate(`(() => {
    const overlay = document.querySelector('[data-location-picker-overlay]');
    const sheet = overlay.querySelector('.customer-location-picker-sheet');
    const input = overlay.querySelector('[data-location-search-input]');
    window.__locationSheetTest = { overlay, sheet, input, removals: 0 };
    new MutationObserver((records) => {
      for (const record of records) {
        for (const removed of record.removedNodes) {
          if (removed === overlay || removed === sheet || removed === input || removed.contains?.(input)) window.__locationSheetTest.removals += 1;
        }
      }
    }).observe(document.querySelector('#portalRoot'), { childList: true, subtree: true });
    input.focus({ preventScroll: true });
    return { overlay: Boolean(overlay), sheet: Boolean(sheet), input: Boolean(input), focused: document.activeElement === input };
  })()`);
  assert.deepEqual(setup, { overlay: true, sheet: true, input: true, focused: true });

  const rerenderState = await evaluate(`(() => {
    const test = window.__locationSheetTest;
    test.input.value = 'vatika';
    test.input.setSelectionRange(3, 3);
    test.sheet.scrollTop = 24;
    render();
    renderCustomerHome();
    const overlay = document.querySelector('[data-location-picker-overlay]');
    const input = overlay?.querySelector('[data-location-search-input]');
    const sheet = overlay?.querySelector('.customer-location-picker-sheet');
    const result = {
      overlayCount: document.querySelectorAll('[data-location-picker-overlay]').length,
      sameOverlay: overlay === test.overlay,
      sameSheet: sheet === test.sheet,
      sameInput: input === test.input,
      focused: document.activeElement === test.input,
      selectionStart: test.input.selectionStart,
      scrollTop: sheet?.scrollTop,
      stable: overlay?.classList.contains('is-stable') === true
    };
    test.removals = 0;
    return result;
  })()`);
  assert.deepEqual(rerenderState, {
    overlayCount: 1,
    sameOverlay: true,
    sameSheet: true,
    sameInput: true,
    focused: true,
    selectionStart: 3,
    scrollTop: 24,
    stable: true
  }, 'A customer home refresh remounted or blinked the open location sheet.');

  await typeLocationQuery('vatika sector 49');
  await wait(80);
  const duringSearch = await evaluate(`(() => {
    const test = window.__locationSheetTest;
    return {
      sameOverlay: document.querySelector('[data-location-picker-overlay]') === test.overlay,
      sameSheet: document.querySelector('.customer-location-picker-sheet') === test.sheet,
      sameInput: document.querySelector('[data-location-search-input]') === test.input,
      focused: document.activeElement === test.input,
      mode: document.querySelector('[data-location-picker-body]')?.dataset.locationPickerMode,
      removals: test.removals
    };
  })()`);
  assert.deepEqual(duringSearch, { sameOverlay: true, sameSheet: true, sameInput: true, focused: true, mode: 'search', removals: 0 });
  assert.equal(await poll(`state.locationSearchQuery === 'vatika sector 49' && state.locationBusy === false`, 15000), true, 'Location search did not settle.');

  await typeLocationQuery('vatika sector 4');
  await wait(80);
  const duringEdit = await evaluate(`(() => {
    const test = window.__locationSheetTest;
    return document.querySelector('[data-location-picker-overlay]') === test.overlay
      && document.querySelector('.customer-location-picker-sheet') === test.sheet
      && document.querySelector('[data-location-search-input]') === test.input
      && document.activeElement === test.input
      && test.removals === 0;
  })()`);
  assert.equal(duringEdit, true, 'Editing the query remounted or blurred the location sheet.');
  assert.equal(await poll(`state.locationSearchQuery === 'vatika sector 4' && state.locationBusy === false`, 15000), true, 'Edited location search did not settle.');

  await typeLocationQuery('');
  await wait(120);
  const finalState = await evaluate(`(() => {
    const test = window.__locationSheetTest;
    return {
      sameOverlay: document.querySelector('[data-location-picker-overlay]') === test.overlay,
      sameSheet: document.querySelector('.customer-location-picker-sheet') === test.sheet,
      sameInput: document.querySelector('[data-location-search-input]') === test.input,
      focused: document.activeElement === test.input,
      mode: document.querySelector('[data-location-picker-body]')?.dataset.locationPickerMode,
      removals: test.removals,
      query: state.locationSearchQuery
    };
  })()`);
  assert.deepEqual(finalState, { sameOverlay: true, sameSheet: true, sameInput: true, focused: true, mode: 'list', removals: 0, query: '' });

  const changeLocationSetup = await evaluate(`(() => {
    state.customerView = 'location';
    state.locationStep = 'confirm';
    state.customerLocationPickerSheetOpen = false;
    root.innerHTML = '<section data-location-confirm-test><div data-location-map-test></div></section>';
    window.__locationConfirmTestPage = root.firstElementChild;
    showCustomerUnserviceableSheet({ address: 'Lotus Winsome Home, Bandhwari, Haryana' });
    return Boolean(document.querySelector('[data-change-service-location]'));
  })()`);
  assert.equal(changeLocationSetup, true, 'The unserviceable location action was not rendered.');
  await evaluate(`document.querySelector('[data-change-service-location]').click()`);
  await wait(50);
  const changeLocationState = await evaluate(`({
    samePage: root.firstElementChild === window.__locationConfirmTestPage,
    customerView: state.customerView,
    locationStep: state.locationStep,
    locationPickerOpen: state.customerLocationPickerSheetOpen,
    serviceabilitySheetOpen: Boolean(document.querySelector('[data-customer-unserviceable-sheet]'))
  })`);
  assert.deepEqual(changeLocationState, {
    samePage: true,
    customerView: 'location',
    locationStep: 'confirm',
    locationPickerOpen: false,
    serviceabilitySheetOpen: false
  }, 'Choose another location navigated away from the current confirmation map.');

  const mapPinStyle = await evaluate(`(() => {
    root.innerHTML = '<section class="location-map-pick-screen"><span class="customer-location-map-pin"></span></section>';
    const pin = root.querySelector('.customer-location-map-pin');
    return {
      background: getComputedStyle(pin).backgroundImage,
      border: getComputedStyle(pin).borderTopColor,
      dot: getComputedStyle(pin, '::before').backgroundColor,
      tail: getComputedStyle(pin, '::after').borderTopColor
    };
  })()`);
  assert.match(mapPinStyle.background, /rgb\(7, 94, 234\)/, 'The map pin is not using ZIGO blue.');
  assert.equal(mapPinStyle.border, 'rgb(6, 79, 199)');
  assert.equal(mapPinStyle.dot, 'rgb(255, 255, 255)');
  assert.equal(mapPinStyle.tail, 'rgb(4, 82, 207)');

  const reviewLocationActions = await evaluate(`(() => {
    const first = {
      label: '&Mart',
      address: 'Sector 53, Gurugram, Haryana',
      latitude: 28.4421,
      longitude: 77.1025,
      clusterId: 'cluster-one'
    };
    const second = {
      label: 'Naushijaan',
      address: 'Sector 56, Gurugram, Haryana',
      latitude: 28.4211,
      longitude: 77.0915,
      clusterId: 'cluster-one'
    };
    const host = document.createElement('div');
    host.innerHTML = customerCartRouteSummaryHtml([first], false, 1, 'current');
    const single = {
      edit: host.querySelectorAll('[data-edit-customer-cart-location-stop]').length,
      delete: host.querySelectorAll('[data-open-customer-cart-route-delete]').length
    };
    host.innerHTML = customerCartRouteDetailsHtml([first, second]);
    const multi = {
      edit: host.querySelectorAll('[data-edit-customer-cart-location-stop]').length,
      delete: host.querySelectorAll('[data-open-customer-cart-route-delete]').length
    };

    const previousPrimary = state.customerRoutePrimaryStop;
    const previousStops = state.customerLocationStops;
    const previousCleared = state.customerRoutePrimaryCleared;
    const previousDeleteIndex = state.customerCartRouteDeleteIndex;
    state.customerRoutePrimaryStop = { ...first, isPrimary: true };
    state.customerLocationStops = [{ ...second, isPrimary: false }];
    state.customerRoutePrimaryCleared = false;
    state.customerCartRouteDeleteIndex = 1;
    host.innerHTML = customerCartRouteDeletePopupHtml();
    const deleteConfirmation = Boolean(host.querySelector('[data-confirm-customer-route-delete]'));
    state.customerRoutePrimaryStop = previousPrimary;
    state.customerLocationStops = previousStops;
    state.customerRoutePrimaryCleared = previousCleared;
    state.customerCartRouteDeleteIndex = previousDeleteIndex;

    const previousRenderCart = renderCart;
    let reviewRendered = false;
    renderCart = () => { reviewRendered = true; };
    state.customerView = 'location';
    state.locationConfirmReturnStep = 'cart-edit';
    state.customerLocationPickerPurpose = 'cart-edit';
    state.customerLocationPickerSheetOpen = false;
    state.customerCartRouteEditIndex = 0;
    try {
      backFromCustomerConfirmLocation();
    } finally {
      renderCart = previousRenderCart;
    }
    const editReturn = {
      reviewRendered,
      view: state.customerView,
      purpose: state.customerLocationPickerPurpose,
      pickerOpen: state.customerLocationPickerSheetOpen,
      editIndex: state.customerCartRouteEditIndex,
      returnStep: state.locationConfirmReturnStep
    };
    return { single, multi, deleteConfirmation, editReturn };
  })()`);
  assert.deepEqual(reviewLocationActions, {
    single: { edit: 1, delete: 0 },
    multi: { edit: 2, delete: 2 },
    deleteConfirmation: true,
    editReturn: {
      reviewRendered: true,
      view: 'cart',
      purpose: '',
      pickerOpen: false,
      editIndex: -1,
      returnStep: 'manual'
    }
  }, 'Review Booking location edit/delete controls or return navigation regressed.');

  const reviewLocationSequence = await evaluate(`(() => {
    const first = {
      addressId: '11111111-1111-4111-8111-111111111111',
      label: 'Location A',
      address: 'Location A, Gurugram',
      latitude: 28.4421,
      longitude: 77.1025,
      clusterId: 'cluster-one'
    };
    const second = {
      label: 'Location B',
      address: 'Location B, Gurugram',
      latitude: 28.4211,
      longitude: 77.0915,
      clusterId: 'cluster-one'
    };
    const repeatedFirstFromSearch = {
      label: 'Location A again',
      address: 'Location A, Gurugram',
      latitude: 28.4421,
      longitude: 77.1025,
      clusterId: 'cluster-one'
    };
    const previousRequirement = customerCartLocationRequirement;
    const previousPrimary = state.customerRoutePrimaryStop;
    const previousStops = state.customerLocationStops;
    const previousCleared = state.customerRoutePrimaryCleared;
    const captureError = (callback) => {
      try { callback(); return ''; } catch (error) { return String(error.message || error); }
    };
    try {
      customerCartLocationRequirement = () => ({ mode: 'multi', maxLocations: 6, serviceRules: [], categoryRules: [] });
      state.customerRoutePrimaryStop = { ...first, isPrimary: true };
      state.customerRoutePrimaryCleared = false;

      state.customerLocationStops = [];
      const adjacentAddError = captureError(() => assertCustomerCartLocationNotAdjacent(repeatedFirstFromSearch));

      state.customerLocationStops = [{ ...second, isPrimary: false }];
      const separatedAddError = captureError(() => assertCustomerCartLocationNotAdjacent(repeatedFirstFromSearch));

      state.customerLocationStops = [{ ...second, isPrimary: false }, { ...repeatedFirstFromSearch, isPrimary: false }];
      const preservedSequence = customerCartLocationStopsForPayload().map((stop) => stop.label);
      const separatedSequenceError = captureError(() => assertCustomerCartLocationSequence(customerCartLocationStopsForPayload()));
      const editCreatesAdjacentError = captureError(() => assertCustomerCartLocationNotAdjacent(repeatedFirstFromSearch, 1));

      state.customerLocationStops = [{ ...repeatedFirstFromSearch, isPrimary: false }, { ...second, isPrimary: false }];
      const normalizedAdjacentSequence = customerCartLocationStopsForPayload().map((stop) => stop.label);

      return {
        adjacentAddBlocked: /back to back/i.test(adjacentAddError),
        separatedAddAllowed: separatedAddError === '',
        preservedSequence,
        separatedSequenceAllowed: separatedSequenceError === '',
        editCreatesAdjacentBlocked: /back to back/i.test(editCreatesAdjacentError),
        normalizedAdjacentSequence
      };
    } finally {
      customerCartLocationRequirement = previousRequirement;
      state.customerRoutePrimaryStop = previousPrimary;
      state.customerLocationStops = previousStops;
      state.customerRoutePrimaryCleared = previousCleared;
    }
  })()`);
  assert.deepEqual(reviewLocationSequence, {
    adjacentAddBlocked: true,
    separatedAddAllowed: true,
    preservedSequence: ['Location A', 'Location B', 'Location A again'],
    separatedSequenceAllowed: true,
    editCreatesAdjacentBlocked: true,
    normalizedAdjacentSequence: ['Location A', 'Location B']
  }, 'Review Booking must block only adjacent duplicate locations and preserve A-B-A routes.');

  const reviewDeleteInteraction = await evaluate(`(async () => {
    const first = {
      label: 'First location',
      address: 'Sector 53, Gurugram, Haryana',
      latitude: 28.4421,
      longitude: 77.1025,
      clusterId: 'cluster-one'
    };
    const second = {
      label: 'Second location',
      address: 'Sector 56, Gurugram, Haryana',
      latitude: 28.4211,
      longitude: 77.0915,
      clusterId: 'cluster-one'
    };
    const previousRequirement = customerCartLocationRequirement;
    const previousPrimary = state.customerRoutePrimaryStop;
    const previousStops = state.customerLocationStops;
    const previousCleared = state.customerRoutePrimaryCleared;
    const previousExpanded = state.customerCartRouteExpanded;
    const previousDeleteIndex = state.customerCartRouteDeleteIndex;
    try {
      customerCartLocationRequirement = () => ({ mode: 'multi', maxLocations: 3, serviceRules: [], categoryRules: [] });
      state.customerRoutePrimaryStop = { ...first, isPrimary: true };
      state.customerLocationStops = [{ ...second, isPrimary: false }];
      state.customerRoutePrimaryCleared = false;
      state.customerCartRouteExpanded = true;
      state.customerCartRouteDeleteIndex = -1;
      root.innerHTML = '<section class="mobile-app customer-cart-screen"><section class="customer-cart-location-section">' + customerCartLocationsHtml() + '</section></section>';

      root.querySelector('[data-open-customer-cart-route-delete="0"]').click();
      await new Promise((resolve) => setTimeout(resolve, 25));
      const opened = {
        dialog: Boolean(root.querySelector('[data-customer-route-delete-backdrop]')),
        cancel: Boolean(root.querySelector('button.soft-btn[data-close-customer-route-delete]')),
        delete: Boolean(root.querySelector('[data-confirm-customer-route-delete]')),
        locationCount: customerCartLocationStopsForPayload().length
      };

      root.querySelector('button.soft-btn[data-close-customer-route-delete]').click();
      await new Promise((resolve) => setTimeout(resolve, 25));
      const cancelled = {
        dialog: Boolean(root.querySelector('[data-customer-route-delete-backdrop]')),
        locationCount: customerCartLocationStopsForPayload().length
      };

      root.querySelector('[data-open-customer-cart-route-delete="0"]').click();
      await new Promise((resolve) => setTimeout(resolve, 25));
      root.querySelector('[data-confirm-customer-route-delete]').click();
      await new Promise((resolve) => setTimeout(resolve, 25));
      const deleted = {
        dialog: Boolean(root.querySelector('[data-customer-route-delete-backdrop]')),
        locationCount: customerCartLocationStopsForPayload().length,
        editButtons: root.querySelectorAll('[data-edit-customer-cart-location-stop]').length,
        deleteButtons: root.querySelectorAll('[data-open-customer-cart-route-delete]').length
      };
      return { opened, cancelled, deleted };
    } finally {
      customerCartLocationRequirement = previousRequirement;
      state.customerRoutePrimaryStop = previousPrimary;
      state.customerLocationStops = previousStops;
      state.customerRoutePrimaryCleared = previousCleared;
      state.customerCartRouteExpanded = previousExpanded;
      state.customerCartRouteDeleteIndex = previousDeleteIndex;
    }
  })()`);
  assert.deepEqual(reviewDeleteInteraction, {
    opened: { dialog: true, cancel: true, delete: true, locationCount: 2 },
    cancelled: { dialog: false, locationCount: 2 },
    deleted: { dialog: false, locationCount: 1, editButtons: 1, deleteButtons: 0 }
  }, 'Review Booking delete confirmation did not preserve Cancel/Delete behavior.');
  console.log('Customer location UI remained stable; Review Booking location actions, adjacent duplicate rules, return navigation, confirmation dialog, and the ZIGO blue map pin passed.');
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    await send('Browser.close').catch(() => {});
    socket.close();
  }
  if (browser.exitCode == null) browser.kill();
  if (browser.exitCode == null) {
    await Promise.race([
      new Promise((resolve) => browser.once('exit', resolve)),
      wait(2000)
    ]);
  }
  await pool.end();
  if (profileDirectory.startsWith(tmpdir())) {
    try { rmSync(profileDirectory, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 }); } catch {}
  }
}
