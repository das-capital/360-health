import { normaliseSlot, type ScreenRead } from "./types";

/**
 * The Gemini models used to read screenshots, in order of preference.
 *
 * Google's free tier allows only about 20 requests per day per model, so:
 *  - all screenshots of one upload go in a SINGLE request, and
 *  - if the first model's daily limit is used up, the next one is tried.
 *
 * These are Google's "latest" aliases, so the app keeps working when older
 * models are retired. Change the models here only.
 */
export const GEMINI_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"] as const;

/** How much Gemini "thinks" before answering: "minimal" | "low" | "medium" | "high". */
const THINKING_LEVEL = "minimal";

const endpoint = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const PROMPT = `You are given screenshots from the Healthify (HealthifyMe) food tracking app. Each image is preceded by a label such as "Image 1". For every image, report the numbers printed on it. Report only what is printed in that image. Never estimate, calculate or guess, and never copy a value from one image into another.

Return one entry per image in "screens", in the same order, with "image" set to the image's number.

First decide which screen each image is:

- "insights_all": the Insights screen (header like "Today's Insights") with the "All Meals" tab selected. It shows "Your Calorie Budget" for the whole day.
- "insights_meal": the same Insights screen with one meal's tab selected (Breakfast, Morning Snack, Lunch, Evening Snack, Dinner, or another meal name).
- "diary": the food diary (header like "Today") listing meals, each with a header such as "Breakfast   283 of 538 Cal" and food items underneath.
- "other": anything else, including the detail page of a single food item.

The selected tab is the one drawn in darker, bolder text with a red underline. Decide the meal from the selected tab only, not from the sentences on the page (for example the page may say "Snack" when the selected tab is "Evening Snack").

For insights_all and insights_meal:
- "calories": the first number in the pair under "Your Calorie Budget", e.g. "282 / 2,150 Cal" gives 282. Remove thousands separators.
- "protein", "fat", "carbs", "fibre": in "Macronutrients Breakup" each row reads like "16.2 g/107.5 g". Report the first number (the amount eaten). Ignore the second number (the target) and the percentage.
- "meal": the selected tab's name for insights_meal; null for insights_all.

For diary:
- "diaryMeals": one entry for every meal header whose name and "X of Y Cal" text are both fully visible; report X as the calories. Include meals showing 0.
- "diaryDayCalories": if a ring at the top shows the day total like "283 of 2150 Cal", report 283; otherwise null.
- Do not report food item names. Leave calories, protein, fat, carbs and fibre null.

For every screen:
- "dayLabel": the day named in the header, e.g. "Today" for "Today's Insights" or "Today", "Yesterday", or the date shown. Null if none.
- A value that is not on the screen is null. A row that is cut off by the edge of the screen, hidden behind another element, or not completely readable is null. Never use 0 to mean "not shown".
- For "other", every value is null and diaryMeals is empty.`;

const nullableNumber = { type: "NUMBER", nullable: true };
const nullableString = { type: "STRING", nullable: true };

const SCREEN_SCHEMA = {
  type: "OBJECT",
  properties: {
    image: { type: "INTEGER" },
    screen: { type: "STRING", enum: ["insights_all", "insights_meal", "diary", "other"] },
    meal: nullableString,
    dayLabel: nullableString,
    calories: nullableNumber,
    protein: nullableNumber,
    fibre: nullableNumber,
    carbs: nullableNumber,
    fat: nullableNumber,
    diaryMeals: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { meal: { type: "STRING" }, calories: { type: "NUMBER" } },
        required: ["meal", "calories"],
      },
    },
    diaryDayCalories: nullableNumber,
  },
  required: [
    "image",
    "screen",
    "meal",
    "dayLabel",
    "calories",
    "protein",
    "fibre",
    "carbs",
    "fat",
    "diaryMeals",
    "diaryDayCalories",
  ],
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: { screens: { type: "ARRAY", items: SCREEN_SCHEMA } },
  required: ["screens"],
};

export type ImageInput = { mimeType: string; base64: string };

export class ReaderError extends Error {}

export type ReadResult = {
  /** One entry per image, in the order the images were given. */
  reads: ScreenRead[];
  /** Which model answered. */
  model: string;
};

/**
 * Send all screenshots of one upload to Gemini in a single request and get
 * back the numbers on each. Images are only held in memory for the request;
 * nothing is stored.
 */
export async function readScreenshots(
  apiKey: string,
  images: ImageInput[],
  models: readonly string[] = GEMINI_MODELS,
): Promise<ReadResult> {
  if (images.length === 0) return { reads: [], model: models[0] };

  const body = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          ...images.flatMap((image, index) => [
            { text: `Image ${index + 1}` },
            { inlineData: { mimeType: image.mimeType, data: image.base64 } },
          ]),
          { text: PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      // Reading printed numbers needs no reasoning. Thinking was most of the
      // wait (over a minute for a full upload), so keep it to the minimum.
      thinkingConfig: { thinkingLevel: THINKING_LEVEL },
    },
  });

  let lastError = "Gemini could not read the screenshots.";
  for (const [index, model] of models.entries()) {
    const isLast = index === models.length - 1;
    const outcome = await askModel(model, apiKey, body, isLast);
    if (outcome.ok) return { reads: parse(outcome.payload, images.length), model };
    lastError = outcome.error;
    if (outcome.fatal) break;
  }
  throw new ReaderError(lastError);
}

type Outcome =
  | { ok: true; payload: unknown }
  /** fatal = trying another model will not help (e.g. a bad key). */
  | { ok: false; error: string; fatal: boolean };

/**
 * Ask one model. If it is overloaded or busy and another model is left to
 * try, give up on this one at once rather than waiting through retries:
 * the next model usually answers straight away.
 */
async function askModel(model: string, apiKey: string, body: string, isLast: boolean): Promise<Outcome> {
  let error = "";
  const attempts = isLast ? 3 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await sleep(3000 * attempt);

    let response: Response;
    try {
      response = await fetch(endpoint(model), {
        method: "POST",
        // The key goes in a header, never in the URL.
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body,
      });
    } catch {
      error = "Could not reach Gemini. Check the internet connection.";
      continue;
    }

    if (response.ok) return { ok: true, payload: await response.json() };

    const message = await errorMessage(response);
    if (response.status === 400 && /API key/i.test(message)) {
      return { ok: false, fatal: true, error: "Gemini rejected the API key. Check it in Settings." };
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, fatal: true, error: `Gemini refused the request: ${firstLine(message)}` };
    }
    if (response.status === 429) {
      // A used-up daily allowance will not recover by waiting a few seconds:
      // move straight on to the next model.
      if (/per day/i.test(message)) {
        return {
          ok: false,
          fatal: false,
          error: "Today's free Gemini allowance is used up. Try again tomorrow, or type the numbers in.",
        };
      }
      error = "Gemini is busy (too many requests). Try again in a minute.";
      continue;
    }
    error = `Gemini error ${response.status}: ${firstLine(message)}`;
    if (response.status < 500) return { ok: false, fatal: false, error };
  }
  return { ok: false, fatal: false, error };
}

/* ------------------------------------------------------------------ helpers */

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

function parse(payload: unknown, imageCount: number): ScreenRead[] {
  const text = (payload as GeminiResponse).candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("");
  if (!text) throw new ReaderError("Gemini returned an empty answer.");

  let screens: unknown;
  try {
    screens = JSON.parse(text).screens;
  } catch {
    throw new ReaderError("Gemini returned an answer that could not be understood.");
  }
  if (!Array.isArray(screens)) {
    throw new ReaderError("Gemini returned an answer that could not be understood.");
  }

  // Match answers to images by their number; an image with no answer counts as unreadable.
  const reads: ScreenRead[] = [];
  for (let index = 0; index < imageCount; index++) {
    const raw = screens.find((entry) => entry?.image === index + 1);
    reads.push(raw ? tidy(raw) : tidy({ screen: "other" }));
  }
  return reads;
}

function tidy(raw: Record<string, unknown>): ScreenRead {
  const screen = ["insights_all", "insights_meal", "diary"].includes(raw.screen as string)
    ? (raw.screen as ScreenRead["screen"])
    : "other";
  const isInsights = screen === "insights_all" || screen === "insights_meal";
  const meal = screen === "insights_meal" ? words(raw.meal) : null;

  return {
    // A meal tab we cannot name is useless, so treat it as unreadable.
    screen: screen === "insights_meal" && !meal ? "other" : screen,
    meal: meal ? normaliseSlot(meal) : null,
    dayLabel: words(raw.dayLabel),
    calories: isInsights ? amount(raw.calories) : null,
    protein: isInsights ? amount(raw.protein) : null,
    fibre: isInsights ? amount(raw.fibre) : null,
    carbs: isInsights ? amount(raw.carbs) : null,
    fat: isInsights ? amount(raw.fat) : null,
    diaryMeals:
      screen === "diary" && Array.isArray(raw.diaryMeals)
        ? raw.diaryMeals.flatMap((entry: Record<string, unknown>) => {
            const name = words(entry?.meal);
            const calories = amount(entry?.calories);
            return name && calories !== null ? [{ meal: normaliseSlot(name), calories }] : [];
          })
        : [],
    diaryDayCalories: screen === "diary" ? amount(raw.diaryDayCalories) : null,
  };
}

function amount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function words(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstLine(message: string): string {
  return message.split("\n")[0].slice(0, 200);
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data?.error?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
