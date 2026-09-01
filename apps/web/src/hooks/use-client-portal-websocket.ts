import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getApiUrl } from "@/fetchers/get-api-url";

// ASYGNUZ: Service Desk fase 2 -- misma lógica de reconexión/keepalive que
// useProjectWebSocket (apps/web/src/hooks/use-project-websocket.ts), pero
// apuntando al endpoint autenticado por sesión de cliente
// (/ws/client/:projectId) en vez del interno. Un comentario o cambio de
// estado hecho por el equipo llega aquí en vivo sin que el cliente recargue.

function getClientWsUrl(projectId: string) {
  const base = getApiUrl("ws/client");
  const wsBase = base.replace(/^http/, "ws");
  return `${wsBase}/${encodeURIComponent(projectId)}`;
}

const MAX_RETRIES = 5;
const BASE_DELAY = 1000;
const WS_PING_INTERVAL_MS = 30_000;

export function useClientPortalWebSocket(
  projectId: string | undefined,
  ticketId: string | undefined,
) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!projectId) return;

    retriesRef.current = 0;

    function clearPing() {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    }

    function connect() {
      if (!projectId) return;
      const ws = new WebSocket(getClientWsUrl(projectId));
      wsRef.current = ws;

      ws.onopen = () => {
        retriesRef.current = 0;
        clearPing();
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, WS_PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (
            message.type === "TASK_UPDATED" ||
            message.type === "COMMENT_UPDATED"
          ) {
            queryClient.invalidateQueries({
              queryKey: ["client-portal", "tickets"],
            });
            if (ticketId && message.taskId === ticketId) {
              queryClient.invalidateQueries({
                queryKey: ["client-portal", "ticket", ticketId],
              });
            }
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        clearPing();
        wsRef.current = null;
        if (retriesRef.current < MAX_RETRIES) {
          const delay = BASE_DELAY * 2 ** retriesRef.current;
          retriesRef.current += 1;
          timeoutRef.current = setTimeout(connect, delay);
        }
      };
    }
    connect();

    return () => {
      retriesRef.current = MAX_RETRIES;
      clearPing();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      wsRef.current?.close();
    };
  }, [projectId, ticketId, queryClient]);
}
