export interface CompressedLogLine {
  text: string;
  count: number;
}

const PREFIX_RE = /^([\u4e00-\u9fa5A-Za-z]{1,8})[:：]\s*(.+)$/;

function removablePrefixes(lines: string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const match = line.match(PREFIX_RE);
    if (!match) {
      continue;
    }
    const prefix = match[1];
    counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  const removable = new Set<string>();
  for (const [prefix, count] of counts.entries()) {
    if (count >= 3) {
      removable.add(prefix);
    }
  }
  return removable;
}

function simplifyLine(line: string, removable: Set<string>): string {
  const match = line.match(PREFIX_RE);
  if (!match) {
    return line;
  }
  const [, prefix, body] = match;
  if (!removable.has(prefix)) {
    return line;
  }
  return body;
}

export function compressLog(lines: string[]): CompressedLogLine[] {
  if (lines.length < 1) {
    return [];
  }

  const removable = removablePrefixes(lines);
  const compressed: CompressedLogLine[] = [];

  for (const rawLine of lines) {
    const text = simplifyLine(rawLine, removable);
    const last = compressed[compressed.length - 1];
    if (last && last.text === text) {
      last.count += 1;
      continue;
    }
    compressed.push({ text, count: 1 });
  }

  return compressed;
}
