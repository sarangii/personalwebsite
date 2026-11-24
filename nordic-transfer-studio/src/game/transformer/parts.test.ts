import { describe, expect, it } from "vitest";
import { WINDOW, autoplayStep, partProgress, parts, stageLabel } from "./parts";

describe("explode rules", () => {
  it("every part is home when assembled and fully moved when exploded", () => {
    for (const p of parts) {
      expect(partProgress(p.start, 0)).toBe(0);
      if (p.start + WINDOW <= 1) expect(partProgress(p.start, 1)).toBe(1);
    }
  });
  it("cover lifts before the windings move", () => {
    expect(partProgress(0, 0.3)).toBeGreaterThan(0);
    expect(partProgress(0.5, 0.3)).toBe(0);
  });
  it("labels the ends of the range", () => {
    expect(stageLabel(0)).toBe("Assembled");
    expect(stageLabel(1)).toBe("Exploded");
  });
  it("autoplay turns around at the ends", () => {
    expect(autoplayStep(0.99, 1, 1)).toMatchObject({ explode: 1, dir: -1 });
    expect(autoplayStep(0.01, -1, 1)).toMatchObject({ explode: 0, dir: 1 });
  });
});
