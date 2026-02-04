#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const sourcePath = path.resolve(webRoot, '..', 'New project', 'copart_lot_details.jsonl');
const targetPath = path.resolve(webRoot, 'src', 'data', 'copart-from-new-project.json');

function parseJsonLines(contents) {
  const lines = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid JSON on line ${index + 1}: ${message}`);
    }
  });
}

function main() {
  if (!fs.existsSync(sourcePath)) {
    if (fs.existsSync(targetPath)) {
      console.warn(
        `Source file not found: ${sourcePath}. Using existing data file: ${targetPath}`
      );
      return;
    }

    throw new Error(
      `Source file not found: ${sourcePath}, and fallback file missing: ${targetPath}`
    );
  }

  const sourceContents = fs.readFileSync(sourcePath, 'utf8');
  const items = parseJsonLines(sourceContents);
  const payload = {
    source: 'New project/copart_lot_details.jsonl',
    syncedAt: new Date().toISOString(),
    count: items.length,
    items,
  };

  fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Synced ${items.length} records to ${targetPath}`);
}

main();
