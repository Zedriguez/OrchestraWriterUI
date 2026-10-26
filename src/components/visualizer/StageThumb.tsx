import type { ProjectSummary } from "@/shared/domain";
import { SECTION_TOKEN } from "@/shared/sections";
import { cx } from "@/lib/utils/format";

/** Static glow snapshot for library cards. Pure CSS; no canvas. */
export function StageThumb({ project, className }: { project: ProjectSummary; className?: string }) {
  return (
    <div className={cx("stage-frame relative aspect-[16/10] w-full overflow-hidden", className)} aria-hidden>
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 95%, #161b22 0%, #0d1116 55%, #070a0d 100%)" }} />
      {project.thumbnail.map((g, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${g.x * 100}%`,
            top: `${g.y * 100}%`,
            width: `${34 + g.level * 20}%`,
            height: `${34 + g.level * 20}%`,
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(closest-side, color-mix(in srgb, ${SECTION_TOKEN[g.section]} ${55 + g.level * 45}%, white) 0%, ${SECTION_TOKEN[g.section]} 30%, transparent 72%)`,
            opacity: 0.25 + g.level * 0.6,
            filter: "blur(10px)",
            mixBlendMode: "screen",
          }}
        />
      ))}
      {project.thumbnail.length === 0 && (
        <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold uppercase tracking-[0.2em] text-stage-text-3">No preview</span>
      )}
      <span className="absolute bottom-2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/25" />
    </div>
  );
}
