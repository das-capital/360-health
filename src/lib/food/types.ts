/** The standard meal slots, in display order. Other slot names are accepted as extras. */
export const MEAL_SLOTS = ["Breakfast", "Morning Snack", "Lunch", "Evening Snack", "Dinner"] as const;

/** Tidy a slot name: match the standard slots ignoring case and spacing, else keep it as an extra. */
export function normaliseSlot(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  const match = MEAL_SLOTS.find((slot) => slot.toLowerCase() === cleaned.toLowerCase());
  return match ?? cleaned;
}

/** Sort position: standard slots first in their order, extras after, alphabetically. */
export function compareSlots(a: string, b: string): number {
  const ia = MEAL_SLOTS.indexOf(a as (typeof MEAL_SLOTS)[number]);
  const ib = MEAL_SLOTS.indexOf(b as (typeof MEAL_SLOTS)[number]);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  return a.localeCompare(b);
}

/** Numbers for a meal or a day. Null always means "not known", never zero. */
export type FoodNumbers = {
  calories: number | null;
  protein: number | null;
  fibre: number | null;
  carbs: number | null;
  fat: number | null;
};

export const NO_NUMBERS: FoodNumbers = {
  calories: null,
  protein: null,
  fibre: null,
  carbs: null,
  fat: null,
};

/** What the reader got out of one screenshot. */
export type ScreenRead = FoodNumbers & {
  /**
   * insights_all  = Insights, "All Meals" tab (day totals)
   * insights_meal = Insights, one meal's tab
   * diary         = the food diary list
   * other         = anything else (ignored)
   */
  screen: "insights_all" | "insights_meal" | "diary" | "other";
  /** For insights_meal: the selected tab. */
  meal: string | null;
  /** The day named in the header, e.g. "Today" or "Yesterday". */
  dayLabel: string | null;
  /** For diary: meal headers that are fully visible, with their calories. */
  diaryMeals: { meal: string; calories: number }[];
  /** For diary: the day's calories from the ring at the top, if visible. */
  diaryDayCalories: number | null;
};

/** A saved meal entry (one row of food_meals). */
export type MealRow = {
  id: number;
  slot: string;
  calories: number | null;
  protein_g: number | null;
  fibre_g: number | null;
  source: "screenshot" | "manual";
  created_at: string;
};

/** Saved day totals (one row of food_day_totals). */
export type DayTotalsRow = {
  calories: number | null;
  protein_g: number | null;
  fibre_g: number | null;
  updated_at: string;
};
