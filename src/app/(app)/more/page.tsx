import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

const LINKS = [
  { href: "/steps", label: "Steps" },
  { href: "/sleep", label: "Sleep" },
  { href: "/mobility", label: "Mobility" },
  { href: "/vitals", label: "Body Vitals" },
  { href: "/settings", label: "Settings" },
];

export default function MorePage() {
  return (
    <>
      <PageHeader title="More" />
      <ul className="flex flex-col gap-2">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="card flex h-16 items-center justify-between text-lg active:bg-neutral-800"
            >
              {link.label}
              <span className="text-neutral-500">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
