import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Loader2, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInviteProjectClient } from "@/hooks/mutations/client-access/use-invite-project-client";
import { useRemoveProjectClient } from "@/hooks/mutations/client-access/use-remove-project-client";
import { useGetProjectClients } from "@/hooks/queries/client-access/use-get-project-clients";
import { toast } from "@/lib/toast";

// ASYGNUZ: Service Desk -- who from outside the team can see this project's
// portal. Invite/list/remove are already fully built on the API side
// (client-access module); this is just the UI on top of it.

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/clients",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId, projectId } = Route.useParams();
  const { data: clients, isLoading } = useGetProjectClients(projectId);
  const { mutateAsync: inviteClient, isPending: isInviting } =
    useInviteProjectClient();
  const { mutateAsync: removeClient } = useRemoveProjectClient();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const onInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;

    setLastInviteLink(null);
    setCopied(false);
    try {
      const result = await inviteClient({
        projectId,
        email: email.trim(),
        name: name.trim() || undefined,
      });
      setEmail("");
      setName("");
      if (result.inviteLink) {
        setLastInviteLink(result.inviteLink);
        toast.success("Cliente invitado. Copia el link y envíaselo.");
      } else {
        toast.success("Cliente agregado -- ya tenía cuenta activa.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo invitar.",
      );
    }
  };

  const onCopyLink = async () => {
    if (!lastInviteLink) return;
    await navigator.clipboard.writeText(lastInviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onRemove = async (clientAccountId: string) => {
    setRemovingId(clientAccountId);
    try {
      await removeClient({ projectId, clientAccountId });
      toast.success("Acceso revocado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo quitar.",
      );
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      showViewSwitcher={false}
    >
      <PageTitle title="Clientes del portal" />
      <div className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-sm font-semibold text-foreground">
            Clientes del portal
          </h1>
          <p className="text-sm text-muted-foreground">
            Quién de afuera puede entrar al portal de Service Desk de este
            proyecto.
          </p>
        </div>

        <form
          onSubmit={onInvite}
          className="space-y-3 rounded-lg border border-border p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="client-email">Correo</Label>
              <Input
                id="client-email"
                type="email"
                required
                placeholder="cliente@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-name">Nombre (opcional)</Label>
              <Input
                id="client-name"
                type="text"
                placeholder="Nombre del contacto"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={isInviting}>
            {isInviting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Invitando...
              </>
            ) : (
              <>
                <UserPlus className="size-3.5" />
                Invitar cliente
              </>
            )}
          </Button>

          {lastInviteLink && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
              <code className="flex-1 truncate text-xs text-muted-foreground">
                {lastInviteLink}
              </code>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={onCopyLink}
              >
                {copied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          )}
        </form>

        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : clients && clients.length > 0 ? (
            clients.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {c.name || c.email}
                  </p>
                  {c.name && (
                    <p className="truncate text-xs text-muted-foreground">
                      {c.email}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant={c.status === "active" ? "success" : "warning"}
                  >
                    {c.status === "active" ? "Activo" : "Pendiente"}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={removingId === c.clientAccountId}
                    onClick={() => onRemove(c.clientAccountId)}
                    title="Quitar acceso"
                  >
                    <Trash2 className="size-3.5 text-destructive-foreground" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Todavía no hay clientes invitados a este proyecto.
            </p>
          )}
        </div>
      </div>
    </ProjectLayout>
  );
}
