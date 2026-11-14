import { ComingSoon, PageHeader } from "@/components/PageHeader";

export default function SleepPage() {
  return (
    <>
      <PageHeader title="Sleep" backHref="/more" />
      <ComingSoon phase={5} what="Last night’s sleep score (1 to 100), or skip." />
    </>
  );
}
