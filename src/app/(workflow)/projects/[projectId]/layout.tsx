import { WorkflowNav } from "@/components/shell/WorkflowNav";
import { ProjectLoader } from "@/components/shell/ProjectLoader";

export default async function WorkflowLayout({ children, params }: LayoutProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <WorkflowNav projectId={projectId} />
      <ProjectLoader projectId={projectId}>
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 pb-16 pt-7 md:px-8">{children}</main>
      </ProjectLoader>
    </div>
  );
}
