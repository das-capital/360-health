import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

const AREAS = [
  { href: "/history/food", label: "Food", what: "Calories, protein and fibre against target" },
  { href: "/history/steps", label: "Steps", what: "Daily steps, averages and days on target" },
  { href: "/history/sleep", label: "Sleep", what: "Sleep score over time" },
  { href: "/history/mobility", label: "Mobility", what: "Calendar, percentage done and streaks" },
  { href: "/history/exercises", label: "Exercises", what: "Workout days, progression, bests and volume" },
  { href: "/history/vitals", label: "Body Vitals", what: "Weight and measurements over time" },
];

export default function HistoryPage() {
  return (
    <>
      <PageHeader title="History" />
      <ul className="flex flex-col gap-2">
        {AREAS.map((area) => (
          <li key={area.href}>
            <Link href={area.href} className="card flex min-h-18 items-center gap-3 active:bg-neutral-800">
              <span className="flex-1">
                <span className="block text-lg">{area.label}</span>
                <span className="text-sm text-neutral-500">{area.what}</span>
              </span>
              <span className="text-neutral-500">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
