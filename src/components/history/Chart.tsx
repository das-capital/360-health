"use client";

import { useState, type ReactNode } from "react";

export type ChartPoint = {
  /** Horizontal position, from 0 to `slots - 1` (usually a day number). */
  x: number;
  /** Null draws nothing (a gap). */
  value: number | null;
  /** Shown when the point is tapped, e.g. the date. */
  label: string;
  /** Mark colour (hex). */
  color?: string;
  /** The target that applied at this point, if any. */
  target?: number | null;
};

export const CHART_COLORS = {
  blue: "#3b82f6",
  green: "#34d399",
  orange: "#fb923c",
  red: "#f87171",
  none: "#a3a3a3",
  plain: "#38bdf8",
} as const;

const W = 320;
const H = 150;
const PAD = { left: 6, right: 6, top: 10, bottom: 6 };

/**
 * A small bar or line chart with an optional dashed target line.
 * Tap anywhere on it to read the nearest value.
 */
export function Chart({
  points,
  slots,
  kind,
  format,
  fromZero = kind === "bar",
  empty = "Nothing logged in this period.",
}: {
  points: ChartPoint[];
  /** How many horizontal positions there are (e.g. days in the range). */
  slots: number;
  kind: "bar" | "line";
  format: (value: number) => string;
  /** Start the scale at zero (bars always should). */
  fromZero?: boolean;
  empty?: ReactNode;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const drawn = points.filter((p) => p.value !== null) as (ChartPoint & { value: number })[];

  if (drawn.length === 0) return <p className="py-6 text-center text-neutral-500">{empty}</p>;

  const targets = points.filter((p) => p.target != null) as (ChartPoint & { target: number })[];
  const all = [...drawn.map((p) => p.value), ...targets.map((p) => p.target)];
  let top = Math.max(...all);
  let bottom = fromZero ? 0 : Math.min(...all);
  if (top === bottom) {
    top += 1;
    bottom = fromZero ? 0 : bottom - 1;
  }
  const pad = (top - bottom) * 0.08;
  top += pad;
  if (!fromZero) bottom -= pad;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const step = plotW / Math.max(slots, 1);
  const px = (x: number) => PAD.left + step * (x + 0.5);
  const py = (v: number) => PAD.top + plotH * (1 - (v - bottom) / (top - bottom));

  const barWidth = Math.max(1.5, Math.min(step - 2, 16));
  const current = selected !== null ? drawn.find((p) => p.x === selected) : undefined;

  const pick = (clientX: number, box: DOMRect) => {
    const x = ((clientX - box.left) / box.width) * W;
    let nearest = drawn[0];
    for (const p of drawn) if (Math.abs(px(p.x) - x) < Math.abs(px(nearest.x) - x)) nearest = p;
    setSelected(nearest.x);
  };

  // Lines break wherever a slot between two points has an explicit gap (null).
  const gaps = new Set(points.filter((p) => p.value === null).map((p) => p.x));
  const segments: (typeof drawn)[] = [];
  if (kind === "line") {
    let run: typeof drawn = [];
    let previous: number | null = null;
    for (const p of drawn) {
      const broken = previous !== null && [...gaps].some((g) => g > previous! && g < p.x);
      if (broken && run.length > 0) {
        segments.push(run);
        run = [];
      }
      run.push(p);
      previous = p.x;
    }
    if (run.length > 0) segments.push(run);
  }
  const dotRadius = drawn.length > 60 ? 1.5 : drawn.length > 31 ? 2.5 : 4;

  return (
    <div>
      <p className="mb-1 min-h-6 text-sm text-neutral-300" aria-live="polite">
        {current ? (
          <>
            <span className="text-neutral-400">{current.label}:</span>{" "}
            <span className="font-semibold text-neutral-100">{format(current.value)}</span>
            {current.target != null && <span className="text-neutral-500"> · target {format(current.target)}</span>}
          </>
        ) : (
          <span className="text-neutral-600">Tap the chart to read a value</span>
        )}
      </p>
      <div className="flex gap-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-pan-y select-none"
          role="img"
          aria-label="Chart. Tap to read values."
          onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerMove={(e) => e.buttons > 0 && pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        >
          {[top, (top + bottom) / 2, bottom].map((v, i) => (
            <line key={i} x1={PAD.left} x2={W - PAD.right} y1={py(v)} y2={py(v)} stroke="#262626" strokeWidth={1} />
          ))}

          {current && (
            <line x1={px(current.x)} x2={px(current.x)} y1={PAD.top} y2={H - PAD.bottom} stroke="#525252" strokeWidth={1} />
          )}

          {kind === "bar" &&
            drawn.map((p) => {
              const y = py(p.value);
              const height = Math.max(py(bottom) - y, 1.5);
              return (
                <rect
                  key={p.x}
                  x={px(p.x) - barWidth / 2}
                  y={py(bottom) - height}
                  width={barWidth}
                  height={height}
                  rx={Math.min(3, barWidth / 2)}
                  fill={p.color ?? CHART_COLORS.plain}
                  opacity={current && current.x !== p.x ? 0.55 : 1}
                />
              );
            })}

          {kind === "line" && (
            <>
              {segments.map((run, i) => (
                <polyline
                  key={i}
                  points={run.map((p) => `${px(p.x)},${py(p.value)}`).join(" ")}
                  fill="none"
                  stroke="#737373"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {drawn.map((p) => (
                <circle
                  key={p.x}
                  cx={px(p.x)}
                  cy={py(p.value)}
                  r={current?.x === p.x ? dotRadius + 2 : dotRadius}
                  fill={p.color ?? CHART_COLORS.plain}
                  stroke="#0a0a0a"
                  strokeWidth={dotRadius > 2 ? 1.5 : 0}
                />
              ))}
            </>
          )}

          {targets.length > 0 && (
            <path
              // A step line: each day shows the target that applied on that day,
              // and days without a target show no line at all.
              d={targets
                .map((p, i) => {
                  const joined = i > 0 && targets[i - 1].x === p.x - 1;
                  return `${joined ? "L" : "M"}${px(p.x) - step / 2},${py(p.target)} L${px(p.x) + step / 2},${py(p.target)}`;
                })
                .join(" ")}
              fill="none"
              stroke="#e5e5e5"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              opacity={0.7}
            />
          )}
        </svg>
        <div className="flex w-12 shrink-0 flex-col justify-between py-1 text-right text-xs text-neutral-500">
          <span>{format(roundNice(top))}</span>
          <span>{format(roundNice((top + bottom) / 2))}</span>
          <span>{format(roundNice(bottom))}</span>
        </div>
      </div>
      {targets.length > 0 && <p className="mt-1 text-xs text-neutral-500">Dashed line: target</p>}
    </div>
  );
}

function roundNice(value: number): number {
  const abs = Math.abs(value);
  if (abs >= 1000) return Math.round(value / 100) * 100;
  if (abs >= 100) return Math.round(value / 10) * 10;
  if (abs >= 10) return Math.round(value);
  return Math.round(value * 10) / 10;
}
