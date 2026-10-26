import { Logo } from "@/components/brand/Logo";
import { Aurora } from "@/components/brand/Aurora";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="relative grid flex-1 place-items-center overflow-hidden grain">
      <Aurora />
      <div className="relative z-10 px-6 text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <h1 className="display mb-3 text-[2rem] md:text-[2.4rem]">This page is resting</h1>
        <p className="mx-auto mb-8 max-w-md text-ink-3">There is nothing here. It may have been moved or deleted.</p>
        <Button href="/library" variant="primary">
          Back to your library
        </Button>
      </div>
    </main>
  );
}
