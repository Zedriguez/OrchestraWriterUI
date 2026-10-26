import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Aurora } from "@/components/brand/Aurora";

export default function NotFound() {
  return (
    <main className="relative flex-1 grid place-items-center overflow-hidden grain">
      <Aurora />
      <div className="relative z-10 text-center px-6">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        <p className="eyebrow mb-3">Tacet</p>
        <h1 className="display text-5xl md:text-6xl mb-4">
          This page is <em>resting</em>
        </h1>
        <p className="text-ink-3 max-w-md mx-auto mb-8">
          There is nothing on the stand here. The movement you are looking for may have been moved or renamed.
        </p>
        <Link
          href="/library"
          className="inline-flex items-center rounded-full bg-ink text-paper px-5 py-2.5 text-sm font-medium hover:opacity-90 transition"
        >
          Back to your library
        </Link>
      </div>
    </main>
  );
}
