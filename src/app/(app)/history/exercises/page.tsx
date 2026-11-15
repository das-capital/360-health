"use client";

import { useState } from "react";
import { Chart, CHART_COLORS, type ChartPoint } from "@/components/history/Chart";
import { LoadState, Section, Stat, Tabs } from "@/components/history/parts";
import { PageHeader } from "@/components/PageHeader";
import { useDayEntry } from "@/lib/daily/useDayEntry";
import { CARDIO_FIELDS, formatCardio } from "@/lib/exercises/format";
import { LIST_LABEL, templateLabel, type Exercise } from "@/lib/exercises/types";
import { loadExerciseHistory } from "@/lib/history/db";
import {
  personalBests,
  progression,
  rollingWeek,
  sessionVolume,
  weeklyVolume,
  type CardioLog,
  type LoggedSet,
} from "@/lib/history/exercise-stats";
import { useLogicalToday } from "@/lib/hooks";
import { addDays, daysBetween, formatLogicalDate, type LogicalDate } from "@/lib/logical-date";

const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
const shortDate = (date: LogicalDate) => formatLogicalDate(date).replace(/,? \d{4}$/, "");

type VolumeKey = "total" | "push" | "pull" | "leg";

const VOLUME_TABS: { key: VolumeKey; label: string }[] = [
  { key: "total", label: "All" },
  { key: "push", label: "Push" },
  { key: "pull", label: "Pull" },
  { key: "leg", label: "Legs" },
];

function VolumeSection({ sets, exercises }: { sets: LoggedSet[]; exercises: Map<number, Exercise> }) {
  const [list, setList] = useState<VolumeKey>("total");
  const weeks = weeklyVolume(sets, exercises);
  const sessions = sessionVolume(sets, exercises);
  if (weeks.length === 0) {
    return <p className="card text-neutral-400">No weighted sets logged yet. Volume is sets × reps × weight.</p>;
  }
  const first = weeks[0].week;
  const points: ChartPoint[] = weeks.map((w) => ({
    x: daysBetween(first, w.week) / 7,
    value: w.volume[list],
    label: `Week of ${shortDate(w.week)}`,
  }));

  return (
    <>
      <Tabs options={VOLUME_TABS} value={list} onChange={setList} />
      <div className="card mb-3">
        <p className="mb-1 text-sm text-neutral-400">Weekly volume (weeks start on Monday)</p>
        <Chart
          key={list}
          points={points}
          slots={daysBetween(first, weeks[weeks.length - 1].week) / 7 + 1}
          kind="bar"
          format={(v) => `${number.format(v)} kg`}
        />
      </div>
      <div className="card">
        <p className="mb-2 text-sm text-neutral-400">Recent sessions</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className="pb-1 font-normal">Session</th>
              <th className="pb-1 text-right font-normal">Push</th>
              <th className="pb-1 text-right font-normal">Pull</th>
              <th className="pb-1 text-right font-normal">Legs</th>
              <th className="pb-1 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {sessions.slice(0, 10).map((s) => (
              <tr key={s.session_id} className="border-t border-neutral-800 tabular-nums">
                <td className="py-1.5">
                  {shortDate(s.date)}
                  <span className="block text-xs text-neutral-500">{templateLabel(s.template)}</span>
                </td>
                <td className="py-1.5 text-right">{number.format(s.volume.push)}</td>
                <td className="py-1.5 text-right">{number.format(s.volume.pull)}</td>
                <td className="py-1.5 text-right">{number.format(s.volume.leg)}</td>
                <td className="py-1.5 text-right font-semibold">{number.format(s.volume.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-neutral-500">
          In kg. Assisted Pull-up, Dead Hang and plyometrics are not counted in volume.
        </p>
      </div>
    </>
  );
}

function ExerciseSection({ sets, exercises }: { sets: LoggedSet[]; exercises: Exercise[] }) {
  // Only exercises that have been logged, most recently done first.
  const lastDone = new Map<number, LogicalDate>();
  for (const set of sets) {
    const known = lastDone.get(set.exercise_id);
    if (!known || set.date > known) lastDone.set(set.exercise_id, set.date);
  }
  const logged = exercises
    .filter((e) => lastDone.has(e.id) && e.type !== "cardio")
    .sort(
      (a, b) =>
        // Plyometrics have little to chart, so they come after the lifts.
        Number(a.type === "plyo") - Number(b.type === "plyo") ||
        lastDone.get(b.id)!.localeCompare(lastDone.get(a.id)!) ||
        a.name.localeCompare(b.name),
    );

  const [pickedId, setPickedId] = useState<number | null>(null);
  const [measure, setMeasure] = useState<"top" | "oneRm">("top");

  if (logged.length === 0) return <p className="card text-neutral-400">No sets logged yet.</p>;
  const exercise = logged.find((e) => e.id === pickedId) ?? logged[0];
  const points = progression(sets, exercise);
  const bests = personalBests(sets, exercise);

  const plain = exercise.type === "strength" && !exercise.assisted;
  const unit = exercise.type === "timed" ? "s" : "kg";
  const topLabel = exercise.type === "timed" ? "Longest hold" : exercise.assisted ? "Least assistance" : "Top weight";
  const shown = plain ? measure : "top";
  const first = points[0]?.date;

  const chartPoints: ChartPoint[] = first
    ? points.map((p) => ({
        x: daysBetween(first, p.date),
        value: shown === "oneRm" ? p.oneRm : p.top,
        label: formatLogicalDate(p.date),
        color: CHART_COLORS.plain,
      }))
    : [];

  return (
    <>
      <label className="mb-3 flex flex-col gap-1">
        <span className="text-sm text-neutral-400">Exercise</span>
        <select className="field" value={exercise.id} onChange={(e) => setPickedId(Number(e.target.value))}>
          {logged.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({LIST_LABEL[e.base_list]})
            </option>
          ))}
        </select>
      </label>

      {plain && (
        <Tabs
          options={[
            { key: "top", label: "Top weight" },
            { key: "oneRm", label: "Est. one-rep max" },
          ]}
          value={measure}
          onChange={setMeasure}
        />
      )}

      <div className="card mb-3">
        <p className="mb-1 text-sm text-neutral-400">
          {shown === "oneRm" ? "Estimated one-rep max" : topLabel} per day
          {exercise.type === "plyo" ? " (added weight)" : ""}
        </p>
        <Chart
          key={`${exercise.id}-${shown}`}
          points={chartPoints}
          slots={first ? daysBetween(first, points[points.length - 1].date) + 1 : 1}
          kind="line"
          format={(v) => `${number.format(v)} ${unit}`}
          empty={exercise.type === "plyo" ? "No added weight logged for this exercise." : "Nothing to chart yet."}
        />
        {exercise.assisted && (
          <p className="mt-2 text-xs text-neutral-500">For this exercise the number is the assistance, so lower is better.</p>
        )}
      </div>

      {exercise.type !== "plyo" && (
        <div className="card">
          <p className="mb-2 text-sm text-neutral-400">Personal bests</p>
          <ul className="flex flex-col gap-2 text-sm">
            {bests.heaviest && (
              <li className="flex justify-between gap-3">
                <span>Heaviest weight</span>
                <span className="text-right tabular-nums">
                  <b>{number.format(bests.heaviest.value)} kg</b> × {bests.heaviest.reps}
                  <span className="block text-xs text-neutral-500">{shortDate(bests.heaviest.date)}</span>
                </span>
              </li>
            )}
            {bests.oneRm && (
              <li className="flex justify-between gap-3">
                <span>Best estimated one-rep max</span>
                <span className="text-right tabular-nums">
                  <b>{number.format(bests.oneRm.value)} kg</b>
                  <span className="block text-xs text-neutral-500">{shortDate(bests.oneRm.date)}</span>
                </span>
              </li>
            )}
            {bests.leastAssistance && (
              <li className="flex justify-between gap-3">
                <span>Least assistance</span>
                <span className="text-right tabular-nums">
                  <b>{number.format(bests.leastAssistance.value)} kg</b> × {bests.leastAssistance.reps}
                  <span className="block text-xs text-neutral-500">{shortDate(bests.leastAssistance.date)}</span>
                </span>
              </li>
            )}
            {bests.longestHold && (
              <li className="flex justify-between gap-3">
                <span>Longest hold</span>
                <span className="text-right tabular-nums">
                  <b>{number.format(bests.longestHold.value)} s</b>
                  <span className="block text-xs text-neutral-500">{shortDate(bests.longestHold.date)}</span>
                </span>
              </li>
            )}
          </ul>
          {bests.repsAtWeight.length > 0 && (
            <>
              <p className="mb-1 mt-4 text-sm text-neutral-400">Most reps at each weight</p>
              <table className="w-full text-sm tabular-nums">
                <tbody>
                  {bests.repsAtWeight.slice(0, 8).map((row) => (
                    <tr key={row.weight} className="border-t border-neutral-800">
                      <td className="py-1.5">{number.format(row.weight)} kg</td>
                      <td className="py-1.5 text-right font-semibold">{row.reps} reps</td>
                      <td className="py-1.5 text-right text-xs text-neutral-500">{shortDate(row.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </>
  );
}

function CardioSection({ cardio, exercises }: { cardio: CardioLog[]; exercises: Exercise[] }) {
  const kinds = exercises.filter((e) => e.type === "cardio" && cardio.some((c) => c.exercise_id === e.id));
  const [pickedId, setPickedId] = useState<number | null>(null);
  if (kinds.length === 0) return <p className="card text-neutral-400">No cardio logged yet.</p>;

  const exercise = kinds.find((e) => e.id === pickedId) ?? kinds[0];
  const sessions = cardio
    .filter((c) => c.exercise_id === exercise.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = sessions[0].date;
  const slots = daysBetween(first, sessions[sessions.length - 1].date) + 1;
  const fields = exercise.cardio_kind ? CARDIO_FIELDS[exercise.cardio_kind] : [];

  // One point per day: several sessions on a day are added together.
  const series = (key: string): ChartPoint[] => {
    const byDay = new Map<LogicalDate, number>();
    for (const s of sessions) {
      const value = s.fields[key];
      if (typeof value === "number") byDay.set(s.date, (byDay.get(s.date) ?? 0) + value);
    }
    return [...byDay.entries()].map(([date, value]) => ({
      x: daysBetween(first, date),
      value: Math.round(value * 100) / 100,
      label: formatLogicalDate(date),
    }));
  };

  return (
    <>
      {kinds.length > 1 && (
        <Tabs options={kinds.map((e) => ({ key: String(e.id), label: e.name }))} value={String(exercise.id)} onChange={(k) => setPickedId(Number(k))} />
      )}
      {kinds.length === 1 && <p className="mb-2 font-medium">{exercise.name}</p>}

      {[
        { key: "duration_min", title: "Duration", unit: "min" },
        { key: "distance_km", title: "Distance", unit: "km" },
      ]
        .filter((chart) => fields.some((f) => f.key === chart.key))
        .map((chart) => (
          <div key={chart.key} className="card mb-3">
            <p className="mb-1 text-sm text-neutral-400">{chart.title} per day</p>
            <Chart
              key={`${exercise.id}-${chart.key}`}
              points={series(chart.key)}
              slots={slots}
              kind="line"
              fromZero
              format={(v) => `${number.format(v)} ${chart.unit}`}
            />
          </div>
        ))}

      <div className="card">
        <p className="mb-2 text-sm text-neutral-400">Recent sessions</p>
        <ul className="flex flex-col gap-1.5 text-sm">
          {[...sessions]
            .reverse()
            .slice(0, 8)
            .map((s, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-neutral-400">{shortDate(s.date)}</span>
                <span className="text-right">
                  {exercise.cardio_kind ? formatCardio(exercise.cardio_kind, s.fields) : ""}
                </span>
              </li>
            ))}
        </ul>
      </div>
    </>
  );
}

export default function ExercisesHistoryPage() {
  const today = useLogicalToday();
  const history = useDayEntry(today, loadExerciseHistory);

  const body = () => {
    if (!today || !history.value) return null;
    const { exercises, sets, cardio } = history.value;
    const byId = new Map(exercises.map((e) => [e.id, e]));
    const week = rollingWeek(sets, cardio, byId, today);

    return (
      <>
        <Section title="Last 7 days">
          <div className="card mb-2">
            <p className="text-3xl font-semibold tabular-nums">
              {week.any}
              <span className="text-base font-normal text-neutral-400">
                {" "}
                {week.any === 1 ? "day" : "days"} with a workout
              </span>
            </p>
            <p className="text-sm text-neutral-500">
              {shortDate(addDays(today, -6))} to {shortDate(today)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Weights" value={week.weights} note={week.weights === 1 ? "day" : "days"} />
            <Stat label="Cardio" value={week.cardio} note={week.cardio === 1 ? "day" : "days"} />
            <Stat label="Plyometrics" value={week.plyo} note={week.plyo === 1 ? "day" : "days"} />
          </div>
        </Section>

        <Section title="Progression and personal bests">
          <ExerciseSection sets={sets} exercises={exercises} />
        </Section>

        <Section title="Volume">
          <VolumeSection sets={sets} exercises={byId} />
        </Section>

        <Section title="Cardio">
          <CardioSection cardio={cardio} exercises={exercises} />
        </Section>
      </>
    );
  };

  return (
    <>
      <PageHeader title="Exercises history" backHref="/history" />
      <LoadState loading={!history.value} error={history.error} />
      {body()}
    </>
  );
}
