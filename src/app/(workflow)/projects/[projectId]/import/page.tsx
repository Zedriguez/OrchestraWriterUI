import type { Metadata } from "next";
import { ImportPage } from "@/components/import/ImportPage";

export const metadata: Metadata = { title: "Import" };

export default async function Page({ params }: PageProps<"/projects/[projectId]/import">) {
  const { projectId } = await params;
  return <ImportPage projectId={projectId} />;
}
