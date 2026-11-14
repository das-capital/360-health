import { compareSlots, type FoodNumbers, type ScreenRead } from "./types";

/** Everything learned from one upload, after sorting out which screenshot is which. */
export type Extraction = {
  /** From the Insights "All Meals" tab, if one was uploaded. */
  dayTotals: FoodNumbers | null;
  /** From the Insights per-meal tabs, one per meal. */
  meals: { slot: string; numbers: FoodNumbers }[];
  /** Meal calories seen in Diary screenshots (cross-check only, never saved). */
  diaryMeals: Record<string, number>;
  /** The day names seen in the headers, e.g. ["Today"]. */
  dayLabels: string[];
  /** Things the user should know about, in plain words. */
  notes: string[];
};

const FIELDS = ["calories", "protein", "fibre", "carbs", "fat"] as const;

/**
 * Turn the per-image readings into one result.
 *
 * The same screen is often captured more than once (scrolled differently, or
 * at different times of day). For each screen the capture with the most
 * calories wins, because calories only go up during a day, and gaps in it are
 * filled from other captures that show the same calories.
 */
export function combineReads(reads: ScreenRead[]): Extraction {
  const notes: string[] = [];

  const ignored = reads.filter((r) => r.screen === "other").length;
  if (ignored > 0) {
    notes.push(
      ignored === 1
        ? "1 image was not a Healthify Insights or Diary screen and was ignored."
        : `${ignored} images were not Healthify Insights or Diary screens and were ignored.`,
    );
  }

  const dayTotals = pickBest(
    reads.filter((r) => r.screen === "insights_all"),
    "All Meals",
    notes,
  );

  const slots = [
    ...new Set(reads.filter((r) => r.screen === "insights_meal").map((r) => r.meal as string)),
  ].sort(compareSlots);
  const meals = slots.flatMap((slot) => {
    const numbers = pickBest(
      reads.filter((r) => r.screen === "insights_meal" && r.meal === slot),
      slot,
      notes,
    );
    return numbers ? [{ slot, numbers }] : [];
  });

  const diaryMeals: Record<string, number> = {};
  for (const read of reads) {
    for (const entry of read.diaryMeals) {
      diaryMeals[entry.meal] = Math.max(diaryMeals[entry.meal] ?? 0, entry.calories);
    }
  }

  const dayLabels = [
    ...new Set(reads.flatMap((r) => (r.screen !== "other" && r.dayLabel ? [r.dayLabel] : []))),
  ];

  if (!dayTotals && meals.length === 0) {
    notes.push(
      Object.keys(diaryMeals).length > 0
        ? "Only Diary screens were found. Numbers are saved from the Insights screens, so add those."
        : "No Healthify Insights screens were found in these images.",
    );
  }

  return { dayTotals, meals, diaryMeals, dayLabels, notes };
}

function pickBest(captures: ScreenRead[], label: string, notes: string[]): FoodNumbers | null {
  if (captures.length === 0) return null;

  const best = captures.reduce((a, b) => ((b.calories ?? -1) > (a.calories ?? -1) ? b : a));
  const numbers: FoodNumbers = {
    calories: best.calories,
    protein: best.protein,
    fibre: best.fibre,
    carbs: best.carbs,
    fat: best.fat,
  };

  // Fill gaps from other captures of the same moment (same calories, scrolled differently).
  for (const other of captures) {
    if (other === best || other.calories !== best.calories) continue;
    for (const field of FIELDS) numbers[field] ??= other[field];
  }

  const distinct = new Set(captures.map((c) => c.calories));
  if (distinct.size > 1) {
    notes.push(
      `${label}: ${captures.length} screenshots showed different numbers. ` +
        `The one with the most calories (${best.calories ?? "none"}) was used.`,
    );
  }
  return numbers;
}
