import { describe, expect, it } from "vitest";
import { parseScore, parseSteps, parseVitals, sleepBand, stepsBand } from "./rules";

describe("steps colour", () => {
  it("is green at or above the target", () => {
    expect(stepsBand(10000, 10000)).toBe("green");
    expect(stepsBand(14200, 10000)).toBe("green");
  });

  it("is orange up to 25% below the target", () => {
    expect(stepsBand(9999, 10000)).toBe("orange");
    expect(stepsBand(7500, 10000)).toBe("orange");
  });

  it("is red more than 25% below the target", () => {
    expect(stepsBand(7499, 10000)).toBe("red");
    expect(stepsBand(0, 10000)).toBe("red");
  });

  it("has no colour when no target applied that day", () => {
    expect(stepsBand(12000, null)).toBe("none");
  });
});

describe("sleep colour", () => {
  it("follows the four bands", () => {
    expect(sleepBand(100)).toBe("blue");
    expect(sleepBand(86)).toBe("blue");
    expect(sleepBand(85)).toBe("green");
    expect(sleepBand(80)).toBe("green");
    expect(sleepBand(79)).toBe("orange");
    expect(sleepBand(70)).toBe("orange");
    expect(sleepBand(69)).toBe("red");
    expect(sleepBand(1)).toBe("red");
  });

  it("has no colour for a skipped night", () => {
    expect(sleepBand(null)).toBe("none");
  });
});

describe("typed entries", () => {
  it("reads a step count, with or without commas", () => {
    expect(parseSteps("8450")).toBe(8450);
    expect(parseSteps("12,300")).toBe(12300);
    expect(parseSteps("0")).toBe(0);
    expect(parseSteps("")).toBeNull();
    expect(parseSteps("-5")).toBeNull();
    expect(parseSteps("84.5")).toBeNull();
  });

  it("accepts a sleep score from 1 to 100 only", () => {
    expect(parseScore("1")).toBe(1);
    expect(parseScore("100")).toBe(100);
    expect(parseScore("0")).toBeNull();
    expect(parseScore("101")).toBeNull();
    expect(parseScore("82.5")).toBeNull();
    expect(parseScore("")).toBeNull();
  });

  it("keeps only the body measurements that were filled in", () => {
    expect(parseVitals({ weight_kg: "78.4", waist_in: " ", hip_in: "38" })).toEqual({
      values: { weight_kg: 78.4, hip_in: 38 },
    });
  });

  it("rejects an empty form and bad numbers", () => {
    expect(parseVitals({})).toEqual({ error: "Fill in at least one measurement." });
    expect(parseVitals({ weight_kg: "0" })).toEqual({ error: "Weight must be a number above zero." });
    expect(parseVitals({ chest_in: "abc" })).toEqual({ error: "Chest must be a number above zero." });
  });
});
