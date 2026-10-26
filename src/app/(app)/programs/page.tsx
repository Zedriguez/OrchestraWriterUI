import type { Metadata } from "next";
import { ProgramsPage } from "@/components/library/ProgramsPage";

export const metadata: Metadata = { title: "Programs" };

export default function Page() {
  return <ProgramsPage />;
}
