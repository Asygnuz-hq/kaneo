import { Hono } from "hono";
import {
  type ClientAuthVariables,
  clientAuthMiddleware,
} from "../client-auth/middleware";
import listClientProjects from "./controllers/list-client-projects";

// ASYGNUZ: data routes for the Service Desk client portal itself (as
// opposed to client-auth, which only handles signing in/out). Phase 1 only
// needs the project list -- ticket creation/viewing lands in a follow-up
// PR once this foundation is in.

const clientPortal = new Hono<ClientAuthVariables>();
clientPortal.use("*", clientAuthMiddleware);

clientPortal.get("/projects", async (c) => {
  const projects = await listClientProjects(c.get("clientAccountId"));
  return c.json(projects);
});

export default clientPortal;
