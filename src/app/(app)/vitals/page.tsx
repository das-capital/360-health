"use client";

import { useState } from "react";
import { DayPicker } from "@/components/DayPicker";
import { PageHeader } from "@/components/PageHeader";
import { deleteVitals, loadVitals, saveVitals } from "@/lib/daily/db";
import { parseVitals, VITAL_FIELDS, type VitalKey } from "@/lib/daily/rules";
import { useAction, useDayEntry } from "@/lib/daily/useDayEntry";
import { useLogicalToday } from "@/lib/hooks";
import { formatLogicalDate, type LogicalDate } from "@/lib/logical-date";

type Draft = Partial<Record<VitalKey, string>>;

export default function VitalsPage() {
  const today = useLogicalToday();
  const [picked, setPicked] = useState<LogicalDate | null>(null);
  const date = picked ?? today;

  const day = useDayEntry(date, loadVitals);
  const [draft, setDraft] = useState<{ date: LogicalDate; values: Draft } | null>(null);
  const action = useAction(() => {
    setDraft(null);
    day.reload();
  });

  const typed: Draft = draft && draft.date === date ? draft.values : {};
  const entry = day.value?.entry ?? null;
  const previous = day.value?.previous ?? null;

  const save = () => {
    const parsed = parseVitals(typed);
    if ("error" in parsed) return action.setError(parsed.error);
    void action.run(() => saveVitals(date!, parsed.values));
  };

  return (
    <>
      <PageHeader title="Body Vitals" subtitle="Whenever you have time. Fill in any of them." backHref="/more" />

      {!today || !date ? (
        <p className="text-neutral-500">Loading…</p>
      ) : (
        <>
          <DayPicker date={date} today={today} onChange={setPicked} />

          {day.error && <p className="card mb-4 border-red-500/40 text-red-300">Could not load: {day.error}</p>}
          {!day.value && !day.error && <p className="text-neutral-500">Loading…</p>}

          {day.value && (
            <>
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  save();
                }}
              >
                {VITAL_FIELDS.map((field) => {
                  const saved = entry?.[field.key] ?? null;
                  const before = previous?.[field.key] ?? null;
                  return (
                    <label key={field.key} className="card flex items-center gap-3 py-3">
                      <span className="flex-1">
                        <span className="block text-lg">{field.label}</span>
                        <span className="text-sm text-neutral-500">
                          {saved !== null
                            ? `Saved: ${saved} ${field.unit}`
                            : before !== null
                              ? `Last: ${before} ${field.unit}`
                              : "No entry yet"}
                        </span>
                      </span>
                      <input
                        className="field w-28 text-center text-lg"
                        inputMode="decimal"
                        placeholder={field.unit}
                        aria-label={`${field.label} in ${field.unit}`}
                        value={typed[field.key] ?? ""}
                        onChange={(e) => setDraft({ date, values: { ...typed, [field.key]: e.target.value } })}
                      />
                    </label>
                  );
                })}

                {previous && (
                  <p className="text-sm text-neutral-500">“Last” is from {formatLogicalDate(previous.date)}.</p>
                )}
                {action.error && <p className="text-red-400">{action.error}</p>}
                <button
                  type="submit"
                  className="btn-primary h-14 text-lg"
                  disabled={action.busy || Object.values(typed).every((v) => (v ?? "").trim() === "")}
                >
                  {entry ? "Update" : "Save"}
                </button>
              </form>

              {entry && (
                <button
                  type="button"
                  className="mt-6 h-10 text-neutral-500 underline"
                  disabled={action.busy}
                  onClick={() => void action.run(() => deleteVitals(date))}
                >
                  Remove this day’s entry
                </button>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
