import { describe, expect, it } from "vitest";
import { compressLog, parseLogLine } from "../src/utils/log";

describe("parseLogLine", () => {
  it("categorizes check logs", () => {
    const parsed = parseLogLine("检定[粮道]：roll=12");
    expect(parsed.type).toBe("check_roll");
    expect(parsed.normalized).toContain("#");
  });
});

describe("compressLog", () => {
  it("groups near-duplicate lines in window", () => {
    const result = compressLog(["第1回合 危机值 +1", "剧情推进", "第2回合 危机值 +2"]);
    expect(result.some((r) => r.count === 2)).toBe(true);
  });
});
