import { describe, expect, it } from "vitest";
import { EMPTY_SET, formatCardio, formatSet, parseCardio, parseSet, setFields } from "./format";
import { exercisesFor, isTemplate, templateLabel, type Exercise } from "./types";

let id = 1;
const ex = (name: string, base_list: Exercise["base_list"], over: Partial<Exercise> = {}): Exercise => ({
  id: id++,
  name,
  type: "strength",
  base_list,
  assisted: false,
  cardio_kind: null,
  sort_order: 1,
  ...over,
});

const all = [
  ex("Dumbbell Press", "push", { sort_order: 1 }),
  ex("Cable Flies", "push", { sort_order: 4 }),
  ex("Lat Pulldown", "pull", { sort_order: 1 }),
  ex("Dead Hang", "pull", { sort_order: 19, type: "timed" }),
  ex("Barbell Squat", "leg", { sort_order: 2 }),
  ex("Box Jump", "plyo", { type: "plyo" }),
  ex("HIIT", "cardio", { type: "cardio", cardio_kind: "hiit" }),
];

const names = (list: Exercise[]) => list.map((e) => e.name);

describe("templates", () => {
  it("shows a base list for Push, Pull, Leg and Plyometrics", () => {
    expect(names(exercisesFor("push", all))).toEqual(["Dumbbell Press", "Cable Flies"]);
    expect(names(exercisesFor("plyo", all))).toEqual(["Box Jump"]);
  });

  it("combines lists for Upper, Lower and Full Body", () => {
    expect(names(exercisesFor("upper", all))).toEqual(["Dumbbell Press", "Cable Flies", "Lat Pulldown", "Dead Hang"]);
    expect(names(exercisesFor("lower", all))).toEqual(names(exercisesFor("leg", all)));
    expect(names(exercisesFor("full", all))).toEqual([
      "Dumbbell Press",
      "Cable Flies",
      "Lat Pulldown",
      "Dead Hang",
      "Barbell Squat",
    ]);
  });

  it("puts an exercise added to a base list into every template that uses it", () => {
    const withNew = [...all, ex("Incline Press", "push", { sort_order: 14 })];
    for (const template of ["push", "upper", "full"] as const) {
      expect(names(exercisesFor(template, withNew))).toContain("Incline Press");
    }
    expect(names(exercisesFor("pull", withNew))).not.toContain("Incline Press");
  });

  it("never mixes cardio into a lifting template", () => {
    expect(names(exercisesFor("full", all))).not.toContain("HIIT");
  });

  it("recognises template keys", () => {
    expect(isTemplate("upper")).toBe(true);
    expect(isTemplate("cardio")).toBe(false);
    expect(isTemplate(null)).toBe(false);
    expect(templateLabel("full")).toBe("Full Body");
  });
});

describe("sets", () => {
  const strength = { type: "strength", assisted: false } as const;
  const assisted = { type: "strength", assisted: true } as const;
  const timed = { type: "timed", assisted: false } as const;
  const plyo = { type: "plyo", assisted: false } as const;

  it("asks for the right inputs per type", () => {
    expect(setFields(strength).map((f) => f.label)).toEqual(["Reps", "Weight (kg)"]);
    expect(setFields(assisted).map((f) => f.label)).toEqual(["Reps", "Assistance (kg)"]);
    expect(setFields(timed).map((f) => f.label)).toEqual(["Seconds"]);
    expect(setFields(plyo).map((f) => f.label)).toEqual(["Jumps", "Box height (in)", "Added weight (kg)"]);
  });

  it("parses a strength set", () => {
    expect(parseSet(strength, { reps: "8", weight_kg: "42.5" })).toEqual({
      ok: true,
      values: { ...EMPTY_SET, reps: 8, weight_kg: 42.5 },
    });
  });

  it("allows zero weight (bodyweight) but not zero reps", () => {
    expect(parseSet(strength, { reps: "10", weight_kg: "0" }).ok).toBe(true);
    expect(parseSet(strength, { reps: "0", weight_kg: "40" })).toEqual({ ok: false, error: "Reps must be above zero." });
  });

  it("rejects missing or odd values", () => {
    expect(parseSet(strength, { reps: "8" })).toEqual({ ok: false, error: "Enter weight (kg)." });
    expect(parseSet(strength, { reps: "8.5", weight_kg: "40" })).toEqual({ ok: false, error: "Reps must be a whole number." });
    expect(parseSet(strength, { reps: "-1", weight_kg: "40" }).ok).toBe(false);
  });

  it("logs a dead hang in seconds only", () => {
    expect(parseSet(timed, { seconds: "50" })).toEqual({ ok: true, values: { ...EMPTY_SET, seconds: 50 } });
    expect(parseSet(timed, {}).ok).toBe(false);
  });

  it("keeps blank plyometric extras as not recorded", () => {
    expect(parseSet(plyo, { reps: "10" })).toEqual({ ok: true, values: { ...EMPTY_SET, reps: 10 } });
    expect(parseSet(plyo, { reps: "10", box_height_in: "24", weight_kg: "5" })).toEqual({
      ok: true,
      values: { ...EMPTY_SET, reps: 10, box_height_in: 24, weight_kg: 5 },
    });
  });

  it("describes sets in words", () => {
    expect(formatSet(strength, { ...EMPTY_SET, reps: 8, weight_kg: 42.5 })).toBe("8 × 42.5 kg");
    expect(formatSet(assisted, { ...EMPTY_SET, reps: 6, weight_kg: 20 })).toBe("6 reps, 20 kg assist");
    expect(formatSet(timed, { ...EMPTY_SET, seconds: 60 })).toBe("60 s");
    expect(formatSet(plyo, { ...EMPTY_SET, reps: 10 })).toBe("10 jumps");
    expect(formatSet(plyo, { ...EMPTY_SET, reps: 10, box_height_in: 24, weight_kg: 5 })).toBe("10 jumps, 24 in box, +5 kg");
  });
});

describe("cardio", () => {
  it("requires everything except incline on the treadmill", () => {
    expect(parseCardio("treadmill", { duration_min: "30", distance_km: "4", speed_kmh: "8" })).toEqual({
      ok: true,
      fields: { duration_min: 30, distance_km: 4, speed_kmh: 8 },
    });
    expect(parseCardio("treadmill", { duration_min: "30", distance_km: "4" })).toEqual({
      ok: false,
      error: "Enter speed.",
    });
  });

  it("treats cross trainer resistance as optional", () => {
    expect(parseCardio("cross_trainer", { duration_min: "20", distance_km: "3" }).ok).toBe(true);
    expect(parseCardio("cross_trainer", { duration_min: "20", distance_km: "3", resistance: "7" })).toEqual({
      ok: true,
      fields: { duration_min: 20, distance_km: 3, resistance: 7 },
    });
  });

  it("needs rounds, work, rest and total for HIIT", () => {
    expect(parseCardio("hiit", { rounds: "8", work_sec: "40", rest_sec: "20", duration_min: "8" }).ok).toBe(true);
    expect(parseCardio("hiit", { rounds: "8.5", work_sec: "40", rest_sec: "20", duration_min: "8" }).ok).toBe(false);
    expect(parseCardio("hiit", { rounds: "8", work_sec: "40", duration_min: "8" })).toEqual({
      ok: false,
      error: "Enter rest.",
    });
  });

  it("describes cardio in words", () => {
    expect(formatCardio("treadmill", { duration_min: 30, distance_km: 4, speed_kmh: 8, incline: 2 })).toBe(
      "30 min · 4 km · 8 km/h · incline 2%",
    );
    expect(formatCardio("cross_trainer", { duration_min: 20, distance_km: 3 })).toBe("20 min · 3 km");
    expect(formatCardio("hiit", { rounds: 8, work_sec: 40, rest_sec: 20, duration_min: 8 })).toBe(
      "8 rounds · 40 s work · 20 s rest · 8 min",
    );
  });
});
