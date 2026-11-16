/** Value stored for a flag given without a value, like `-silent`. */
const presentValue = 'true';

/** Parses Go-style flags (`-name value` or a bare `-switch`), the style the arena uses. */
export function parseFlags(argv: readonly string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i]!.replace(/^-+/, '');
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('-')) {
      flags.set(name, next);
      i++;
    } else flags.set(name, presentValue);
  }
  return flags;
}
