import { AppNav } from "@/components/shell/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppNav />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 pb-20 pt-8 md:px-8 md:pt-10">{children}</main>
    </div>
  );
}
