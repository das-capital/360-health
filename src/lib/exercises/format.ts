import type { CardioKind, Exercise, ExerciseType, SetValues } from "./types";

const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/* --------------------------------------------------------------------- sets */

/** The inputs shown when logging a set, by exercise type. */
export type SetField = {
  key: keyof SetValues;
  label: string;
  optional?: boolean;
  whole?: boolean;
};

export function setFields(exercise: Pick<Exercise, "type" | "assisted">): SetField[] {
  switch (exercise.type) {
    case "timed":
      return [{ key: "seconds", label: "Seconds", whole: true }];
    case "plyo":
      return [
        { key: "reps", label: "Jumps", whole: true },
        { key: "box_height_in", label: "Box height (in)", optional: true },
        { key: "weight_kg", label: "Added weight (kg)", optional: true },
      ];
    default:
      return [
        { key: "reps", label: "Reps", whole: true },
        { key: "weight_kg", label: exercise.assisted ? "Assistance (kg)" : "Weight (kg)" },
      ];
  }
}

export const EMPTY_SET: SetValues = { reps: null, weight_kg: null, seconds: null, box_height_in: null };

/**
 * Turn what was typed into set values, or explain what is wrong.
 * Blank optional fields are saved as "not recorded", not zero.
 */
export function parseSet(
  exercise: Pick<Exercise, "type" | "assisted">,
  typed: Partial<Record<keyof SetValues, string>>,
): { ok: true; values: SetValues } | { ok: false; error: string } {
  const values: SetValues = { ...EMPTY_SET };
  for (const field of setFields(exercise)) {
    const text = (typed[field.key] ?? "").trim();
    if (text === "") {
      if (field.optional) continue;
      return { ok: false, error: `Enter ${field.label.toLowerCase()}.` };
    }
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0) {
      return { ok: false, error: `${field.label} must be a number.` };
    }
    if (field.whole && !Number.isInteger(value)) {
      return { ok: false, error: `${field.label} must be a whole number.` };
    }
    // Reps, seconds and box height of zero make no sense; a weight of zero does (bodyweight).
    if (value === 0 && field.key !== "weight_kg") {
      return { ok: false, error: `${field.label} must be above zero.` };
    }
    values[field.key] = value;
  }
  return { ok: true, values };
}

/** One set in words, e.g. "8 × 40 kg", "50 s", "10 jumps, 24 in box". */
export function formatSet(exercise: Pick<Exercise, "type" | "assisted">, set: SetValues): string {
  if (exercise.type === "timed") return `${num.format(set.seconds ?? 0)} s`;
  if (exercise.type === "plyo") {
    const parts = [`${num.format(set.reps ?? 0)} jumps`];
    if (set.box_height_in !== null) parts.push(`${num.format(set.box_height_in)} in box`);
    if (set.weight_kg !== null) parts.push(`+${num.format(set.weight_kg)} kg`);
    return parts.join(", ");
  }
  const weight = num.format(set.weight_kg ?? 0);
  return exercise.assisted
    ? `${num.format(set.reps ?? 0)} reps, ${weight} kg assist`
    : `${num.format(set.reps ?? 0)} × ${weight} kg`;
}

export function typeLabel(type: ExerciseType): string {
  return { strength: "Reps and weight", timed: "Timed hold (seconds)", plyo: "Jumps", cardio: "Cardio" }[type];
}

/* ------------------------------------------------------------------- cardio */

export type CardioField = { key: string; label: string; unit: string; optional?: boolean; whole?: boolean };

/** Cardio is logged once per session; the fields depend on the kind. */
export const CARDIO_FIELDS: Record<CardioKind, CardioField[]> = {
  treadmill: [
    { key: "duration_min", label: "Duration", unit: "min" },
    { key: "distance_km", label: "Distance", unit: "km" },
    { key: "speed_kmh", label: "Speed", unit: "km/h" },
    { key: "incline", label: "Incline", unit: "%", optional: true },
  ],
  cross_trainer: [
    { key: "duration_min", label: "Duration", unit: "min" },
    { key: "distance_km", label: "Distance", unit: "km" },
    { key: "resistance", label: "Resistance level", unit: "", optional: true },
  ],
  hiit: [
    { key: "rounds", label: "Rounds", unit: "rounds", whole: true },
    { key: "work_sec", label: "Work", unit: "s", whole: true },
    { key: "rest_sec", label: "Rest", unit: "s", whole: true },
    { key: "duration_min", label: "Total duration", unit: "min" },
  ],
};

export function parseCardio(
  kind: CardioKind,
  typed: Record<string, string>,
): { ok: true; fields: Record<string, number> } | { ok: false; error: string } {
  const fields: Record<string, number> = {};
  for (const field of CARDIO_FIELDS[kind]) {
    const text = (typed[field.key] ?? "").trim();
    if (text === "") {
      if (field.optional) continue;
      return { ok: false, error: `Enter ${field.label.toLowerCase()}.` };
    }
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0) return { ok: false, error: `${field.label} must be a number.` };
    if (field.whole && !Number.isInteger(value)) {
      return { ok: false, error: `${field.label} must be a whole number.` };
    }
    // Incline, resistance and rest can be zero; the rest cannot.
    if (value === 0 && !field.optional && field.key !== "rest_sec") {
      return { ok: false, error: `${field.label} must be above zero.` };
    }
    fields[field.key] = value;
  }
  return { ok: true, fields };
}

/** One cardio session in words, e.g. "30 min · 4 km · 8 km/h". */
export function formatCardio(kind: CardioKind, fields: Record<string, number>): string {
  return CARDIO_FIELDS[kind]
    .filter((field) => fields[field.key] !== undefined && fields[field.key] !== null)
    .map((field) => {
      const value = num.format(fields[field.key]);
      if (field.key === "incline") return `incline ${value}%`;
      if (field.key === "resistance") return `level ${value}`;
      if (field.key === "work_sec") return `${value} s work`;
      if (field.key === "rest_sec") return `${value} s rest`;
      return `${value} ${field.unit}`;
    })
    .join(" · ");
}
