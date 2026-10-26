import type { Metadata } from "next";
import { CustomizePage } from "@/components/customize/CustomizePage";

export const metadata: Metadata = { title: "Customize" };

export default async function Page({ params }: PageProps<"/projects/[projectId]/customize">) {
  const { projectId } = await params;
  return <CustomizePage projectId={projectId} />;
}
