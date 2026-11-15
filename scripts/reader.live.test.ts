/**
 * Live test of the screenshot reader against the real Healthify screenshots in
 * /test-screenshots. Run with:  npm run test:reader
 *
 * Needs GEMINI_API_KEY in .env.local. It calls the real Gemini API, so it is
 * not part of the normal `npm test`. All 14 screenshots go in ONE request,
 * because the free tier allows only about 20 requests per day per model.
 *
 * The expected numbers below were read by eye from each screenshot.
 * A list of values (e.g. [0.9, null]) means the row is partly cut off by the
 * edge of the screen, so either reading it or leaving it blank is acceptable.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { readScreenshots } from "../src/lib/food/reader";
import type { ScreenRead } from "../src/lib/food/types";

const DIR = join(__dirname, "..", "test-screenshots");
const PREFIX = "WhatsApp Image 2026-11-14 at 8.03.";

type Expected = {
  [K in keyof ScreenRead]?: ScreenRead[K] | ScreenRead[K][];
};

const cases: [file: string, what: string, expected: Expected][] = [
  [
    "39 PM (1).jpeg",
    "All Meals, afternoon, all rows visible",
    { screen: "insights_all", meal: null, dayLabel: "Today", calories: 282, protein: 16.2, fat: 13.9, carbs: 22.2, fibre: 0.9 },
  ],
  [
    "39 PM.jpeg",
    "Diary, afternoon",
    {
      screen: "diary",
      dayLabel: "Today",
      diaryDayCalories: null,
      diaryMeals: [
        { meal: "Breakfast", calories: 283 },
        { meal: "Morning Snack", calories: 0 },
        { meal: "Lunch", calories: 0 },
        { meal: "Evening Snack", calories: 0 },
      ],
    },
  ],
  [
    "40 PM (1).jpeg",
    "All Meals, afternoon, fibre row cut off",
    { screen: "insights_all", calories: 282, protein: 16.2, fat: 13.9, carbs: 22.2, fibre: [null, 0.9] },
  ],
  [
    "40 PM (2).jpeg",
    "Breakfast tab, all rows visible",
    { screen: "insights_meal", meal: "Breakfast", calories: 282, protein: 16.2, fat: 13.9, carbs: 22.2, fibre: 0.9 },
  ],
  [
    "40 PM.jpeg",
    "Breakfast tab, fibre row cut off",
    { screen: "insights_meal", meal: "Breakfast", calories: 282, protein: 16.2, fibre: [null, 0.9] },
  ],
  [
    "41 PM (1).jpeg",
    "Diary top, evening, with day ring",
    { screen: "diary", diaryDayCalories: 283 },
  ],
  ["41 PM (2).jpeg", "Diary middle, evening", { screen: "diary", diaryDayCalories: null }],
  ["41 PM (3).jpeg", "Diary bottom, evening", { screen: "diary", diaryDayCalories: null }],
  ["41 PM.jpeg", "Food item detail page (not a tracked screen)", { screen: "other", calories: null, protein: null }],
  [
    "42 PM (1).jpeg",
    "Breakfast tab, evening",
    { screen: "insights_meal", meal: "Breakfast", calories: 282, protein: 16.2, fibre: 0.9 },
  ],
  [
    "42 PM (2).jpeg",
    "Lunch tab, fibre row partly cut off",
    { screen: "insights_meal", meal: "Lunch", calories: 589, protein: 35.4, fat: 20.5, carbs: 65.3, fibre: [null, 6.5] },
  ],
  [
    "42 PM.jpeg",
    "All Meals, evening",
    { screen: "insights_all", meal: null, calories: 1753, protein: 95.5, fat: 58.6, carbs: 209, fibre: 25.8 },
  ],
  [
    "43 PM (1).jpeg",
    "Dinner tab",
    { screen: "insights_meal", meal: "Dinner", calories: 766, protein: 40.7, fat: 20.7, carbs: 103.3, fibre: 16 },
  ],
  [
    "43 PM.jpeg",
    "Evening Snack tab (page text says only 'Snack')",
    { screen: "insights_meal", meal: "Evening Snack", calories: 117, protein: 3.2, fat: 3.5, carbs: 18.3, fibre: 2.4 },
  ],
];

/** Diary meal headers that must be found, per file (others may or may not be visible). */
const diaryMustInclude: Record<string, { meal: string; calories: number }[]> = {
  "41 PM (1).jpeg": [
    { meal: "Breakfast", calories: 283 },
    { meal: "Morning Snack", calories: 0 },
  ],
  "41 PM (2).jpeg": [
    { meal: "Lunch", calories: 588 },
    { meal: "Evening Snack", calories: 0 },
  ],
  "41 PM (3).jpeg": [
    { meal: "Evening Snack", calories: 117 },
    { meal: "Dinner", calories: 766 },
  ],
};

const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();

describe("screenshot reader against real Healthify screenshots", () => {
  let reads: ScreenRead[] = [];

  beforeAll(async () => {
    expect(apiKey, "GEMINI_API_KEY is missing from .env.local").not.toBe("");
    const images = cases.map(([file]) => ({
      mimeType: "image/jpeg",
      base64: readFileSync(join(DIR, PREFIX + file)).toString("base64"),
    }));
    const result = await readScreenshots(apiKey, images);
    reads = result.reads;
    process.stderr.write(`
Answered by model: ${result.model}
`);
  });

  it.each(cases.map((c, index) => [...c, index] as const))("%s: %s", (file, _what, expected, index) => {
    const read = reads[index];
    expect(read, "no answer for this image").toBeDefined();

    for (const [field, want] of Object.entries(expected)) {
      const got = read[field as keyof ScreenRead];
      if (field !== "diaryMeals" && Array.isArray(want)) {
        expect(want, `${field} was ${JSON.stringify(got)}`).toContainEqual(got);
      } else {
        expect(got, field).toEqual(want);
      }
    }
    for (const must of diaryMustInclude[file] ?? []) {
      expect(read.diaryMeals, "diaryMeals").toContainEqual(must);
    }
  });
});
