import { resolveApiBaseUrl } from "@kaneo/libs";

// ASYGNUZ: Service Desk client portal. Deliberately plain `fetch` instead of
// the typed Hono RPC `client` from @kaneo/libs -- client-auth/client-portal
// aren't part of AppType (see apps/api/src/index.ts), since they're a
// completely separate, client-session-authenticated surface, not something
// the internal authenticated app should ever call.

const baseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_URL);

async function request<T>(
  basePath: "client-auth" | "client-portal",
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${baseUrl}/${basePath}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const rawBody = await response.text();

  if (!response.ok) {
    // HTTPException's default response body is plain text, not JSON -- fall
    // back to the raw text if it doesn't parse.
    let message = rawBody;
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed && typeof parsed === "object" && "message" in parsed) {
        message = String((parsed as { message: unknown }).message);
      }
    } catch {
      // rawBody is already the message
    }
    throw new Error(message || "Ocurrió un error. Intenta de nuevo.");
  }

  return rawBody ? (JSON.parse(rawBody) as T) : (undefined as T);
}

export type ClientPortalAccount = {
  id: string;
  email: string;
  name: string | null;
};

export const clientPortalAuth = {
  login: (email: string, password: string) =>
    request<ClientPortalAccount>("client-auth", "/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  acceptInvite: (token: string, password: string, name?: string) =>
    request<ClientPortalAccount>("client-auth", "/accept-invite", {
      method: "POST",
      body: JSON.stringify({ token, password, name }),
    }),
  logout: () =>
    request<{ ok: boolean }>("client-auth", "/logout", { method: "POST" }),
  me: () => request<ClientPortalAccount>("client-auth", "/me"),
};

export type ClientPortalProject = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
};

export function listClientPortalProjects() {
  return request<ClientPortalProject[]>("client-portal", "/projects");
}

// ASYGNUZ: Service Desk fase 2 -- tickets. Un ticket es una tarea de Kaneo
// vista desde el lado del cliente (ver apps/api/src/client-portal).

export type ClientPortalTicket = {
  id: string;
  number: number | null;
  title: string;
  status: string;
  createdAt: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
};

export function listClientPortalTickets() {
  return request<ClientPortalTicket[]>("client-portal", "/tickets");
}

export function createClientPortalTicket(input: {
  projectId: string;
  title: string;
  description?: string;
}) {
  return request<ClientPortalTicket>("client-portal", "/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type ClientPortalTicketComment = {
  id: string;
  content: string | null;
  createdAt: string;
  authorName: string;
  fromTeam: boolean;
};

export type ClientPortalTicketDetail = ClientPortalTicket & {
  description: string | null;
  comments: ClientPortalTicketComment[];
};

export function getClientPortalTicket(ticketId: string) {
  return request<ClientPortalTicketDetail>(
    "client-portal",
    `/tickets/${encodeURIComponent(ticketId)}`,
  );
}

export function createClientPortalTicketComment(
  ticketId: string,
  content: string,
) {
  return request<ClientPortalTicketComment>(
    "client-portal",
    `/tickets/${encodeURIComponent(ticketId)}/comments`,
    { method: "POST", body: JSON.stringify({ content }) },
  );
}
