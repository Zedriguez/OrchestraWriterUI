import { redirect } from "next/navigation";

/** Creating a project starts at Import. The mock API returns the id "new". */
export default function NewProject() {
  redirect("/projects/new/import");
}
