import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import GoalEditor from "@/components/project/goal-editor";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/goals",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();

  return (
    <>
      <PageTitle title={t("settings:goals.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:goals.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:goals.subtitle")}
          </p>
        </div>

        <GoalEditor projectId={projectId} />
      </div>
    </>
  );
}
