import type { Metadata } from "next";
import { ExportPage } from "@/components/export/ExportPage";

export const metadata: Metadata = { title: "Export" };

export default async function Page({ params }: PageProps<"/projects/[projectId]/export">) {
  const { projectId } = await params;
  return <ExportPage projectId={projectId} />;
}
