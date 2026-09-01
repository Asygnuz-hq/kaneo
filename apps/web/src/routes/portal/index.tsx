import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Loader2, LogOut } from "lucide-react";
import { Logo } from "@/components/common/logo";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  clientPortalAuth,
  listClientPortalProjects,
} from "@/lib/client-portal-api";

// ASYGNUZ: Service Desk client portal landing -- confirms the session works
// and lists accessible projects. Each one links into its ticket list
// (fase 2, apps/web/src/routes/portal/project.$projectId.tsx).

export const Route = createFileRoute("/portal/")({
  component: ClientPortalHome,
});

function ClientPortalHome() {
  const navigate = useNavigate();

  const { data: account, isLoading: isAccountLoading } = useQuery({
    queryKey: ["client-portal", "me"],
    queryFn: clientPortalAuth.me,
    retry: false,
  });

  const { data: projects, isLoading: isProjectsLoading } = useQuery({
    queryKey: ["client-portal", "projects"],
    queryFn: listClientPortalProjects,
    enabled: !!account,
  });

  if (isAccountLoading) {
    return (
      <div className="flex h-svh w-full items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!account) {
    navigate({ to: "/portal/login", replace: true });
    return null;
  }

  const handleLogout = async () => {
    await clientPortalAuth.logout();
    navigate({ to: "/portal/login", replace: true });
  };

  return (
    <div className="h-svh w-full overflow-y-auto bg-background px-4 py-6 sm:py-10">
      <PageTitle title="Portal de clientes" hideAppName />
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <Logo />
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Salir
          </Button>
        </div>

        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {account.name ? `Hola, ${account.name}` : "Tus proyectos"}
          </h1>
          <p className="text-sm text-muted-foreground">{account.email}</p>
        </div>

        {isProjectsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="space-y-2">
            {projects.map((project) => (
              <Link
                key={project.id}
                to="/portal/project/$projectId"
                params={{ projectId: project.id }}
              >
                <Card className="transition-colors hover:bg-accent/40">
                  <CardContent className="py-3 flex items-center justify-between">
                    <p className="font-medium text-foreground">
                      {project.name}
                    </p>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todavía no tienes acceso a ningún proyecto.
          </p>
        )}
      </div>
    </div>
  );
}
