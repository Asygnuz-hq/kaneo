import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import PageTitle from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClientPortalWebSocket } from "@/hooks/use-client-portal-websocket";
import {
  clientPortalAuth,
  createClientPortalTicket,
  listClientPortalProjects,
  listClientPortalTickets,
} from "@/lib/client-portal-api";
import { toast } from "@/lib/toast";

// ASYGNUZ: Service Desk fase 2 -- lista de tickets de un proyecto puntual,
// más el formulario para crear uno nuevo. Un ticket es una tarea de Kaneo
// (ver apps/api/src/client-portal/controllers/create-ticket.ts).

export const Route = createFileRoute("/portal/project/$projectId")({
  component: ClientPortalProjectTickets,
});

const STATUS_LABEL: Record<string, string> = {
  "to-do": "Por hacer",
  "in-progress": "En progreso",
  "in-review": "En revisión",
  done: "Resuelto",
};

function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? status;
}

function NewTicketDialog({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setError(null);
    onClose();
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setIsPending(true);
    try {
      await createClientPortalTicket({
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      queryClient.invalidateQueries({
        queryKey: ["client-portal", "tickets"],
      });
      toast.success("Solicitud enviada");
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo enviar la solicitud.",
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva solicitud</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 px-1">
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="ticket-title">¿Qué necesitas?</Label>
            <Input
              id="ticket-title"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Necesito un carrusel para Instagram"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-description">Detalles (opcional)</Label>
            <Textarea
              id="ticket-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Cuéntanos lo que necesitas con el mayor detalle posible"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Enviar solicitud"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClientPortalProjectTickets() {
  const { projectId } = useParams({ from: "/portal/project/$projectId" });
  const navigate = useNavigate();
  const [isNewOpen, setIsNewOpen] = useState(false);

  const { data: account, isLoading: isAccountLoading } = useQuery({
    queryKey: ["client-portal", "me"],
    queryFn: clientPortalAuth.me,
    retry: false,
  });

  useClientPortalWebSocket(account ? projectId : undefined, undefined);

  const { data: projects } = useQuery({
    queryKey: ["client-portal", "projects"],
    queryFn: listClientPortalProjects,
    enabled: !!account,
  });

  const { data: tickets, isLoading: isTicketsLoading } = useQuery({
    queryKey: ["client-portal", "tickets"],
    queryFn: listClientPortalTickets,
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

  const project = projects?.find((p) => p.id === projectId);
  const projectTickets = (tickets ?? []).filter(
    (t) => t.projectId === projectId,
  );

  return (
    <div className="h-svh w-full overflow-y-auto bg-background px-4 py-6 sm:py-10">
      <PageTitle
        title={project ? `${project.name} · Solicitudes` : "Solicitudes"}
        hideAppName
      />
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="flex items-center gap-2">
          <Link to="/portal">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Proyectos
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">
            {project?.name ?? "Solicitudes"}
          </h1>
          <Button size="sm" onClick={() => setIsNewOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Nueva
          </Button>
        </div>

        {isTicketsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : projectTickets.length > 0 ? (
          <div className="space-y-2">
            {projectTickets.map((ticket) => (
              <Link
                key={ticket.id}
                to="/portal/project/$projectId/ticket/$ticketId"
                params={{ projectId, ticketId: ticket.id }}
              >
                <Card className="transition-colors hover:bg-accent/40">
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {ticket.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(ticket.createdAt).toLocaleDateString(
                          "es-CO",
                          { day: "numeric", month: "short", year: "numeric" },
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary">
                        {statusLabel(ticket.status)}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todavía no has enviado ninguna solicitud en este proyecto.
          </p>
        )}
      </div>

      <NewTicketDialog
        projectId={projectId}
        open={isNewOpen}
        onClose={() => setIsNewOpen(false)}
      />
    </div>
  );
}
