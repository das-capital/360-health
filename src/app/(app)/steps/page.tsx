import { ComingSoon, PageHeader } from "@/components/PageHeader";

export default function StepsPage() {
  return (
    <>
      <PageHeader title="Steps" backHref="/more" />
      <ComingSoon phase={5} what="Type in the day’s step count." />
    </>
  );
}
