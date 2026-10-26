import { DYNAMICS } from "@/shared/dynamics";
import { Dyn } from "./Dyn";
import { cx } from "@/lib/utils/format";

/** The pp → fff brightness ladder with its caption. Every color encoding gets a legend. */
export function DynamicLegend({ onStage, compact, className }: { onStage?: boolean; compact?: boolean; className?: string }) {
  const text = onStage ? "text-stage-text-2" : "text-ink-3";
  const marks = compact ? (["pp", "mf", "fff"] as const) : DYNAMICS;
  return (
    <div className={className}>
      {!compact && (
        <p className={cx("text-[12.5px] leading-relaxed mb-2.5", text)}>
          Brightness follows the written dynamic, from <Dyn value="pp" size="sm" className={onStage ? "text-stage-text" : "text-ink"} /> to{" "}
          <Dyn value="fff" size="sm" className={onStage ? "text-stage-text" : "text-ink"} />.
        </p>
      )}
      <div className="ladder-gradient h-[6px] rounded-full" />
      <div className={cx("mt-1.5 flex justify-between", onStage ? "text-stage-text" : "text-ink-2")}>
        {marks.map((d) => (
          <Dyn key={d} value={d} size="sm" />
        ))}
      </div>
    </div>
  );
}

/** Seven dots, dim → bright, as in Direction B's floating legend. */
export function LadderDots({ className }: { className?: string }) {
  return (
    <div className={cx("stage-glass inline-flex flex-col items-center rounded-2xl px-3.5 py-2", className)}>
      <div className="flex items-end gap-3">
        {DYNAMICS.map((d, i) => {
          const t = i / (DYNAMICS.length - 1);
          return (
            <div key={d} className="flex flex-col items-center gap-1.5">
              <span
                className="h-3 w-3 rounded-full"
                style={{
                  background: `color-mix(in srgb, var(--brass-2) ${30 + t * 70}%, #3a3221)`,
                  boxShadow: `0 0 ${4 + t * 12}px rgba(215,174,85,${0.1 + t * 0.6})`,
                }}
              />
              <Dyn value={d} size="sm" className="text-stage-text" />
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-stage-text-3">Softest to loudest</p>
    </div>
  );
}
