import type { Metadata } from "next";
import { SyncPage } from "@/components/sync/SyncPage";

export const metadata: Metadata = { title: "Sync" };

export default async function Page({ params }: PageProps<"/projects/[projectId]/sync">) {
  const { projectId } = await params;
  return <SyncPage projectId={projectId} />;
}
