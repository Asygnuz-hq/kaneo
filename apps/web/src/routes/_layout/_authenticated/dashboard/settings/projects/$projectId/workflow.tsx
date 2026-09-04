import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import AutomationRuleEditor from "@/components/project/automation-rule-editor";
import ColumnEditor from "@/components/project/column-editor";
import WorkflowEditor from "@/components/project/workflow-editor";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/workflow",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();
  const { workspace } = useWorkspacePermission();

  return (
    <>
      <PageTitle title={t("settings:projectWorkflow.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:projectWorkflow.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:projectWorkflow.subtitle")}
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-md font-medium">
              {t("settings:projectWorkflow.columnsTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("settings:projectWorkflow.columnsDescription")}
            </p>
          </div>
          <ColumnEditor projectId={projectId} />
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-md font-medium">
              {t("settings:projectWorkflow.automationTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("settings:projectWorkflow.automationDescription")}
            </p>
          </div>
          <WorkflowEditor projectId={projectId} />
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-md font-medium">
              {t("settings:automationRules.title")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("settings:automationRules.subtitle")}
            </p>
          </div>
          {workspace?.id && (
            <AutomationRuleEditor
              projectId={projectId}
              workspaceId={workspace.id}
            />
          )}
        </div>
      </div>
    </>
  );
}
