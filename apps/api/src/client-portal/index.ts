import { Hono } from "hono";
import {
  type ClientAuthVariables,
  clientAuthMiddleware,
} from "../client-auth/middleware";
import createTicket from "./controllers/create-ticket";
import createTicketComment from "./controllers/create-ticket-comment";
import getTicket from "./controllers/get-ticket";
import listClientProjects from "./controllers/list-client-projects";
import listTickets from "./controllers/list-tickets";

// ASYGNUZ: data routes for the Service Desk client portal itself (as
// opposed to client-auth, which only handles signing in/out).
//
// Fase 1 (ya en producción): listado de proyectos.
// Fase 2 (esto): tickets -- crear, listar, ver detalle con comentarios,
// comentar. Un ticket ES una tarea de Kaneo (ver create-ticket.ts) para no
// duplicar todo el sistema de gestión de tareas ya existente.

const clientPortal = new Hono<ClientAuthVariables>();
clientPortal.use("*", clientAuthMiddleware);

clientPortal.get("/projects", async (c) => {
  const projects = await listClientProjects(c.get("clientAccountId"));
  return c.json(projects);
});

clientPortal.get("/tickets", async (c) => {
  const tickets = await listTickets(c.get("clientAccountId"));
  return c.json(tickets);
});

clientPortal.post("/tickets", async (c) => {
  const body = await c.req.json<{
    projectId?: string;
    title?: string;
    description?: string;
  }>();

  if (!body.projectId || !body.title) {
    return c.json({ message: "projectId y title son obligatorios" }, 400);
  }

  const ticket = await createTicket(
    c.get("clientAccountId"),
    body.projectId,
    body.title,
    body.description,
  );
  return c.json(ticket, 201);
});

clientPortal.get("/tickets/:id", async (c) => {
  const ticket = await getTicket(c.get("clientAccountId"), c.req.param("id"));
  return c.json(ticket);
});

clientPortal.post("/tickets/:id/comments", async (c) => {
  const body = await c.req.json<{ content?: string }>();
  if (!body.content) {
    return c.json({ message: "content es obligatorio" }, 400);
  }

  const comment = await createTicketComment(
    c.get("clientAccountId"),
    c.req.param("id"),
    body.content,
  );
  return c.json(comment, 201);
});

export default clientPortal;
