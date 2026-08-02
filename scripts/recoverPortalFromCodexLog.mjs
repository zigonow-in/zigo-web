import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const sessionPath = "C:/Users/WLTPE/.codex/sessions/2026/05/29/rollout-2026-05-29T14-09-23-019e72e3-5d2c-7303-a729-3132133162b1.jsonl";
const targetDir = path.resolve("recovery-5pm");
const targets = new Set(["portal.css", "portal.js"]);
const startByFile = {
  "portal.css": "2026-07-02T13:41:05.000Z",
  "portal.js": "2026-07-02T16:29:49.000Z",
  "portal.html": "2026-07-02T16:31:00.000Z"
};
const endAt = "2026-07-06T11:30:00.000Z";

function normalizeFileName(file) {
  const normalized = String(file || "").replace(/\\/g, "/");
  const match = normalized.match(/public\/([^/]+)$/i);
  return match?.[1] || "";
}

function splitLines(text) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function applyUnifiedDiff(originalText, diffText, label) {
  const original = splitLines(originalText);
  const diff = splitLines(diffText);
  const output = [];
  let sourceIndex = 0;
  let i = 0;

  while (i < diff.length) {
    const header = diff[i];
    const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(header);
    if (!match) {
      i += 1;
      continue;
    }

    const oldStart = Number(match[1]);
    const oldIndex = Math.max(0, oldStart - 1);
    while (sourceIndex < oldIndex) {
      output.push(original[sourceIndex]);
      sourceIndex += 1;
    }

    i += 1;
    while (i < diff.length && !diff[i].startsWith("@@ ")) {
      const line = diff[i];
      const marker = line[0];
      const value = line.slice(1);
      if (marker === " ") {
        if (original[sourceIndex] !== value) {
          throw new Error(`${label}: context mismatch at source line ${sourceIndex + 1}`);
        }
        output.push(original[sourceIndex]);
        sourceIndex += 1;
      } else if (marker === "-") {
        if (original[sourceIndex] !== value) {
          throw new Error(`${label}: remove mismatch at source line ${sourceIndex + 1}`);
        }
        sourceIndex += 1;
      } else if (marker === "+") {
        output.push(value);
      } else if (line.startsWith("\\ No newline")) {
        // Ignore marker. The portal assets conventionally end with a newline.
      } else if (line === "") {
        throw new Error(`${label}: malformed empty diff line`);
      }
      i += 1;
    }
  }

  while (sourceIndex < original.length) {
    output.push(original[sourceIndex]);
    sourceIndex += 1;
  }

  return `${output.join("\n")}\n`;
}

async function main() {
  const contents = new Map();
  for (const name of targets) {
    contents.set(name, fs.readFileSync(path.join(targetDir, name), "utf8"));
  }

  let applied = 0;
  const counts = {};
  const rl = readline.createInterface({
    input: fs.createReadStream(sessionPath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.includes("portal.")) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const ts = event.timestamp || "";
    const changes = event.payload?.changes;
    if (!changes) continue;

    for (const [file, change] of Object.entries(changes)) {
      const name = normalizeFileName(file);
      if (!targets.has(name)) continue;
      if (ts < startByFile[name] || ts > endAt) continue;
      if (change.type !== "update" || !change.unified_diff) continue;
      const next = applyUnifiedDiff(contents.get(name), change.unified_diff, `${name} ${ts}`);
      contents.set(name, next);
      counts[name] = (counts[name] || 0) + 1;
      applied += 1;
    }
  }

  for (const [name, text] of contents.entries()) {
    fs.writeFileSync(path.join(targetDir, name), text, "utf8");
  }
  console.log(JSON.stringify({ applied, counts }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
