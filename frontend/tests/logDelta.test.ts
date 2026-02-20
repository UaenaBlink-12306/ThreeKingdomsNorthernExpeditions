import { describe, expect, it } from "vitest";
import { computeLogDelta } from "../src/utils/logDelta";

describe("computeLogDelta", () => {
  it("uses append-only fast path", () => {
    expect(computeLogDelta(["a", "b"], ["a", "b", "c", "d"])).toEqual(["c", "d"]);
  });

  it("uses overlap fallback when logs rotate", () => {
    expect(computeLogDelta(["a", "b", "c"], ["c", "d", "e"])) .toEqual(["d", "e"]);
  });

  it("falls back to full current log when no overlap", () => {
    expect(computeLogDelta(["x"], ["a", "b"])) .toEqual(["a", "b"]);
  });
});
