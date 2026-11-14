import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-5 pb-28">{children}</main>
      <BottomNav />
    </>
  );
}
