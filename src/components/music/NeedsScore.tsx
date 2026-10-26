import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Shown by Sync, Customize, Preview and Export when the project has no parsed score yet. */
export function NeedsScore({ projectId, title }: { projectId: string; title: string }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <h1 className="display mb-2 text-[2rem]">{title}</h1>
      <p className="mb-6 text-sm text-ink-3">This project has no score yet. Add a MusicXML file on the Import step first.</p>
      <Button href={`/projects/${projectId}/import`} leading={<ArrowLeft size={14} />}>
        Go to Import
      </Button>
    </div>
  );
}
