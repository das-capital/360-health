"use client";

import { useEffect, useMemo, useState } from "react";
import type { Extraction } from "@/lib/food/combine";
import { loadFoodDay, saveFoodUpload } from "@/lib/food/db";
import { reviewChecks, toSavePayload, type Existing, type ReviewDraft } from "@/lib/food/plan";
import type { FoodNumbers } from "@/lib/food/types";
import { formatLogicalDate, isLogicalDate, type LogicalDate } from "@/lib/logical-date";

/** The three numbers the user can edit, held as text while typing. */
type Typed = { calories: string; protein: string; fibre: string };

const toTyped = (n: FoodNumbers): Typed => ({
  calories: n.calories?.toString() ?? "",
  protein: n.protein?.toString() ?? "",
  fibre: n.fibre?.toString() ?? "",
});

/** Blank means "not known". Anything that is not a sensible number also counts as blank. */
function toNumber(text: string): number | null {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

const merge = (original: FoodNumbers, typed: Typed): FoodNumbers => ({
  ...original,
  calories: toNumber(typed.calories),
  protein: toNumber(typed.protein),
  fibre: toNumber(typed.fibre),
});

/**
 * Review screen for an upload. Shows what was read, what is missing and what
 * will be replaced. Every number and the date can be edited. Nothing is saved
 * until Confirm is pressed.
 */
export function ReviewScreen({
  extraction,
  initialDate,
  today,
  onSaved,
  onCancel,
}: {
  extraction: Extraction;
  initialDate: LogicalDate;
  today: LogicalDate;
  onSaved: (date: LogicalDate) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [dayTyped, setDayTyped] = useState<Typed | null>(
    extraction.dayTotals ? toTyped(extraction.dayTotals) : null,
  );
  const [mealsTyped, setMealsTyped] = useState<Typed[]>(extraction.meals.map((m) => toTyped(m.numbers)));
  const [existing, setExisting] = useState<{ date: LogicalDate; data: Existing } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateOk = isLogicalDate(date) && date <= today;

  // What is already saved for the chosen day decides the "replaces" messages.
  useEffect(() => {
    if (!dateOk) return;
    let cancelled = false;
    loadFoodDay(date)
      .then((data) => !cancelled && setExisting({ date, data }))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [date, dateOk]);

  const saved = existing && existing.date === date ? existing.data : null;

  const draft: ReviewDraft = useMemo(
    () => ({
      dayTotals: extraction.dayTotals && dayTyped ? merge(extraction.dayTotals, dayTyped) : null,
      meals: extraction.meals.map((m, i) => ({ slot: m.slot, numbers: merge(m.numbers, mealsTyped[i]) })),
    }),
    [extraction, dayTyped, mealsTyped],
  );

  const checks = useMemo(
    () => (saved ? reviewChecks(draft, saved, extraction.diaryMeals) : null),
    [draft, saved, extraction.diaryMeals],
  );

  const oddLabels = extraction.dayLabels.filter((label) => !/today/i.test(label));

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await saveFoodUpload(date, toSavePayload(draft));
      onSaved(date);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">Review before saving</h2>
        <p className="text-neutral-400">Check the numbers. Nothing is saved until you confirm.</p>
      </div>

      <label className="card flex flex-col gap-1.5">
        <span className="text-sm text-neutral-400">Day these screenshots belong to</span>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          className="field"
        />
        {dateOk && <span className="text-sm text-neutral-500">{formatLogicalDate(date)}</span>}
        {!dateOk && <span className="text-sm text-red-400">Pick a day that is not in the future.</span>}
        {oddLabels.length > 0 && (
          <span className="text-sm text-amber-300">
            Healthify’s header says “{oddLabels.join("”, “")}”. Make sure the day above is right.
          </span>
        )}
      </label>

      {extraction.notes.map((note) => (
        <Notice key={note} tone="info" text={note} />
      ))}

      {dayTyped && (
        <section className="card flex flex-col gap-3">
          <h3 className="text-lg font-semibold">Day total (All Meals)</h3>
          <NumberRow value={dayTyped} onChange={setDayTyped} />
          {checks?.dayTotals?.replaces && <Notice tone="replace" text="This replaces the saved day total." />}
          {checks?.dayTotals?.missing.map((text) => <Notice key={text} tone="missing" text={`${text}. Type it in if you know it.`} />)}
          {checks?.mismatches.map((text) => <Notice key={text} tone="missing" text={text} />)}
        </section>
      )}

      {extraction.meals.map((meal, index) => {
        const check = checks?.meals[index];
        return (
          <section key={meal.slot} className="card flex flex-col gap-3">
            <h3 className="text-lg font-semibold">{meal.slot}</h3>
            <NumberRow
              value={mealsTyped[index]}
              onChange={(next) => setMealsTyped(mealsTyped.map((m, i) => (i === index ? next : m)))}
            />
            {check?.replaces && <Notice tone="replace" text={`${check.replaces}.`} />}
            {check?.empty && !check.replaces && (
              <Notice tone="info" text={`Healthify shows nothing for ${meal.slot}. Nothing will be saved for it.`} />
            )}
            {check?.missing.map((text) => <Notice key={text} tone="missing" text={`${text}. Type it in if you know it.`} />)}
            {check?.diaryNote && <Notice tone="info" text={check.diaryNote} />}
          </section>
        );
      })}

      {checks?.notes.map((note) => <Notice key={note} tone="info" text={note} />)}

      {!saved && dateOk && !error && <p className="text-neutral-500">Checking what is already saved…</p>}
      {checks?.blockers.map((text) => <p key={text} className="text-sm text-red-400">{text}</p>)}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary flex-1"
          disabled={busy || !dateOk || !checks || checks.blockers.length > 0}
          onClick={confirm}
        >
          {busy ? "Saving…" : "Confirm and save"}
        </button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>
          Discard
        </button>
      </div>
    </div>
  );
}

function NumberRow({ value, onChange }: { value: Typed; onChange: (next: Typed) => void }) {
  const fields = [
    { key: "calories", label: "Calories" },
    { key: "protein", label: "Protein (g)" },
    { key: "fibre", label: "Fibre (g)" },
  ] as const;
  return (
    <div className="grid grid-cols-3 gap-2">
      {fields.map((field) => (
        <label key={field.key} className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">{field.label}</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="?"
            value={value[field.key]}
            onChange={(e) => onChange({ ...value, [field.key]: e.target.value })}
            className={`field px-2 text-center ${value[field.key] === "" ? "border-amber-500/70" : ""}`}
          />
        </label>
      ))}
    </div>
  );
}

function Notice({ tone, text }: { tone: "info" | "missing" | "replace"; text: string }) {
  const styles = {
    info: "border-neutral-700 text-neutral-300",
    missing: "border-amber-500/50 text-amber-200",
    replace: "border-sky-500/50 text-sky-200",
  };
  return <p className={`rounded-xl border px-3 py-2 text-sm ${styles[tone]}`}>{text}</p>;
}
