import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import DocPageEditor from "@/components/project/doc-page-editor";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/docs",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();

  return (
    <>
      <PageTitle title={t("settings:projectDocs.pageTitle")} />
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:projectDocs.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:projectDocs.subtitle")}
          </p>
        </div>

        <DocPageEditor projectId={projectId} />
      </div>
    </>
  );
}
