export function getArgValue(flag, defaultValue = undefined, argv = process.argv) {
  const idx = argv.indexOf(flag);
  if (idx === -1) return defaultValue;
  return argv[idx + 1] ?? defaultValue;
}

