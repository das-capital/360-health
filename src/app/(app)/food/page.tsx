"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { DayPicker } from "@/components/DayPicker";
import { ManualEntry } from "@/components/food/ManualEntry";
import { ReviewScreen } from "@/components/food/ReviewScreen";
import { PageHeader } from "@/components/PageHeader";
import { combineReads, type Extraction } from "@/lib/food/combine";
import { deleteMeal, loadFoodDay, loadTargets } from "@/lib/food/db";
import type { Existing } from "@/lib/food/plan";
import { readScreenshots, type ImageInput } from "@/lib/food/reader";
import { judgeDay, summariseDay, type MetricResult, type SlotSummary } from "@/lib/food/summary";
import { GEMINI_KEY_STORAGE, useDeviceSetting, useLogicalToday } from "@/lib/hooks";
import type { LogicalDate } from "@/lib/logical-date";
import type { Target } from "@/lib/targets";

type Mode =
  | { kind: "view" }
  | { kind: "reading"; count: number }
  | { kind: "review"; extraction: Extraction }
  | { kind: "manual" };

const fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
const show = (value: number | null) => (value === null ? "?" : fmt.format(value));

export default function FoodPage() {
  const today = useLogicalToday();
  const [picked, setPicked] = useState<LogicalDate | null>(null);
  const date = picked ?? today;

  const [mode, setMode] = useState<Mode>({ kind: "view" });
  const [day, setDay] = useState<{ date: LogicalDate; data: Existing } | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [geminiKey] = useDeviceSetting(GEMINI_KEY_STORAGE);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async (forDate: LogicalDate) => {
    try {
      const [data, allTargets] = await Promise.all([loadFoodDay(forDate), loadTargets()]);
      setDay({ date: forDate, data });
      setTargets(allTargets);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    Promise.all([loadFoodDay(date), loadTargets()])
      .then(([data, allTargets]) => {
        if (cancelled) return;
        setDay({ date, data });
        setTargets(allTargets);
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [date]);

  async function onFilesChosen(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = ""; // so the same files can be chosen again
    if (files.length === 0 || !geminiKey) return;

    setMode({ kind: "reading", count: files.length });
    setError(null);
    try {
      // The images live only in memory for this request and are then dropped.
      const images = await Promise.all(files.map(toImageInput));
      const { reads } = await readScreenshots(geminiKey, images);
      setMode({ kind: "review", extraction: combineReads(reads) });
    } catch (e) {
      setError((e as Error).message);
      setMode({ kind: "view" });
    }
  }

  if (!today || !date) return <PageHeader title="Food" />;

  if (mode.kind === "review") {
    return (
      <ReviewScreen
        extraction={mode.extraction}
        initialDate={date}
        today={today}
        onCancel={() => setMode({ kind: "view" })}
        onSaved={(savedDate) => {
          setPicked(savedDate === today ? null : savedDate);
          setMode({ kind: "view" });
          void refresh(savedDate);
        }}
      />
    );
  }

  if (mode.kind === "manual") {
    return (
      <ManualEntry
        date={date}
        onCancel={() => setMode({ kind: "view" })}
        onSaved={() => {
          setMode({ kind: "view" });
          void refresh(date);
        }}
      />
    );
  }

  const data = day && day.date === date ? day.data : null;
  const summary = data ? summariseDay(data.meals, data.dayTotals) : null;
  const result = judgeDay(summary, targets, date, today);
  const reading = mode.kind === "reading";

  return (
    <>
      <PageHeader title="Food" />

      {/* Any past day can be opened and filled in. */}
      <DayPicker date={date} today={today} onChange={(next) => setPicked(next >= today ? null : next)} />

      {error && <p className="card mb-4 border-red-500/40 text-red-300">{error}</p>}

      {!data && !error && <p className="text-neutral-500">Loading…</p>}

      {data && (
        <>
          <section className="card mb-4 flex flex-col gap-4">
            <CaloriesLine result={result.calories} />
            <div className="grid grid-cols-2 gap-3">
              <MacroBox label="Protein" result={result.protein} />
              <MacroBox label="Fibre" result={result.fibre} />
            </div>
            {summary && (
              <p className="text-sm text-neutral-500">
                {summary.source === "all_meals" ? "From the All Meals screenshot." : "Sum of the meals below."}
              </p>
            )}
            {summary?.staleTotal && (
              <p className="rounded-xl border border-amber-500/50 px-3 py-2 text-sm text-amber-200">
                A meal was saved after the last All Meals screenshot, so the sum of meals is used.
                Upload a fresh All Meals screenshot to bring the day total up to date.
              </p>
            )}
          </section>

          <div className="mb-6 flex flex-col gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={onFilesChosen}
            />
            {geminiKey ? (
              <button
                type="button"
                className="btn-primary"
                disabled={reading}
                onClick={() => fileInput.current?.click()}
              >
                {reading
                  ? `Reading ${mode.count} screenshot${mode.count === 1 ? "" : "s"}…`
                  : "Upload Healthify screenshots"}
              </button>
            ) : (
              <Link href="/settings" className="btn-primary">
                Add your Gemini key in Settings to upload
              </Link>
            )}
            <button
              type="button"
              className="btn-secondary"
              disabled={reading}
              onClick={() => setMode({ kind: "manual" })}
            >
              Type a meal instead
            </button>
          </div>

          <h2 className="mb-2 text-lg font-semibold">Meals</h2>
          {!summary || summary.slots.length === 0 ? (
            <p className="text-neutral-500">No meals saved for this day.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {summary.slots.map((slot) => (
                <MealCard
                  key={slot.slot}
                  slot={slot}
                  onDelete={async (id) => {
                    try {
                      await deleteMeal(id);
                      await refresh(date);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function CaloriesLine({ result }: { result: MetricResult & { over: number | null } }) {
  const { value, target, verdict, over } = result;
  const fill = target && value !== null ? Math.min(100, (value / target) * 100) : 0;
  const isOver = over !== null;

  let status = "";
  if (isOver) status = `Over target by ${fmt.format(over)} cal`;
  else if (verdict === "met") status = "Met: at or under target";
  else if (verdict === "unknown") status = "Nothing logged";
  else if (verdict === "no_target") status = "No calorie target set";
  else if (target !== null && value !== null) status = `${fmt.format(target - value)} cal left`;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-neutral-400">Calories</span>
        <span className={`text-sm font-medium ${isOver ? "text-red-400" : verdict === "met" ? "text-emerald-400" : "text-neutral-400"}`}>
          {status}
        </span>
      </div>
      <p className="mt-1 text-3xl font-semibold">
        {value === null ? "0" : fmt.format(value)}
        {target !== null && <span className="text-lg font-normal text-neutral-500"> / {fmt.format(target)}</span>}
      </p>
      {target !== null && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800">
          <div
            className={`h-full rounded-full ${isOver ? "bg-red-500" : "bg-emerald-500"}`}
            style={{ width: `${fill}%` }}
          />
        </div>
      )}
    </div>
  );
}

function MacroBox({ label, result }: { label: string; result: MetricResult }) {
  const { value, target, verdict } = result;
  const text: Record<typeof verdict, string> = {
    met: "Met",
    not_met: "Not met",
    pending: "Judged tomorrow",
    unknown: "Unknown",
    no_target: "No target set",
  };
  const colour: Record<typeof verdict, string> = {
    met: "text-emerald-400",
    not_met: "text-red-400",
    pending: "text-neutral-500",
    unknown: "text-amber-300",
    no_target: "text-neutral-500",
  };
  return (
    <div className="rounded-xl bg-neutral-950/60 p-3">
      <p className="text-sm text-neutral-400">{label}</p>
      <p className="text-xl font-semibold">
        {show(value)} g
        {target !== null && <span className="text-sm font-normal text-neutral-500"> / {fmt.format(target)}</span>}
      </p>
      <p className={`text-sm ${colour[verdict]}`}>{text[verdict]}</p>
    </div>
  );
}

function MealCard({ slot, onDelete }: { slot: SlotSummary; onDelete: (id: number) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="card">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>
          <span className="block text-lg">{slot.slot}</span>
          <span className="text-sm text-neutral-400">
            Protein {show(slot.protein)} g · Fibre {show(slot.fibre)} g
          </span>
        </span>
        <span className="text-xl font-semibold">{show(slot.calories)} cal</span>
      </button>

      {open && (
        <ul className="mt-3 flex flex-col gap-2 border-t border-neutral-800 pt-3">
          {slot.entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-neutral-300">
                {entry.source === "manual" ? "Typed" : "Screenshot"}: {show(entry.calories)} cal, protein{" "}
                {show(entry.protein_g)} g, fibre {show(entry.fibre_g)} g
              </span>
              <button
                type="button"
                className="h-10 rounded-lg border border-neutral-700 px-3 text-red-300 active:bg-neutral-800"
                onClick={() => {
                  if (window.confirm(`Delete this ${slot.slot} entry?`)) void onDelete(entry.id);
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Longest side, in pixels, a screenshot is shrunk to before upload. The test
 * screenshots (630 x 1400) read perfectly, so this keeps text sharp while a
 * full-size phone PNG (several MB) becomes a JPEG of roughly 100-200 KB.
 */
const MAX_SIDE = 1600;

/**
 * Shrink a chosen screenshot and re-encode it as JPEG, in memory only, for the
 * Gemini request. Falls back to the original file if the browser can't do it.
 */
async function toImageInput(file: File): Promise<ImageInput> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const url = canvas.toDataURL("image/jpeg", 0.85);
    return { mimeType: "image/jpeg", base64: url.slice(url.indexOf(",") + 1) };
  } catch {
    return readOriginal(file);
  }
}

/** Read a chosen file into memory as base64, unchanged. */
function readOriginal(file: File): Promise<ImageInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not open ${file.name}.`));
    reader.onload = () => {
      const url = reader.result as string;
      resolve({ mimeType: file.type || "image/jpeg", base64: url.slice(url.indexOf(",") + 1) });
    };
    reader.readAsDataURL(file);
  });
}
