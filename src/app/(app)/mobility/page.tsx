import { ComingSoon, PageHeader } from "@/components/PageHeader";

export default function MobilityPage() {
  return (
    <>
      <PageHeader title="Mobility" backHref="/more" />
      <ComingSoon phase={5} what="One big yes / no for yesterday’s mobility session." />
    </>
  );
}
