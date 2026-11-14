import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatLogicalDate,
  isLogicalDate,
  logicalDate,
  logicalYesterday,
} from "./logical-date";

/** Build a moment from an IST wall-clock time. */
const ist = (date: string, time: string) => new Date(`${date}T${time}+05:30`);

describe("logicalDate", () => {
  it("uses the same day from 4:00 am onwards", () => {
    expect(logicalDate(ist("2026-11-14", "04:00:00"))).toBe("2026-11-14");
    expect(logicalDate(ist("2026-11-14", "12:00:00"))).toBe("2026-11-14");
    expect(logicalDate(ist("2026-11-14", "23:59:59"))).toBe("2026-11-14");
  });

  it("counts midnight to 3:59 am as the previous day", () => {
    expect(logicalDate(ist("2026-11-15", "00:00:00"))).toBe("2026-11-14");
    expect(logicalDate(ist("2026-11-15", "03:59:59"))).toBe("2026-11-14");
  });

  it("rolls over exactly at 4:00 am", () => {
    expect(logicalDate(ist("2026-11-15", "03:59:59.999"))).toBe("2026-11-14");
    expect(logicalDate(ist("2026-11-15", "04:00:00.000"))).toBe("2026-11-15");
  });

  it("handles month and year boundaries", () => {
    expect(logicalDate(ist("2026-12-01", "02:00:00"))).toBe("2026-11-30");
    expect(logicalDate(ist("2027-01-01", "01:30:00"))).toBe("2026-12-31");
    expect(logicalDate(ist("2028-03-01", "03:00:00"))).toBe("2028-02-29");
  });

  it("does not depend on the device timezone", () => {
    // 22:00 UTC on the 14th is 03:30 IST on the 15th, which is still the 14th.
    expect(logicalDate(new Date("2026-11-14T22:00:00Z"))).toBe("2026-11-14");
    // 22:30 UTC on the 14th is 04:00 IST on the 15th.
    expect(logicalDate(new Date("2026-11-14T22:30:00Z"))).toBe("2026-11-15");
  });
});

describe("date arithmetic", () => {
  it("adds and subtracts days across boundaries", () => {
    expect(addDays("2026-11-14", 1)).toBe("2026-11-15");
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("gives the logical yesterday", () => {
    expect(logicalYesterday(ist("2026-11-15", "02:00:00"))).toBe("2026-11-13");
    expect(logicalYesterday(ist("2026-11-15", "09:00:00"))).toBe("2026-11-14");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-11-14", "2026-11-14")).toBe(0);
    expect(daysBetween("2026-11-14", "2026-12-14")).toBe(30);
    expect(daysBetween("2026-11-14", "2026-11-07")).toBe(-7);
  });
});

describe("validation and formatting", () => {
  it("accepts only real YYYY-MM-DD dates", () => {
    expect(isLogicalDate("2026-11-14")).toBe(true);
    expect(isLogicalDate("2026-02-30")).toBe(false);
    expect(isLogicalDate("14-11-2026")).toBe(false);
    expect(isLogicalDate("")).toBe(false);
  });

  it("rejects bad input in arithmetic", () => {
    expect(() => addDays("nonsense", 1)).toThrow();
  });

  it("formats for display", () => {
    expect(formatLogicalDate("2026-11-14")).toMatch(/Sat.*14.*Nov.*2026/);
  });
});
