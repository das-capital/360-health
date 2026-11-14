import type { LogicalDate } from "./logical-date";

export const TARGET_METRICS = ["calories", "protein", "fibre", "steps"] as const;
export type TargetMetric = (typeof TARGET_METRICS)[number];

export type Target = {
  metric: TargetMetric;
  value: number;
  start_date: LogicalDate;
};

export const TARGET_INFO: Record<
  TargetMetric,
  { label: string; unit: string; rule: "at most" | "at least" }
> = {
  calories: { label: "Calories", unit: "cal", rule: "at most" },
  protein: { label: "Protein", unit: "g", rule: "at least" },
  fibre: { label: "Fibre", unit: "g", rule: "at least" },
  steps: { label: "Steps", unit: "steps", rule: "at least" },
};

/**
 * The target that applied on a given day: the one with the latest start date
 * that is on or before that day. Returns null if no target had started yet.
 * Every day is judged with this, so changing a target never rewrites the past.
 */
export function targetFor(
  targets: Target[],
  metric: TargetMetric,
  date: LogicalDate,
): Target | null {
  let best: Target | null = null;
  for (const t of targets) {
    if (t.metric !== metric || t.start_date > date) continue;
    if (!best || t.start_date > best.start_date) best = t;
  }
  return best;
}

/** The next change after a given day, if one is already scheduled. */
export function nextTargetAfter(
  targets: Target[],
  metric: TargetMetric,
  date: LogicalDate,
): Target | null {
  let next: Target | null = null;
  for (const t of targets) {
    if (t.metric !== metric || t.start_date <= date) continue;
    if (!next || t.start_date < next.start_date) next = t;
  }
  return next;
}
