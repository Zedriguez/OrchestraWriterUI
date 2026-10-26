import type { Metadata } from "next";
import { PreviewPage } from "@/components/preview/PreviewPage";

export const metadata: Metadata = { title: "Preview" };

export default async function Page({ params }: PageProps<"/projects/[projectId]/preview">) {
  const { projectId } = await params;
  return <PreviewPage projectId={projectId} />;
}
