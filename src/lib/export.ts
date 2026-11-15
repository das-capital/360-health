import { allRows } from "./history/db";

/**
 * "Export my data" (CLAUDE.md section 7). Everything the user has logged,
 * read straight from the database. The Gemini key (device only) and the
 * notification subscriptions are deliberately not part of it.
 */

type Row = Record<string, unknown>;

/** The tables that hold the user's data, and how to order each. */
const TABLES: { name: string; orderBy: string }[] = [
  { name: "targets", orderBy: "start_date" },
  { name: "food_meals", orderBy: "id" },
  { name: "food_day_totals", orderBy: "date" },
  { name: "steps", orderBy: "date" },
  { name: "sleep", orderBy: "date" },
  { name: "mobility", orderBy: "date" },
  { name: "exercises", orderBy: "id" },
  { name: "workout_sessions", orderBy: "id" },
  { name: "sets", orderBy: "id" },
  { name: "cardio_sessions", orderBy: "id" },
  { name: "rest_days", orderBy: "date" },
  { name: "body_vitals", orderBy: "date" },
  { name: "user_settings", orderBy: "user_id" },
];

export type Backup = { exported_at: string; app: string; tables: Record<string, Row[]> };

/** Every table, complete, without the internal user id column. */
export async function loadBackup(): Promise<Backup> {
  const loaded = await Promise.all(TABLES.map((t) => allRows<Row>(t.name, "*", t.orderBy)));
  const tables: Record<string, Row[]> = {};
  TABLES.forEach((table, i) => {
    tables[table.name] = loaded[i].map((row) => {
      const rest = { ...row };
      delete rest.user_id;
      return rest;
    });
  });
  return { exported_at: new Date().toISOString(), app: "360 Health", tables };
}

/**
 * Spreadsheet-friendly versions of the tables. Sets and cardio get the date
 * and the exercise name added, so each file reads on its own.
 */
export function csvFiles(backup: Backup): { name: string; label: string; rows: Row[] }[] {
  const t = backup.tables;
  const exerciseName = new Map(t.exercises.map((e) => [e.id, e.name]));
  const session = new Map(t.workout_sessions.map((s) => [s.id, s]));

  const sets = t.sets.map((s) => ({
    date: session.get(s.session_id)?.date ?? "",
    template: session.get(s.session_id)?.template ?? "",
    exercise: exerciseName.get(s.exercise_id) ?? "",
    set_no: s.set_no,
    reps: s.reps,
    weight_kg: s.weight_kg,
    seconds: s.seconds,
    box_height_in: s.box_height_in,
  }));
  sets.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const cardio = t.cardio_sessions.map((c) => ({
    date: c.date,
    exercise: exerciseName.get(c.exercise_id) ?? "",
    ...(c.fields as Row),
  }));

  return [
    { name: "food_meals", label: "Food: meals", rows: t.food_meals },
    { name: "food_day_totals", label: "Food: day totals", rows: t.food_day_totals },
    { name: "steps", label: "Steps", rows: t.steps },
    { name: "sleep", label: "Sleep", rows: t.sleep },
    { name: "mobility", label: "Mobility", rows: t.mobility },
    { name: "exercise_sets", label: "Exercise sets", rows: sets },
    { name: "cardio", label: "Cardio", rows: cardio },
    { name: "rest_days", label: "Rest days", rows: t.rest_days },
    { name: "body_vitals", label: "Body Vitals", rows: t.body_vitals },
    { name: "targets", label: "Targets", rows: t.targets },
  ];
}

/** Rows as CSV text. Columns are the union of all keys, in first-seen order. */
export function toCsv(rows: Row[]): string {
  const columns: string[] = [];
  for (const row of rows) for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  const cell = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns.join(","), ...rows.map((row) => columns.map((c) => cell(row[c])).join(","))].join("\r\n");
}

/** Hand a file to the browser to save. */
export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
