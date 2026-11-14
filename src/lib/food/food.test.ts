import { describe, expect, it } from "vitest";
import type { Target } from "../targets";
import { combineReads } from "./combine";
import { reviewChecks, toSavePayload, type Existing } from "./plan";
import { judgeDay, sumKnown, summariseDay } from "./summary";
import { NO_NUMBERS, normaliseSlot, type DayTotalsRow, type MealRow, type ScreenRead } from "./types";

const read = (over: Partial<ScreenRead>): ScreenRead => ({
  ...NO_NUMBERS,
  screen: "other",
  meal: null,
  dayLabel: "Today",
  diaryMeals: [],
  diaryDayCalories: null,
  ...over,
});

let nextId = 1;
const meal = (over: Partial<MealRow>): MealRow => ({
  id: nextId++,
  slot: "Lunch",
  calories: 500,
  protein_g: 30,
  fibre_g: 5,
  source: "screenshot",
  created_at: "2026-11-14T08:00:00Z",
  ...over,
});

const totals = (over: Partial<DayTotalsRow> = {}): DayTotalsRow => ({
  calories: 1753,
  protein_g: 95.5,
  fibre_g: 25.8,
  updated_at: "2026-11-14T14:30:00Z",
  ...over,
});

const nums = (calories: number | null, protein: number | null, fibre: number | null) => ({
  ...NO_NUMBERS,
  calories,
  protein,
  fibre,
});

describe("normaliseSlot", () => {
  it("matches the standard slots loosely and keeps extras", () => {
    expect(normaliseSlot(" evening  snack ")).toBe("Evening Snack");
    expect(normaliseSlot("Pre Workout")).toBe("Pre Workout");
  });
});

describe("combineReads", () => {
  // The real upload from 14 Nov: duplicates, scrolled copies and an unrelated screen.
  const reads = [
    read({ screen: "insights_all", calories: 282, protein: 16.2, fibre: 0.9 }),
    read({ screen: "insights_all", calories: 1753, protein: 95.5, fibre: 25.8 }),
    read({ screen: "insights_meal", meal: "Breakfast", calories: 282, protein: 16.2, fibre: null }),
    read({ screen: "insights_meal", meal: "Breakfast", calories: 282, protein: 16.2, fibre: 0.9 }),
    read({ screen: "insights_meal", meal: "Lunch", calories: 589, protein: 35.4, fibre: null }),
    read({ screen: "insights_meal", meal: "Dinner", calories: 766, protein: 40.7, fibre: 16 }),
    read({ screen: "insights_meal", meal: "Evening Snack", calories: 117, protein: 3.2, fibre: 2.4 }),
    read({ screen: "diary", diaryMeals: [{ meal: "Breakfast", calories: 283 }, { meal: "Lunch", calories: 0 }] }),
    read({ screen: "diary", diaryMeals: [{ meal: "Lunch", calories: 588 }] }),
    read({ screen: "other", dayLabel: null }),
  ];
  const result = combineReads(reads);

  it("uses the All Meals capture with the most calories and says so", () => {
    expect(result.dayTotals).toMatchObject({ calories: 1753, protein: 95.5, fibre: 25.8 });
    expect(result.notes.join(" ")).toMatch(/All Meals: 2 screenshots showed different numbers/);
  });

  it("merges scrolled copies of the same meal", () => {
    const breakfast = result.meals.find((m) => m.slot === "Breakfast");
    expect(breakfast?.numbers).toMatchObject({ calories: 282, protein: 16.2, fibre: 0.9 });
  });

  it("keeps a cut-off value as unknown, not zero", () => {
    expect(result.meals.find((m) => m.slot === "Lunch")?.numbers.fibre).toBeNull();
  });

  it("orders meals by slot", () => {
    expect(result.meals.map((m) => m.slot)).toEqual(["Breakfast", "Lunch", "Evening Snack", "Dinner"]);
  });

  it("collects Diary calories for cross-checking and reports ignored images", () => {
    expect(result.diaryMeals).toEqual({ Breakfast: 283, Lunch: 588 });
    expect(result.notes.join(" ")).toMatch(/1 image was not a Healthify/);
    expect(result.dayLabels).toEqual(["Today"]);
  });

  it("does not fill gaps from a capture taken at a different time", () => {
    const mixed = combineReads([
      read({ screen: "insights_all", calories: 282, protein: 16.2, fibre: 0.9 }),
      read({ screen: "insights_all", calories: 1753, protein: 95.5, fibre: null }),
    ]);
    expect(mixed.dayTotals?.fibre).toBeNull();
  });

  it("explains when only Diary screens were uploaded", () => {
    const only = combineReads([read({ screen: "diary", diaryMeals: [{ meal: "Lunch", calories: 588 }] })]);
    expect(only.dayTotals).toBeNull();
    expect(only.meals).toEqual([]);
    expect(only.notes.join(" ")).toMatch(/Only Diary screens/);
  });
});

describe("reviewChecks", () => {
  const nothing: Existing = { meals: [], dayTotals: null };

  it("says what will be replaced, including typed entries", () => {
    const existing: Existing = {
      meals: [meal({ slot: "Lunch", source: "manual" }), meal({ slot: "Lunch" }), meal({ slot: "Dinner" })],
      dayTotals: totals(),
    };
    const checks = reviewChecks(
      { dayTotals: nums(1753, 95.5, 25.8), meals: [{ slot: "Lunch", numbers: nums(589, 35.4, 6.5) }] },
      existing,
    );
    expect(checks.meals[0].replaces).toBe("This replaces Lunch, including 1 typed entry");
    expect(checks.dayTotals?.replaces).toBe(true);
  });

  it("replaces nothing on a fresh day", () => {
    const checks = reviewChecks({ dayTotals: null, meals: [{ slot: "Lunch", numbers: nums(589, 35.4, 6.5) }] }, nothing);
    expect(checks.meals[0].replaces).toBeNull();
    expect(checks.blockers).toEqual([]);
  });

  it("flags missing protein or fibre without blocking the save", () => {
    const checks = reviewChecks({ dayTotals: null, meals: [{ slot: "Lunch", numbers: nums(589, 35.4, null) }] }, nothing);
    expect(checks.meals[0].missing).toEqual(["No fibre shown for Lunch"]);
    expect(checks.blockers).toEqual([]);
  });

  it("blocks the save when calories are missing", () => {
    const checks = reviewChecks({ dayTotals: null, meals: [{ slot: "Lunch", numbers: nums(null, 35.4, 6.5) }] }, nothing);
    expect(checks.blockers).toEqual(["Type the calories for Lunch."]);
  });

  it("ignores rounding differences between All Meals and the meal sum", () => {
    // The real day: meals add up to 1,754 against an All Meals total of 1,753.
    const checks = reviewChecks(
      {
        dayTotals: nums(1753, 95.5, 25.8),
        meals: [
          { slot: "Breakfast", numbers: nums(282, 16.2, 0.9) },
          { slot: "Lunch", numbers: nums(589, 35.4, 6.5) },
          { slot: "Evening Snack", numbers: nums(117, 3.2, 2.4) },
          { slot: "Dinner", numbers: nums(766, 40.7, 16) },
        ],
      },
      nothing,
    );
    expect(checks.mismatches).toEqual([]);
  });

  it("flags a real mismatch, counting saved meals that are not in the upload", () => {
    const existing: Existing = { meals: [meal({ slot: "Breakfast", calories: 282, protein_g: 16.2, fibre_g: 0.9 })], dayTotals: null };
    const checks = reviewChecks(
      { dayTotals: nums(1753, 95.5, 25.8), meals: [{ slot: "Lunch", numbers: nums(589, 35.4, 6.5) }] },
      existing,
    );
    expect(checks.mismatches).toHaveLength(3);
    expect(checks.mismatches[0]).toBe("All Meals shows 1753 cal of calories, but the meals add up to 871 cal.");
  });

  it("does not compare a metric that has an unknown meal", () => {
    const checks = reviewChecks(
      { dayTotals: nums(589, 35.4, 6.5), meals: [{ slot: "Lunch", numbers: nums(589, 35.4, null) }] },
      nothing,
    );
    expect(checks.mismatches).toEqual([]);
  });

  it("warns that the saved day total goes out of date without a new All Meals screenshot", () => {
    const checks = reviewChecks(
      { dayTotals: null, meals: [{ slot: "Dinner", numbers: nums(766, 40.7, 16) }] },
      { meals: [], dayTotals: totals() },
    );
    expect(checks.notes.join(" ")).toMatch(/out of date/);
  });

  it("uses the Diary only as a cross-check", () => {
    const checks = reviewChecks(
      { dayTotals: null, meals: [{ slot: "Breakfast", numbers: nums(282, 16.2, 0.9) }, { slot: "Dinner", numbers: nums(766, 40.7, 16) }] },
      nothing,
      { Breakfast: 283, Dinner: 700, Lunch: 588, "Morning Snack": 0 },
    );
    expect(checks.meals[0].diaryNote).toBeNull(); // 283 vs 282 is rounding
    expect(checks.meals[1].diaryNote).toMatch(/Diary shows 700 cal for Dinner/);
    expect(checks.notes).toEqual(["The Diary shows Lunch (588 cal), but there is no Insights screenshot for it."]);
  });

  it("treats an empty meal as clearing the slot", () => {
    const draft = { dayTotals: null, meals: [{ slot: "Morning Snack", numbers: nums(0, 0, 0) }] };
    const checks = reviewChecks(draft, { meals: [meal({ slot: "Morning Snack", source: "manual" })], dayTotals: null });
    expect(checks.meals[0].empty).toBe(true);
    expect(checks.meals[0].replaces).toMatch(/will be removed/);
    expect(toSavePayload(draft)).toMatchObject({ replaceSlots: ["Morning Snack"], meals: [] });
  });

  it("builds the save payload", () => {
    const payload = toSavePayload({
      dayTotals: nums(1753, 95.5, 25.8),
      meals: [{ slot: "Lunch", numbers: nums(589, 35.4, null) }],
    });
    expect(payload.replaceSlots).toEqual(["Lunch"]);
    expect(payload.meals).toEqual([
      { slot: "Lunch", calories: 589, protein_g: 35.4, fibre_g: null, carbs_g: null, fat_g: null, source: "screenshot" },
    ]);
    expect(payload.dayTotals).toMatchObject({ calories: 1753, protein_g: 95.5, fibre_g: 25.8 });
  });
});

describe("summariseDay", () => {
  it("is null when nothing is logged", () => {
    expect(summariseDay([], null)).toBeNull();
  });

  it("never treats a missing number as zero", () => {
    expect(sumKnown([10, null])).toBeNull();
    expect(sumKnown([])).toBeNull();
    expect(sumKnown([0.1, 0.2])).toBe(0.3);
  });

  it("sums meals when there is no All Meals total", () => {
    const day = summariseDay(
      [meal({ slot: "Dinner", calories: 766, protein_g: 40.7, fibre_g: 16 }), meal({ slot: "Breakfast", calories: 282, protein_g: 16.2, fibre_g: null })],
      null,
    );
    expect(day).toMatchObject({ calories: 1048, protein: 56.9, fibre: null, source: "meal_sum", staleTotal: false });
    expect(day?.slots.map((s) => s.slot)).toEqual(["Breakfast", "Dinner"]);
  });

  it("adds typed entries to their slot", () => {
    const day = summariseDay([meal({ slot: "Lunch", calories: 500 }), meal({ slot: "Lunch", calories: 120, source: "manual" })], null);
    expect(day?.slots[0]).toMatchObject({ slot: "Lunch", calories: 620 });
    expect(day?.slots[0].entries).toHaveLength(2);
  });

  it("prefers the All Meals total when it is up to date", () => {
    const day = summariseDay([meal({ calories: 589, created_at: "2026-11-14T14:30:00Z" })], totals());
    expect(day).toMatchObject({ calories: 1753, protein: 95.5, fibre: 25.8, source: "all_meals", staleTotal: false });
  });

  it("falls back to the meal sum when a meal was saved after the All Meals total", () => {
    const day = summariseDay(
      [meal({ calories: 589, created_at: "2026-11-14T08:00:00Z" }), meal({ slot: "Dinner", calories: 766, created_at: "2026-11-14T15:00:00Z" })],
      totals({ calories: 871, updated_at: "2026-11-14T08:00:00Z" }),
    );
    expect(day).toMatchObject({ calories: 1355, source: "meal_sum", staleTotal: true });
  });

  it("fills a gap in the All Meals total from the meal sum", () => {
    const day = summariseDay([meal({ fibre_g: 6.5 })], totals({ fibre_g: null }));
    expect(day).toMatchObject({ calories: 1753, fibre: 6.5, source: "all_meals" });
  });
});

describe("judgeDay", () => {
  const targets: Target[] = [
    { metric: "calories", value: 2000, start_date: "2026-11-01" },
    { metric: "protein", value: 100, start_date: "2026-11-01" },
    { metric: "fibre", value: 25, start_date: "2026-11-01" },
    { metric: "protein", value: 120, start_date: "2026-11-10" },
  ];
  const day = (calories: number | null, protein: number | null, fibre: number | null) => ({
    calories,
    protein,
    fibre,
    source: "meal_sum" as const,
    staleTotal: false,
    slots: [],
  });

  it("shows over-calories live, while the day is still open", () => {
    const result = judgeDay(day(2150, 50, 5), targets, "2026-11-14", "2026-11-14");
    expect(result.calories).toMatchObject({ verdict: "not_met", over: 150, target: 2000 });
    expect(result.protein.verdict).toBe("pending");
    expect(result.fibre.verdict).toBe("pending");
  });

  it("keeps calories pending while under target on an open day", () => {
    expect(judgeDay(day(1500, 50, 5), targets, "2026-11-14", "2026-11-14").calories.verdict).toBe("pending");
  });

  it("judges everything once the day has closed", () => {
    const result = judgeDay(day(2000, 125, 24.9), targets, "2026-11-13", "2026-11-14");
    expect(result.calories.verdict).toBe("met"); // at target counts as met
    expect(result.protein.verdict).toBe("met");
    expect(result.fibre.verdict).toBe("not_met");
  });

  it("marks missing macros as unknown, never as a miss", () => {
    const result = judgeDay(day(1800, null, null), targets, "2026-11-13", "2026-11-14");
    expect(result.protein.verdict).toBe("unknown");
    expect(result.fibre.verdict).toBe("unknown");
    expect(judgeDay(null, targets, "2026-11-13", "2026-11-14").calories.verdict).toBe("unknown");
  });

  it("uses the target that applied on that day", () => {
    expect(judgeDay(day(1800, 105, 30), targets, "2026-11-05", "2026-11-14").protein).toMatchObject({ target: 100, verdict: "met" });
    expect(judgeDay(day(1800, 105, 30), targets, "2026-11-12", "2026-11-14").protein).toMatchObject({ target: 120, verdict: "not_met" });
    expect(judgeDay(day(1800, 105, 30), targets, "2026-10-20", "2026-11-14").protein.verdict).toBe("no_target");
  });
});
