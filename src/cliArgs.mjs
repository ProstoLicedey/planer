import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function getArgValue(flag, defaultValue = undefined, argv = process.argv) {
  const idx = argv.indexOf(flag);
  if (idx === -1) return defaultValue;
  return argv[idx + 1] ?? defaultValue;
}

export function isMainModule(importMetaUrl) {
  const entry = process.argv[1];
  if (!entry || !importMetaUrl) return false;
  return path.resolve(entry) === fileURLToPath(importMetaUrl);
}

