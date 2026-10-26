import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PROGRAMS, getProgram, projectsInProgram } from "@/lib/mock/library";
import { ProgramDetail } from "@/components/library/ProgramDetail";

export function generateStaticParams() {
  return PROGRAMS.map((p) => ({ programId: p.id }));
}

export async function generateMetadata({ params }: PageProps<"/programs/[programId]">): Promise<Metadata> {
  const { programId } = await params;
  const program = getProgram(programId);
  return { title: program ? program.name : "Program" };
}

export default async function Page({ params }: PageProps<"/programs/[programId]">) {
  const { programId } = await params;
  const program = getProgram(programId);
  if (!program) notFound();
  return <ProgramDetail program={program} projects={projectsInProgram(program.id)} />;
}
