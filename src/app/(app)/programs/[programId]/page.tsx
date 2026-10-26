import type { Metadata } from "next";
import { ProgramDetail } from "@/components/library/ProgramDetail";

export const metadata: Metadata = { title: "Program" };

export default async function Page({ params }: PageProps<"/programs/[programId]">) {
  const { programId } = await params;
  return <ProgramDetail programId={programId} />;
}
