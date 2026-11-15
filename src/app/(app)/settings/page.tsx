"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ExportSection } from "@/components/ExportSection";
import { NotificationsSection } from "@/components/NotificationsSection";
import { PageHeader } from "@/components/PageHeader";
import { GEMINI_KEY_STORAGE, useDeviceSetting, useLogicalToday } from "@/lib/hooks";
import { formatLogicalDate, isLogicalDate, type LogicalDate } from "@/lib/logical-date";
import { currentUserId, getSupabase } from "@/lib/supabase/client";
import {
  nextTargetAfter,
  TARGET_INFO,
  TARGET_METRICS,
  targetFor,
  type Target,
  type TargetMetric,
} from "@/lib/targets";

export default function SettingsPage() {
  const today = useLogicalToday();
  return (
    <>
      <PageHeader title="Settings" backHref="/more" />
      <div className="flex flex-col gap-8">
        {today && <TargetsSection today={today} />}
        <RemindersSection />
        <NotificationsSection />
        <GeminiKeySection />
        <Section title="Export">
          <ExportSection />
        </Section>
        <Section title="Account">
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={async () => {
              await getSupabase().auth.signOut();
              window.location.replace("/login");
            }}
          >
            Log out
          </button>
        </Section>
      </div>
    </>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-neutral-400">{hint}</p>}
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

/* ---------------------------------------------------------------- Targets */

function TargetsSection({ today }: { today: LogicalDate }) {
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const { data, error } = await getSupabase()
      .from("targets")
      .select("metric, value, start_date");
    if (error) setError(error.message);
    else {
      setTargets(data as Target[]);
      setError(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getSupabase()
      .from("targets")
      .select("metric, value, start_date")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        else setTargets(data as Target[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Section
      title="Targets"
      hint="A new target applies from its start date. Earlier days keep the target they had."
    >
      {error && <p className="text-sm text-red-400">Could not load targets: {error}</p>}
      {!targets && !error && <p className="text-neutral-500">Loading…</p>}
      {targets &&
        TARGET_METRICS.map((metric) => (
          <TargetCard key={metric} metric={metric} targets={targets} today={today} onSaved={reload} />
        ))}
    </Section>
  );
}

function TargetCard({
  metric,
  targets,
  today,
  onSaved,
}: {
  metric: TargetMetric;
  targets: Target[];
  today: LogicalDate;
  onSaved: () => Promise<void>;
}) {
  const info = TARGET_INFO[metric];
  const current = targetFor(targets, metric, today);
  const upcoming = nextTargetAfter(targets, metric, today);

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setValue(current ? String(current.value) : "");
    setStartDate(today);
    setError(null);
    setEditing(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return setError("Enter a number above zero.");
    if (!isLogicalDate(startDate)) return setError("Pick a start date.");

    setBusy(true);
    setError(null);
    try {
      const user_id = await currentUserId();
      // Same metric + same start date replaces that entry; otherwise a new entry is added.
      const { error } = await getSupabase()
        .from("targets")
        .upsert(
          { user_id, metric, value: amount, start_date: startDate },
          { onConflict: "user_id,metric,start_date" },
        );
      if (error) throw new Error(error.message);
      await onSaved();
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-neutral-400">
            {info.label} <span className="text-neutral-500">({info.rule})</span>
          </p>
          <p className="text-2xl font-semibold">
            {current ? `${current.value} ${info.unit}` : "Not set"}
          </p>
          {current && (
            <p className="text-sm text-neutral-500">since {formatLogicalDate(current.start_date)}</p>
          )}
          {upcoming && (
            <p className="text-sm text-amber-300">
              Changes to {upcoming.value} {info.unit} on {formatLogicalDate(upcoming.start_date)}
            </p>
          )}
        </div>
        {!editing && (
          <button type="button" className="btn-secondary" onClick={open}>
            {current ? "Change" : "Set"}
          </button>
        )}
      </div>

      {editing && (
        <form onSubmit={save} className="mt-4 flex flex-col gap-3 border-t border-neutral-800 pt-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-neutral-400">New target ({info.unit})</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              required
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="field"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-neutral-400">Starts on</span>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="field"
            />
          </label>
          {startDate < today && (
            <p className="text-sm text-amber-300">
              This start date is in the past, so days from then on will be judged against this
              target.
            </p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary flex-1">
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn-secondary flex-1" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- Reminders */

const REMINDERS = [
  { column: "reminder_morning", label: "Morning check-in", fallback: "08:00" },
  { column: "reminder_afternoon", label: "Afternoon check-in", fallback: "13:30" },
  { column: "reminder_evening", label: "Evening check-in", fallback: "20:00" },
] as const;

type ReminderColumn = (typeof REMINDERS)[number]["column"];
type ReminderTimes = Record<ReminderColumn, string>;

const DEFAULT_TIMES = Object.fromEntries(
  REMINDERS.map((r) => [r.column, r.fallback]),
) as ReminderTimes;

function RemindersSection() {
  const [times, setTimes] = useState<ReminderTimes | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSupabase()
      .from("user_settings")
      .select("reminder_morning, reminder_afternoon, reminder_evening")
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return setMessage({ ok: false, text: `Could not load: ${error.message}` });
        const loaded = { ...DEFAULT_TIMES };
        // The database returns "08:00:00"; the time input wants "08:00".
        if (data) for (const r of REMINDERS) loaded[r.column] = String(data[r.column]).slice(0, 5);
        setTimes(loaded);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!times) return;
    setBusy(true);
    setMessage(null);
    try {
      const user_id = await currentUserId();
      const { error } = await getSupabase()
        .from("user_settings")
        .upsert({ user_id, ...times, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
      setMessage({ ok: true, text: "Saved." });
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Reminder times"
      hint="Indian time (IST). Each check-in is skipped when there is nothing left to log."
    >
      {!times && !message && <p className="text-neutral-500">Loading…</p>}
      {times && (
        <form onSubmit={save} className="card flex flex-col gap-3">
          {REMINDERS.map((r) => (
            <label key={r.column} className="flex items-center justify-between gap-3">
              <span>{r.label}</span>
              <input
                type="time"
                required
                value={times[r.column]}
                onChange={(e) => setTimes({ ...times, [r.column]: e.target.value })}
                className="field w-36"
              />
            </label>
          ))}
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Saving…" : "Save times"}
          </button>
        </form>
      )}
      {message && (
        <p className={`text-sm ${message.ok ? "text-emerald-400" : "text-red-400"}`}>
          {message.text}
        </p>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------- Gemini key */

function GeminiKeySection() {
  const [savedKey, setSavedKey] = useDeviceSetting(GEMINI_KEY_STORAGE);
  const [draft, setDraft] = useState("");

  function save(event: FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSavedKey(trimmed);
    setDraft("");
  }

  return (
    <Section
      title="Gemini API key"
      hint="Used in Phase 2 to read Healthify screenshots. Stored on this phone only, never in the database."
    >
      <div className="card flex flex-col gap-3">
        {savedKey ? (
          <>
            <p className="text-emerald-400">A key is saved on this device (ends in …{savedKey.slice(-4)}).</p>
            <button type="button" className="btn-secondary" onClick={() => setSavedKey(null)}>
              Remove key
            </button>
          </>
        ) : (
          <form onSubmit={save} className="flex flex-col gap-3">
            <input
              type="password"
              autoComplete="off"
              placeholder="Paste your Gemini API key"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="field"
            />
            <button type="submit" disabled={!draft.trim()} className="btn-primary">
              Save on this device
            </button>
          </form>
        )}
      </div>
    </Section>
  );
}
