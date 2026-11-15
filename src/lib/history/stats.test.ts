import { describe, expect, it } from "vitest";
import type { Exercise } from "../exercises/types";
import type { Target } from "../targets";
import {
  personalBests,
  progression,
  rollingWeek,
  sessionVolume,
  weeklyVolume,
  type LoggedSet,
} from "./exercise-stats";
import { foodDays, metByDate } from "./food-stats";
import { changeOver, dayRange, oneRepMax, streaks, weekStart, windowAverage, windowRate } from "./stats";

describe("windows and averages", () => {
  it("lists days in a range", () => {
    expect(dayRange("2026-11-13", "2026-11-15")).toEqual(["2026-11-13", "2026-11-14", "2026-11-15"]);
  });

  it("averages only the days that have a value", () => {
    const steps = new Map([
      ["2026-11-01", 4000], // outside the 7-day window
      ["2026-11-10", 8000],
      ["2026-11-14", 10000],
    ]);
    expect(windowAverage(steps, "2026-11-14", 7)).toBe(9000);
    expect(windowAverage(steps, "2026-11-14", 31)).toBe(7333.3);
    expect(windowAverage(new Map(), "2026-11-14", 7)).toBeNull();
  });

  it("counts hits out of answered days", () => {
    const done = new Map([
      ["2026-11-12", true],
      ["2026-11-13", false],
      ["2026-11-14", true],
    ]);
    expect(windowRate(done, "2026-11-14", 7)).toEqual({ hits: 2, days: 3, percent: 67 });
    expect(windowRate(new Map(), "2026-11-14", 7).percent).toBeNull();
  });
});

describe("streaks", () => {
  it("counts the current and the best run", () => {
    const done = new Map([
      ["2026-11-08", true],
      ["2026-11-09", true],
      ["2026-11-10", true],
      ["2026-11-11", false],
      ["2026-11-12", true],
      ["2026-11-13", true],
    ]);
    expect(streaks(done, "2026-11-13")).toEqual({ current: 2, best: 3 });
  });

  it("ends a streak on an unanswered day", () => {
    const done = new Map([
      ["2026-11-10", true],
      ["2026-11-12", true],
    ]);
    expect(streaks(done, "2026-11-12")).toEqual({ current: 1, best: 1 });
    expect(streaks(done, "2026-11-13")).toEqual({ current: 0, best: 1 });
  });

  it("does not end the current streak on the newest days still unanswered", () => {
    const done = new Map([
      ["2026-11-12", true],
      ["2026-11-13", true],
    ]);
    expect(streaks(done, "2026-11-15", 2)).toEqual({ current: 2, best: 2 });
  });
});

describe("body vitals change", () => {
  const weights = [
    { date: "2026-08-01", value: 82 },
    { date: "2026-10-10", value: 80 },
    { date: "2026-11-14", value: 78.5 },
  ];

  it("compares the latest entry with the one at least that many days before", () => {
    expect(changeOver(weights, 30)).toBe(-1.5);
    expect(changeOver(weights, 90)).toBe(-3.5);
  });

  it("is unknown without an entry that far back", () => {
    expect(changeOver(weights.slice(1), 90)).toBeNull();
    expect(changeOver([], 30)).toBeNull();
  });
});

describe("one-rep max and weeks", () => {
  it("uses the Epley formula", () => {
    expect(oneRepMax(100, 1)).toBe(100);
    expect(oneRepMax(60, 10)).toBe(80);
    expect(oneRepMax(40, 8)).toBe(50.7);
  });

  it("starts weeks on Monday", () => {
    expect(weekStart("2026-11-15")).toBe("2026-11-09"); // Sunday
    expect(weekStart("2026-11-16")).toBe("2026-11-16"); // Monday
  });
});

const ex = (id: number, over: Partial<Exercise>): Exercise => ({
  id,
  name: `Exercise ${id}`,
  type: "strength",
  base_list: "push",
  assisted: false,
  cardio_kind: null,
  sort_order: id,
  ...over,
});

const press = ex(1, {});
const row = ex(2, { base_list: "pull" });
const assisted = ex(3, { base_list: "pull", assisted: true });
const hang = ex(4, { base_list: "pull", type: "timed" });
const jump = ex(5, { base_list: "plyo", type: "plyo" });
const exercises = new Map([press, row, assisted, hang, jump].map((e) => [e.id, e]));

const set = (date: string, session_id: number, exercise_id: number, values: Partial<LoggedSet>): LoggedSet => ({
  date,
  session_id,
  template: "upper",
  exercise_id,
  reps: null,
  weight_kg: null,
  seconds: null,
  ...values,
});

const sets: LoggedSet[] = [
  set("2026-11-09", 1, 1, { reps: 10, weight_kg: 40 }),
  set("2026-11-09", 1, 1, { reps: 8, weight_kg: 45 }),
  set("2026-11-09", 1, 2, { reps: 10, weight_kg: 30 }),
  set("2026-11-09", 1, 3, { reps: 6, weight_kg: 25 }),
  set("2026-11-09", 1, 4, { seconds: 50 }),
  set("2026-11-13", 2, 1, { reps: 6, weight_kg: 45 }),
  set("2026-11-13", 2, 1, { reps: 12, weight_kg: 40 }),
  set("2026-11-13", 2, 3, { reps: 6, weight_kg: 20 }),
  set("2026-11-13", 2, 4, { seconds: 62 }),
  set("2026-11-14", 3, 5, { reps: 10 }),
];

describe("exercise history", () => {
  it("counts workout days in the last 7 days, by kind", () => {
    const cardio = [{ date: "2026-11-14", exercise_id: 9, fields: {} }];
    expect(rollingWeek(sets, cardio, exercises, "2026-11-15")).toEqual({ any: 3, weights: 2, cardio: 1, plyo: 1 });
    expect(rollingWeek(sets, cardio, exercises, "2026-11-20")).toEqual({ any: 1, weights: 0, cardio: 1, plyo: 1 });
  });

  it("splits volume by the exercise's own list and skips assisted, timed and plyo sets", () => {
    const [week] = weeklyVolume(sets, exercises);
    expect(week.week).toBe("2026-11-09");
    // Press: 400 + 360 + 270 + 480. Row: 300.
    expect(week.volume).toEqual({ push: 1510, pull: 300, leg: 0, total: 1810 });
  });

  it("gives volume per session, newest first, without empty ones", () => {
    const sessions = sessionVolume(sets, exercises);
    expect(sessions.map((s) => [s.session_id, s.volume.total])).toEqual([
      [2, 750],
      [1, 1060],
    ]);
  });

  it("tracks top weight and estimated one-rep max per day", () => {
    expect(progression(sets, press)).toEqual([
      { date: "2026-11-09", top: 45, oneRm: 57 },
      { date: "2026-11-13", top: 45, oneRm: 56 },
    ]);
  });

  it("finds strength personal bests", () => {
    const bests = personalBests(sets, press);
    expect(bests.heaviest).toEqual({ value: 45, date: "2026-11-09", reps: 8 });
    expect(bests.oneRm).toEqual({ value: 57, date: "2026-11-09", reps: 8 });
    expect(bests.repsAtWeight).toEqual([
      { weight: 45, reps: 8, date: "2026-11-09" },
      { weight: 40, reps: 12, date: "2026-11-13" },
    ]);
  });

  it("treats assisted pull-ups as least assistance, with no heaviest weight or one-rep max", () => {
    const bests = personalBests(sets, assisted);
    expect(bests.leastAssistance).toEqual({ value: 20, date: "2026-11-13", reps: 6 });
    expect(bests.heaviest).toBeNull();
    expect(bests.oneRm).toBeNull();
    expect(progression(sets, assisted).map((p) => p.top)).toEqual([25, 20]);
  });

  it("finds the longest dead hang", () => {
    expect(personalBests(sets, hang).longestHold).toEqual({ value: 62, date: "2026-11-13" });
  });
});

describe("food history", () => {
  const targets: Target[] = [
    { metric: "calories", value: 1800, start_date: "2026-11-01" },
    { metric: "protein", value: 100, start_date: "2026-11-01" },
    { metric: "fibre", value: 25, start_date: "2026-11-01" },
  ];
  const meal = (date: string, calories: number, protein: number | null, fibre: number | null, id: number) => ({
    id,
    date,
    slot: "Lunch",
    calories,
    protein_g: protein,
    fibre_g: fibre,
    source: "manual" as const,
    created_at: `${date}T08:00:00Z`,
  });
  const meals = [
    meal("2026-11-12", 1700, 110, 30, 1),
    meal("2026-11-13", 1900, 90, null, 2),
    meal("2026-11-15", 900, 40, 10, 3),
  ];
  const days = foodDays(meals, [], targets, "2026-11-15");

  it("judges each day against the targets", () => {
    expect(days.map((d) => d.result.calories.verdict)).toEqual(["met", "not_met", "pending"]);
  });

  it("leaves open and unknown days out of hit rates", () => {
    expect([...metByDate(days, "calories", "2026-11-15")]).toEqual([
      ["2026-11-12", true],
      ["2026-11-13", false],
    ]);
    // Fibre is unknown on the 13th and today is still open.
    expect([...metByDate(days, "fibre", "2026-11-15")]).toEqual([["2026-11-12", true]]);
  });
});
