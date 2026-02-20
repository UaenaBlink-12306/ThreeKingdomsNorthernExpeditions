function isPrefix(prefix: string[], full: string[]): boolean {
  if (prefix.length > full.length) {
    return false;
  }
  return prefix.every((line, index) => line === full[index]);
}

function suffixPrefixOverlap(prev: string[], next: string[]): number {
  const max = Math.min(prev.length, next.length);
  for (let size = max; size >= 1; size -= 1) {
    let matched = true;
    for (let i = 0; i < size; i += 1) {
      if (prev[prev.length - size + i] !== next[i]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return size;
    }
  }
  return 0;
}

export function computeLogDelta(prevLog: string[] | undefined, currentLog: string[]): string[] {
  if (!prevLog || prevLog.length === 0) {
    return currentLog;
  }

  if (isPrefix(prevLog, currentLog)) {
    return currentLog.slice(prevLog.length);
  }

  const overlap = suffixPrefixOverlap(prevLog, currentLog);
  if (overlap > 0) {
    return currentLog.slice(overlap);
  }

  return currentLog;
}
