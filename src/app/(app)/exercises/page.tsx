import { Suspense } from "react";
import { ExercisesScreen } from "@/components/exercises/ExercisesScreen";
import { PageHeader } from "@/components/PageHeader";

export default function ExercisesPage() {
  return (
    <Suspense fallback={<PageHeader title="Exercises" />}>
      <ExercisesScreen />
    </Suspense>
  );
}
