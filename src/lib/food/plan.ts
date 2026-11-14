import { sumKnown } from "./summary";
import type { DayTotalsRow, FoodNumbers, MealRow } from "./types";

/** The (possibly edited) numbers on the review screen. */
export type ReviewDraft = {
  dayTotals: FoodNumbers | null;
  meals: { slot: string; numbers: FoodNumbers }[];
};

/** What is already saved for the chosen day. */
export type Existing = {
  meals: MealRow[];
  dayTotals: DayTotalsRow | null;
};

export type MealCheck = {
  slot: string;
  /** Healthify shows nothing eaten for this meal; saving clears the slot. */
  empty: boolean;
  /** e.g. "This replaces Lunch, including 1 typed entry", or null if nothing is replaced. */
  replaces: string | null;
  /** e.g. ["No fibre shown for Lunch"]. */
  missing: string[];
  /** Set when the Diary disagrees noticeably with Insights. */
  diaryNote: string | null;
};

export type ReviewChecks = {
  meals: MealCheck[];
  dayTotals: { replaces: boolean; missing: string[] } | null;
  /** Day total versus the sum of meals, after this save. */
  mismatches: string[];
  /** Other things worth knowing before confirming. */
  notes: string[];
  /** Reasons the save cannot go ahead yet. Empty when Confirm is allowed. */
  blockers: string[];
};

/** Differences up to this size are rounding inside Healthify and are not flagged. */
const CALORIE_TOLERANCE = 5;
const GRAM_TOLERANCE = 1;

const isEmpty = (n: FoodNumbers) => n.calories === 0 && !n.protein && !n.fibre;

/**
 * Work out everything the review screen has to tell the user: what will be
 * replaced, what is missing, and where numbers disagree. Pure: no saving here.
 */
export function reviewChecks(
  draft: ReviewDraft,
  existing: Existing,
  diaryMeals: Record<string, number> = {},
): ReviewChecks {
  const blockers: string[] = [];
  const notes: string[] = [];

  const meals: MealCheck[] = draft.meals.map(({ slot, numbers }) => {
    const saved = existing.meals.filter((m) => m.slot === slot);
    const typed = saved.filter((m) => m.source === "manual").length;
    const empty = isEmpty(numbers);

    let replaces: string | null = null;
    if (saved.length > 0) {
      replaces = `This replaces ${slot}`;
      if (typed > 0) replaces += `, including ${typed} typed ${typed === 1 ? "entry" : "entries"}`;
      if (empty) replaces = `Healthify shows nothing for ${slot}, so its saved ${saved.length === 1 ? "entry" : "entries"} will be removed`;
    }

    const missing: string[] = [];
    if (!empty) {
      if (numbers.calories === null) {
        missing.push(`No calories shown for ${slot}`);
        blockers.push(`Type the calories for ${slot}.`);
      }
      if (numbers.protein === null) missing.push(`No protein shown for ${slot}`);
      if (numbers.fibre === null) missing.push(`No fibre shown for ${slot}`);
    }

    const diary = diaryMeals[slot];
    const diaryNote =
      diary !== undefined && numbers.calories !== null && Math.abs(diary - numbers.calories) > CALORIE_TOLERANCE
        ? `The Diary shows ${diary} cal for ${slot}. The Insights number is used.`
        : null;

    return { slot, empty, replaces, missing, diaryNote };
  });

  let dayTotals: ReviewChecks["dayTotals"] = null;
  if (draft.dayTotals) {
    const missing: string[] = [];
    if (draft.dayTotals.calories === null) {
      missing.push("No calories shown for the day");
      blockers.push("Type the day's calories.");
    }
    if (draft.dayTotals.protein === null) missing.push("No protein shown for the day");
    if (draft.dayTotals.fibre === null) missing.push("No fibre shown for the day");
    dayTotals = { replaces: existing.dayTotals !== null, missing };
  }

  if (!draft.dayTotals && draft.meals.length === 0) blockers.push("There is nothing to save.");

  // The meals as they will be after this save: untouched saved meals plus the new ones.
  const replaced = new Set(draft.meals.map((m) => m.slot));
  const after = [
    ...existing.meals
      .filter((m) => !replaced.has(m.slot))
      .map((m) => ({ calories: m.calories, protein: m.protein_g, fibre: m.fibre_g })),
    ...draft.meals.filter((m) => !isEmpty(m.numbers)).map((m) => m.numbers),
  ];

  const mismatches: string[] = [];
  if (draft.dayTotals && after.length > 0) {
    const compare = (
      label: string,
      unit: string,
      total: number | null,
      sum: number | null,
      tolerance: number,
    ) => {
      if (total === null || sum === null || Math.abs(total - sum) <= tolerance) return;
      mismatches.push(`All Meals shows ${total} ${unit} of ${label}, but the meals add up to ${sum} ${unit}.`);
    };
    compare("calories", "cal", draft.dayTotals.calories, sumKnown(after.map((m) => m.calories)), CALORIE_TOLERANCE);
    compare("protein", "g", draft.dayTotals.protein, sumKnown(after.map((m) => m.protein)), GRAM_TOLERANCE);
    compare("fibre", "g", draft.dayTotals.fibre, sumKnown(after.map((m) => m.fibre)), GRAM_TOLERANCE);
  }

  if (!draft.dayTotals && existing.dayTotals && draft.meals.length > 0) {
    notes.push(
      "No All Meals screenshot in this upload. The saved day total will be out of date, so the day will use the sum of meals until you upload a fresh All Meals screenshot.",
    );
  }

  // Meals the Diary shows as eaten that have no numbers anywhere.
  const known = new Set([...replaced, ...existing.meals.map((m) => m.slot)]);
  for (const [slot, calories] of Object.entries(diaryMeals)) {
    if (calories > 0 && !known.has(slot)) {
      notes.push(`The Diary shows ${slot} (${calories} cal), but there is no Insights screenshot for it.`);
    }
  }

  return { meals, dayTotals, mismatches, notes, blockers };
}

/** The exact changes to send to the database for a confirmed review. */
export type SavePayload = {
  replaceSlots: string[];
  meals: {
    slot: string;
    calories: number | null;
    protein_g: number | null;
    fibre_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    source: "screenshot";
  }[];
  dayTotals: {
    calories: number | null;
    protein_g: number | null;
    fibre_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  } | null;
};

export function toSavePayload(draft: ReviewDraft): SavePayload {
  const columns = (n: FoodNumbers) => ({
    calories: n.calories,
    protein_g: n.protein,
    fibre_g: n.fibre,
    carbs_g: n.carbs,
    fat_g: n.fat,
  });
  return {
    // Every uploaded meal replaces its slot; an empty one just clears it.
    replaceSlots: draft.meals.map((m) => m.slot),
    meals: draft.meals
      .filter((m) => !isEmpty(m.numbers))
      .map((m) => ({ slot: m.slot, ...columns(m.numbers), source: "screenshot" as const })),
    dayTotals: draft.dayTotals ? columns(draft.dayTotals) : null,
  };
}
