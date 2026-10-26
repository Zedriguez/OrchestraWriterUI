import { redirect } from "next/navigation";

/** Creating a project starts at Import; ProjectLoader creates it and replaces "new" with the real id. */
export default function NewProject() {
  redirect("/projects/new/import");
}
