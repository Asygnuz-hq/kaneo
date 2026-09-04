import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import RecurringTaskEditor from "@/components/project/recurring-task-editor";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/recurring-tasks",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();
  const { workspace } = useWorkspacePermission();

  return (
    <>
      <PageTitle title={t("settings:recurringTasks.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:recurringTasks.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:recurringTasks.subtitle")}
          </p>
        </div>

        {workspace?.id && (
          <RecurringTaskEditor
            projectId={projectId}
            workspaceId={workspace.id}
          />
        )}
      </div>
    </>
  );
}
