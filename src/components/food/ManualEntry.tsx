"use client";

import { useState, type FormEvent } from "react";
import { addManualMeal } from "@/lib/food/db";
import { MEAL_SLOTS } from "@/lib/food/types";
import { formatLogicalDate, type LogicalDate } from "@/lib/logical-date";

/** Rare case: type a meal's numbers by hand. Adds to the slot's total. */
export function ManualEntry({
  date,
  onSaved,
  onCancel,
}: {
  date: LogicalDate;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [slot, setSlot] = useState<string>(MEAL_SLOTS[0]);
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [fibre, setFibre] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optional = (text: string) => (text.trim() === "" ? null : Number(text));

  async function save(event: FormEvent) {
    event.preventDefault();
    const cal = Number(calories);
    const p = optional(protein);
    const f = optional(fibre);
    if (calories.trim() === "" || !Number.isFinite(cal) || cal < 0) return setError("Enter the calories.");
    if ([p, f].some((v) => v !== null && (!Number.isFinite(v) || v < 0))) {
      return setError("Protein and fibre must be numbers, or left blank.");
    }

    setBusy(true);
    setError(null);
    try {
      await addManualMeal(date, { slot, calories: cal, protein: p, fibre: f });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">Type a meal</h2>
        <p className="text-neutral-400">For {formatLogicalDate(date)}. Adds to that meal’s total.</p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-neutral-400">Meal</span>
        <select value={slot} onChange={(e) => setSlot(e.target.value)} className="field">
          {MEAL_SLOTS.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-neutral-400">Calories</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          required
          autoFocus
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          className="field"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-400">Protein (g)</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            className="field"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-400">Fibre (g)</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={fibre}
            onChange={(e) => setFibre(e.target.value)}
            className="field"
          />
        </label>
      </div>
      <p className="text-sm text-neutral-500">
        Leave protein or fibre blank if you don’t know it. Blank counts as unknown, not zero.
      </p>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary flex-1">
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" disabled={busy} className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
