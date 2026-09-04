import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import TaskTemplateEditor from "@/components/project/task-template-editor";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/templates",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();
  const { workspace } = useWorkspacePermission();

  return (
    <>
      <PageTitle title={t("settings:taskTemplates.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:taskTemplates.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:taskTemplates.subtitle")}
          </p>
        </div>

        {workspace?.id && (
          <TaskTemplateEditor
            projectId={projectId}
            workspaceId={workspace.id}
          />
        )}
      </div>
    </>
  );
}
