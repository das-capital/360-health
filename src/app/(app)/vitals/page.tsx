import { ComingSoon, PageHeader } from "@/components/PageHeader";

export default function VitalsPage() {
  return (
    <>
      <PageHeader title="Body Vitals" backHref="/more" />
      <ComingSoon phase={5} what="Weight (kg) and waist, chest, hip and thigh (inches)." />
    </>
  );
}
