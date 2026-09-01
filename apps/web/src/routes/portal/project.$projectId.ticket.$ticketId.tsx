import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { useState } from "react";
import PageTitle from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useClientPortalWebSocket } from "@/hooks/use-client-portal-websocket";
import {
  clientPortalAuth,
  createClientPortalTicketComment,
  getClientPortalTicket,
} from "@/lib/client-portal-api";
import { cn } from "@/lib/cn";

// ASYGNUZ: Service Desk fase 2 -- detalle de un ticket puntual: estado,
// descripción, e hilo de comentarios en tiempo real (WS en
// use-client-portal-websocket.ts, misma pool que usa el equipo interno).

export const Route = createFileRoute(
  "/portal/project/$projectId/ticket/$ticketId",
)({
  component: ClientPortalTicketDetail,
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ClientPortalTicketDetail() {
  const { projectId, ticketId } = useParams({
    from: "/portal/project/$projectId/ticket/$ticketId",
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: account, isLoading: isAccountLoading } = useQuery({
    queryKey: ["client-portal", "me"],
    queryFn: clientPortalAuth.me,
    retry: false,
  });

  useClientPortalWebSocket(account ? projectId : undefined, ticketId);

  const {
    data: ticket,
    isLoading: isTicketLoading,
    isError,
  } = useQuery({
    queryKey: ["client-portal", "ticket", ticketId],
    queryFn: () => getClientPortalTicket(ticketId),
    enabled: !!account,
    retry: false,
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

  const onReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reply.trim()) return;
    setError(null);
    setIsSending(true);
    try {
      await createClientPortalTicketComment(ticketId, reply.trim());
      setReply("");
      queryClient.invalidateQueries({
        queryKey: ["client-portal", "ticket", ticketId],
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo enviar el mensaje.",
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-svh w-full overflow-y-auto bg-background px-4 py-6 sm:py-10">
      <PageTitle title={ticket ? ticket.title : "Solicitud"} hideAppName />
      <div className="mx-auto w-full max-w-lg space-y-6">
        <Link to="/portal/project/$projectId" params={{ projectId }}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Solicitudes
          </Button>
        </Link>

        {isTicketLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : isError || !ticket ? (
          <p className="text-sm text-muted-foreground">
            No se encontró esta solicitud.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{statusLabel(ticket.status)}</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(ticket.createdAt)}
                </span>
              </div>
              <h1 className="text-lg font-semibold text-foreground">
                {ticket.title}
              </h1>
              {ticket.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {ticket.description}
                </p>
              )}
            </div>

            <div className="space-y-3">
              {ticket.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin respuestas todavía.
                </p>
              ) : (
                ticket.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={cn(
                      "rounded-lg border p-3 text-sm",
                      comment.fromTeam
                        ? "border-border bg-surface-alt"
                        : "border-accent/30 bg-accent/10 ml-6",
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground">
                        {comment.fromTeam ? comment.authorName : "Tú"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(comment.createdAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-foreground/90">
                      {comment.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={onReply} className="space-y-2">
              {error && <p className="text-sm text-danger">{error}</p>}
              <Textarea
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Escribe una respuesta..."
              />
              <Button
                type="submit"
                size="sm"
                disabled={isSending || !reply.trim()}
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1.5" />
                    Enviar
                  </>
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
