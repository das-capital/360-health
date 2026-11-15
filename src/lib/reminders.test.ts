import { describe, expect, it } from "vitest";
import {
  buildReminder,
  DEFAULT_TIMES,
  dueReminders,
  istMinutes,
  istMoment,
  reminderDays,
  type LoggedState,
} from "./reminders";

const ist = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`);

const nothing: LoggedState = {
  stepsYesterday: false,
  sleep: false,
  mobilityYesterday: false,
  foodSavedAt: null,
  stepsSavedAt: null,
  exercise: false,
};

const afternoonAt = ist("2026-11-15", "13:30");

describe("timing", () => {
  it("reads the IST clock whatever the server timezone", () => {
    expect(istMinutes(new Date("2026-11-15T02:30:00Z"))).toBe(8 * 60);
    expect(istMinutes(ist("2026-11-15", "13:30"))).toBe(13 * 60 + 30);
  });

  it("is not due before its time", () => {
    expect(dueReminders(ist("2026-11-15", "07:59"), DEFAULT_TIMES, [])).toEqual([]);
  });

  it("is due from its time, for up to an hour", () => {
    expect(dueReminders(ist("2026-11-15", "08:00"), DEFAULT_TIMES, [])).toEqual(["morning"]);
    expect(dueReminders(ist("2026-11-15", "08:59"), DEFAULT_TIMES, [])).toEqual(["morning"]);
    expect(dueReminders(ist("2026-11-15", "09:00"), DEFAULT_TIMES, [])).toEqual([]);
  });

  it("goes out once per day", () => {
    expect(dueReminders(ist("2026-11-15", "08:05"), DEFAULT_TIMES, ["morning"])).toEqual([]);
    expect(dueReminders(ist("2026-11-15", "20:02"), DEFAULT_TIMES, ["morning", "afternoon"])).toEqual(["evening"]);
  });

  it("follows edited reminder times", () => {
    const times = { ...DEFAULT_TIMES, evening: "21:15" };
    expect(dueReminders(ist("2026-11-15", "20:30"), times, [])).toEqual([]);
    expect(dueReminders(ist("2026-11-15", "21:15"), times, [])).toEqual(["evening"]);
  });

  it("uses the 4 am logical day", () => {
    expect(reminderDays(ist("2026-11-15", "08:00"))).toEqual({ today: "2026-11-15", yesterday: "2026-11-14" });
    expect(reminderDays(ist("2026-11-16", "02:00"))).toEqual({ today: "2026-11-15", yesterday: "2026-11-14" });
  });

  it("places a reminder time on a logical day", () => {
    expect(istMoment("2026-11-15", "13:30:00").toISOString()).toBe("2026-11-15T08:00:00.000Z");
  });
});

describe("morning check-in", () => {
  it("asks for everything that is missing, in one notification", () => {
    expect(buildReminder("morning", nothing, afternoonAt)).toEqual({
      title: "Morning check-in",
      body: "To log: yesterday’s steps, last night’s sleep score and yesterday’s mobility.",
      url: "/",
      tag: "morning",
    });
  });

  it("leaves out what is already logged", () => {
    const body = buildReminder("morning", { ...nothing, stepsYesterday: true, mobilityYesterday: true }, afternoonAt)?.body;
    expect(body).toBe("To log: last night’s sleep score.");
  });

  it("is skipped when all three are done", () => {
    const done = { ...nothing, stepsYesterday: true, sleep: true, mobilityYesterday: true };
    expect(buildReminder("morning", done, afternoonAt)).toBeNull();
  });
});

describe("afternoon check-in", () => {
  it("asks for food and steps and opens Food", () => {
    const reminder = buildReminder("afternoon", nothing, afternoonAt);
    expect(reminder?.body).toBe("To log: food so far (Healthify screenshots) and steps so far.");
    expect(reminder?.url).toBe("/food");
  });

  it("skips an item logged at any time today", () => {
    const fed = { ...nothing, foodSavedAt: ist("2026-11-15", "09:00") };
    expect(buildReminder("afternoon", fed, afternoonAt)).toMatchObject({ body: "To log: steps so far.", url: "/steps" });
  });

  it("is skipped when both are logged", () => {
    const both = { ...nothing, foodSavedAt: ist("2026-11-15", "09:00"), stepsSavedAt: ist("2026-11-15", "13:00") };
    expect(buildReminder("afternoon", both, afternoonAt)).toBeNull();
  });
});

describe("evening check-in", () => {
  it("still asks for food and steps that were only logged before the afternoon check-in", () => {
    const lunchOnly = {
      ...nothing,
      foodSavedAt: ist("2026-11-15", "13:10"),
      stepsSavedAt: ist("2026-11-15", "13:10"),
      exercise: true,
    };
    expect(buildReminder("evening", lunchOnly, afternoonAt)).toMatchObject({
      body: "To log: today’s food (Healthify screenshots) and today’s steps.",
      url: "/food",
    });
  });

  it("skips food and steps saved since the afternoon check-in", () => {
    const updated = { ...nothing, foodSavedAt: ist("2026-11-15", "19:40"), stepsSavedAt: ist("2026-11-15", "13:30") };
    expect(buildReminder("evening", updated, afternoonAt)).toMatchObject({
      body: "To log: exercise, or “Did nothing today”.",
      url: "/exercises",
    });
  });

  it("stops asking about exercise once a workout or rest day is logged", () => {
    const body = buildReminder("evening", { ...nothing, exercise: true }, afternoonAt)?.body;
    expect(body).not.toMatch(/exercise/);
  });

  it("is skipped when everything is in", () => {
    const done = {
      ...nothing,
      foodSavedAt: ist("2026-11-15", "19:40"),
      stepsSavedAt: ist("2026-11-15", "19:45"),
      exercise: true,
    };
    expect(buildReminder("evening", done, afternoonAt)).toBeNull();
  });
});
