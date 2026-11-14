import { describe, expect, it } from "vitest";
import { nextTargetAfter, targetFor, type Target } from "./targets";

const targets: Target[] = [
  { metric: "calories", value: 2000, start_date: "2026-10-01" },
  { metric: "calories", value: 1800, start_date: "2026-11-10" },
  { metric: "calories", value: 1700, start_date: "2026-12-01" },
  { metric: "steps", value: 8000, start_date: "2026-11-01" },
];

describe("targetFor", () => {
  it("returns null before any target started", () => {
    expect(targetFor(targets, "calories", "2026-09-30")).toBeNull();
    expect(targetFor(targets, "protein", "2026-11-14")).toBeNull();
  });

  it("uses the target that applied on that day", () => {
    expect(targetFor(targets, "calories", "2026-10-01")?.value).toBe(2000);
    expect(targetFor(targets, "calories", "2026-11-09")?.value).toBe(2000);
    expect(targetFor(targets, "calories", "2026-11-10")?.value).toBe(1800);
    expect(targetFor(targets, "calories", "2026-11-30")?.value).toBe(1800);
    expect(targetFor(targets, "calories", "2027-01-01")?.value).toBe(1700);
  });

  it("keeps metrics separate", () => {
    expect(targetFor(targets, "steps", "2026-11-14")?.value).toBe(8000);
  });
});

describe("nextTargetAfter", () => {
  it("finds the next scheduled change", () => {
    expect(nextTargetAfter(targets, "calories", "2026-11-14")?.value).toBe(1700);
    expect(nextTargetAfter(targets, "calories", "2026-12-01")).toBeNull();
  });
});
