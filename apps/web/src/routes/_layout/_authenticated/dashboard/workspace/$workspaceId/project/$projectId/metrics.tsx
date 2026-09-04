import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import ProjectMetricsView from "@/components/project/project-metrics-view";
import useGetProject from "@/hooks/queries/project/use-get-project";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/metrics",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { data: project } = useGetProject({ id: projectId, workspaceId });

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="metrics"
    >
      <PageTitle
        title={t("metrics:pageTitle", { name: project?.name })}
        hideAppName
      />
      <div className="h-full min-h-0 overflow-y-auto bg-background p-4">
        <div className="mx-auto max-w-5xl">
          <ProjectMetricsView projectId={projectId} />
        </div>
      </div>
    </ProjectLayout>
  );
}
