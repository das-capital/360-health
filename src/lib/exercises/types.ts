export type BaseList = "push" | "pull" | "leg" | "plyo" | "cardio";
export type ExerciseType = "strength" | "timed" | "cardio" | "plyo";
export type CardioKind = "treadmill" | "cross_trainer" | "hiit";

export type Exercise = {
  id: number;
  name: string;
  type: ExerciseType;
  base_list: BaseList;
  /** For this exercise, weight means the assistance amount (Assisted Pull-up). */
  assisted: boolean;
  cardio_kind: CardioKind | null;
  sort_order: number;
};

/** The numbers of one set. Which ones are used depends on the exercise type. */
export type SetValues = {
  reps: number | null;
  weight_kg: number | null;
  seconds: number | null;
  box_height_in: number | null;
};

export type SetRow = SetValues & {
  id: number;
  session_id: number;
  exercise_id: number;
  set_no: number;
};

export type CardioRow = {
  id: number;
  exercise_id: number;
  fields: Record<string, number>;
};

/** Everything logged under Exercises for one day. */
export type DayLog = {
  sessions: { id: number; template: string }[];
  sets: SetRow[];
  cardio: CardioRow[];
  rest: boolean;
};

/* ---------------------------------------------------------------- templates */

export const TEMPLATES = {
  push: { label: "Push Day", lists: ["push"] },
  pull: { label: "Pull Day", lists: ["pull"] },
  leg: { label: "Leg Day", lists: ["leg"] },
  upper: { label: "Upper", lists: ["push", "pull"] },
  lower: { label: "Lower", lists: ["leg"] },
  full: { label: "Full Body", lists: ["push", "pull", "leg"] },
  plyo: { label: "Plyometrics", lists: ["plyo"] },
} as const satisfies Record<string, { label: string; lists: readonly BaseList[] }>;

export type TemplateKey = keyof typeof TEMPLATES;

export const isTemplate = (value: string | null): value is TemplateKey =>
  value !== null && value in TEMPLATES;

export const LIST_LABEL: Record<BaseList, string> = {
  push: "Push",
  pull: "Pull",
  leg: "Leg",
  plyo: "Plyometrics",
  cardio: "Cardio",
};

/**
 * The exercises a template shows. Upper, Lower and Full Body are combined
 * views over the base lists, so an exercise added once appears everywhere it should.
 */
export function exercisesFor(template: TemplateKey, all: Exercise[]): Exercise[] {
  const lists: readonly BaseList[] = TEMPLATES[template].lists;
  return all
    .filter((e) => lists.includes(e.base_list))
    .sort(
      (a, b) =>
        lists.indexOf(a.base_list) - lists.indexOf(b.base_list) ||
        a.sort_order - b.sort_order ||
        a.name.localeCompare(b.name),
    );
}

export function templateLabel(template: string): string {
  return isTemplate(template) ? TEMPLATES[template].label : template;
}
