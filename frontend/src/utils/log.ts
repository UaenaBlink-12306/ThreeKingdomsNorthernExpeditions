export interface CompressedLogLine {
  text: string;
  count: number;
}

export interface ParsedLogLine {
  type: "fx_token" | "turn_tick" | "check_roll" | "story_log";
  normalized: string;
  text: string;
}

const TURN_RE = /第\d+回合/;
const NUMBER_RE = /\d+/g;

export function parseLogLine(line: string): ParsedLogLine {
  if (line.startsWith("FX_")) {
    return { type: "fx_token", normalized: "fx_token", text: line };
  }

  if (TURN_RE.test(line) || line.includes("危机值")) {
    const normalized = line.replace(/第\d+回合/g, "第#回合").replace(NUMBER_RE, "#");
    return { type: "turn_tick", normalized, text: line };
  }

  if (line.includes("检定[")) {
    const normalized = line.replace(NUMBER_RE, "#");
    return { type: "check_roll", normalized, text: line };
  }

  return {
    type: "story_log",
    normalized: line.replace(NUMBER_RE, "#"),
    text: line,
  };
}

export function compressLog(lines: string[], lookbackWindow = 8): CompressedLogLine[] {
  const compressed: Array<CompressedLogLine & { normalized: string }> = [];

  for (const line of lines) {
    const parsed = parseLogLine(line);
    let merged = false;

    for (let i = compressed.length - 1; i >= 0 && compressed.length - i <= lookbackWindow; i -= 1) {
      if (compressed[i].normalized === parsed.normalized) {
        compressed[i].count += 1;
        compressed[i].text = line;
        merged = true;
        break;
      }
    }

    if (!merged) {
      compressed.push({ text: line, count: 1, normalized: parsed.normalized });
    }
  }

  return compressed.map(({ text, count }) => ({ text, count }));
}
