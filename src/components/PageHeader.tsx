import Link from "next/link";

/** Page title, with an optional back link for screens that sit under "More". */
export function PageHeader({
  title,
  subtitle,
  backHref,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
}) {
  return (
    <header className="mb-5">
      {backHref && (
        <Link href={backHref} className="-ml-1 mb-1 inline-flex h-10 items-center text-neutral-400">
          ‹ Back
        </Link>
      )}
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle && <p className="mt-0.5 text-neutral-400">{subtitle}</p>}
    </header>
  );
}

/** Stand-in for a section that is built in a later phase. */
export function ComingSoon({ phase, what }: { phase: number; what: string }) {
  return (
    <div className="card text-neutral-400">
      <p className="font-medium text-neutral-200">Coming in Phase {phase}</p>
      <p className="mt-1">{what}</p>
    </div>
  );
}
