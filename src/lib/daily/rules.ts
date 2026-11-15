/**
 * Rules for the simple daily sections (CLAUDE.md 4.2 to 4.4 and 4.6):
 * what counts as a valid entry, and which colour a number is shown in.
 * Pure logic, no database access.
 */

/** Colour bands for a step count or a sleep score. "none" = plain grey. */
export type Band = "blue" | "green" | "orange" | "red" | "none";

/** Text colour for each band, readable on the dark background. */
export const BAND_TEXT: Record<Band, string> = {
  blue: "text-blue-500",
  green: "text-emerald-400",
  orange: "text-orange-400",
  red: "text-red-400",
  none: "text-neutral-400",
};

/** Steps may fall this far below the target and still show as orange rather than red. */
export const STEPS_ORANGE_SHARE = 0.25;

/**
 * Steps against the target that applied that day:
 * at or above target = green, up to 25% below = orange, further below = red.
 * No target for that day = no colour.
 */
export function stepsBand(count: number, target: number | null): Band {
  if (target === null) return "none";
  if (count >= target) return "green";
  if (count >= target * (1 - STEPS_ORANGE_SHARE)) return "orange";
  return "red";
}

/** Sleep score: above 85 = blue, 80 to 85 = green, 70 to 79 = orange, below 70 = red. */
export function sleepBand(score: number | null): Band {
  if (score === null) return "none";
  if (score > 85) return "blue";
  if (score >= 80) return "green";
  if (score >= 70) return "orange";
  return "red";
}

/** A typed step count: a whole number, zero or more. Null if it is not one. */
export function parseSteps(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, "");
  if (!/^\d{1,6}$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** A typed sleep score: a whole number from 1 to 100. Null if it is not one. */
export function parseScore(text: string): number | null {
  const cleaned = text.trim();
  if (!/^\d{1,3}$/.test(cleaned)) return null;
  const score = Number(cleaned);
  return score >= 1 && score <= 100 ? score : null;
}

export const VITAL_FIELDS = [
  { key: "weight_kg", label: "Weight", unit: "kg" },
  { key: "waist_in", label: "Waist", unit: "in" },
  { key: "chest_in", label: "Chest", unit: "in" },
  { key: "hip_in", label: "Hip", unit: "in" },
  { key: "thigh_in", label: "Thigh", unit: "in" },
] as const;

export type VitalKey = (typeof VITAL_FIELDS)[number]["key"];
export type Vitals = Partial<Record<VitalKey, number>>;

/**
 * Typed body measurements. Any subset may be filled in; blank boxes are left
 * out (never stored as zero). Returns an error message if a filled box is not
 * a positive number, or if nothing was filled in at all.
 */
export function parseVitals(input: Partial<Record<VitalKey, string>>): { values: Vitals } | { error: string } {
  const values: Vitals = {};
  for (const field of VITAL_FIELDS) {
    const text = (input[field.key] ?? "").trim();
    if (text === "") continue;
    const value = Number(text);
    if (!/^\d+(\.\d+)?$/.test(text) || !(value > 0) || value >= 1000) {
      return { error: `${field.label} must be a number above zero.` };
    }
    values[field.key] = value;
  }
  if (Object.keys(values).length === 0) return { error: "Fill in at least one measurement." };
  return { values };
}
