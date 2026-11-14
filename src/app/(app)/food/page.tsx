import { ComingSoon, PageHeader } from "@/components/PageHeader";

export default function FoodPage() {
  return (
    <>
      <PageHeader title="Food" />
      <ComingSoon phase={2} what="Healthify screenshot upload, review screen and manual entry." />
    </>
  );
}
