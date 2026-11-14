import type { LogicalDate } from "../logical-date";
import { currentUserId, getSupabase } from "../supabase/client";
import type { Target } from "../targets";
import type { Existing, SavePayload } from "./plan";
import type { DayTotalsRow, MealRow } from "./types";

/** Everything saved for one day's food. */
export async function loadFoodDay(date: LogicalDate): Promise<Existing> {
  const db = getSupabase();
  const [meals, totals] = await Promise.all([
    db
      .from("food_meals")
      .select("id, slot, calories, protein_g, fibre_g, source, created_at")
      .eq("date", date)
      .order("created_at"),
    db
      .from("food_day_totals")
      .select("calories, protein_g, fibre_g, updated_at")
      .eq("date", date)
      .maybeSingle(),
  ]);
  if (meals.error) throw new Error(meals.error.message);
  if (totals.error) throw new Error(totals.error.message);
  return { meals: meals.data as MealRow[], dayTotals: totals.data as DayTotalsRow | null };
}

export async function loadTargets(): Promise<Target[]> {
  const { data, error } = await getSupabase().from("targets").select("metric, value, start_date");
  if (error) throw new Error(error.message);
  return data as Target[];
}

/** Save a confirmed review. The replace and the insert happen together or not at all. */
export async function saveFoodUpload(date: LogicalDate, payload: SavePayload): Promise<void> {
  const { error } = await getSupabase().rpc("save_food_day", {
    p_date: date,
    p_replace_slots: payload.replaceSlots,
    p_meals: payload.meals,
    p_day_totals: payload.dayTotals,
  });
  if (error) throw new Error(error.message);
}

/** A typed entry. It adds to the slot; it does not replace what is there. */
export async function addManualMeal(
  date: LogicalDate,
  entry: { slot: string; calories: number; protein: number | null; fibre: number | null },
): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await getSupabase().from("food_meals").insert({
    user_id,
    date,
    slot: entry.slot,
    calories: entry.calories,
    protein_g: entry.protein,
    fibre_g: entry.fibre,
    source: "manual",
  });
  if (error) throw new Error(error.message);
}

export async function deleteMeal(id: number): Promise<void> {
  const { error } = await getSupabase().from("food_meals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
