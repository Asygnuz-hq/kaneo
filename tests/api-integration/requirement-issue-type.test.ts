import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: requirement issue type", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("regenerates description from the spec and computes executedPct from child stories", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    // A requirement with a structured spec -> description is derived from it.
    const reqRes = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Automatizar marcación de retiro",
        description: "ignored, regenerated from spec",
        priority: "high",
        issueType: "requirement",
        status: "to-do",
        spec: {
          traceabilityStatus: "desarrollo",
          plannedPct: 80,
          implementationPhase: "Fase 1",
          platform: "Nomma",
          changeType: "Automatización",
        },
      }),
    });
    expect(reqRes.status).toBe(200);
    const requirement = (await reqRes.json()) as {
      id: string;
      description: string;
      spec: { plannedPct: number };
    };
    expect(requirement.spec.plannedPct).toBe(80);
    expect(requirement.description).toContain("Desarrollo");
    expect(requirement.description).toContain("Nomma");

    // Two child stories; one moved to the final column.
    const storyIds: string[] = [];
    for (const title of ["HU-1", "HU-2"]) {
      const res = await app.request(`/api/task/${project.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description: "",
          priority: "medium",
          issueType: "story",
          status: "to-do",
        }),
      });
      const story = (await res.json()) as { id: string };
      storyIds.push(story.id);
      await app.request("/api/task-relation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceTaskId: requirement.id,
          targetTaskId: story.id,
          relationType: "subtask",
        }),
      });
    }

    await app.request(`/api/task/status/${storyIds[0]}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });

    const getRes = await app.request(`/api/task/${requirement.id}`);
    const fetched = (await getRes.json()) as { executedPct: number | null };
    expect(fetched.executedPct).toBe(50);
  });

  it("PUT /api/task/spec updates a story's structured fields and its description", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const res = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "HU-1",
        description: "",
        priority: "medium",
        issueType: "story",
        status: "to-do",
      }),
    });
    const story = (await res.json()) as { id: string };

    const specRes = await app.request(`/api/task/spec/${story.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        spec: {
          como: "analista",
          quiero: "que marque el retiro solo",
          para: "ahorrar tiempo",
          asIs: "hoy es manual",
          toBe: "debe ser automático",
          acceptanceCriteria: "- [ ] marcación 100% automática",
          businessRules: "verificar causal",
          functionalRequirements: "",
          definitionOfDone: "- [ ] pruebas al 80%",
        },
      }),
    });
    expect(specRes.status).toBe(200);
    const updated = (await specRes.json()) as { description: string };
    expect(updated.description).toContain("**Como** analista");
    expect(updated.description).toContain("## Comportamiento Esperado (TO-BE)");
    expect(updated.description).toContain("debe ser automático");
  });

  it("keeps the requirement's free-text context in the regenerated description", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const reqRes = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Requisito con contexto",
        description: "",
        priority: "high",
        issueType: "requirement",
        status: "to-do",
        spec: {
          context: "El cliente necesita cerrar la venta desde el checkout.",
          traceabilityStatus: "cotizacion",
          plannedPct: 40,
        },
      }),
    });
    const requirement = (await reqRes.json()) as {
      id: string;
      description: string;
    };
    expect(requirement.description).toContain(
      "El cliente necesita cerrar la venta desde el checkout.",
    );
    expect(requirement.description).toContain("Cotización");

    // Editing only the metadata must not drop the context prose.
    const specRes = await app.request(`/api/task/spec/${requirement.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        spec: {
          context: "El cliente necesita cerrar la venta desde el checkout.",
          traceabilityStatus: "desarrollo",
          plannedPct: 70,
        },
      }),
    });
    const updated = (await specRes.json()) as { description: string };
    expect(updated.description).toContain(
      "El cliente necesita cerrar la venta desde el checkout.",
    );
    expect(updated.description).toContain("Desarrollo");
  });

  it("GET /api/task/requirements lists the workspace's requirements with spec and story progress", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const reqRes = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Requisito con historias",
        description: "",
        priority: "high",
        issueType: "requirement",
        status: "to-do",
        spec: {
          traceabilityStatus: "pruebas",
          plannedPct: 60,
          implementationPhase: "Fase 2",
          platform: "Loggro",
          changeType: "Nuevo",
        },
      }),
    });
    const requirement = (await reqRes.json()) as { id: string };

    const storyIds: string[] = [];
    for (const title of ["HU-A", "HU-B", "HU-C"]) {
      const res = await app.request(`/api/task/${project.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description: "",
          priority: "medium",
          issueType: "story",
          status: "to-do",
        }),
      });
      const story = (await res.json()) as { id: string };
      storyIds.push(story.id);
      await app.request("/api/task-relation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceTaskId: requirement.id,
          targetTaskId: story.id,
          relationType: "subtask",
        }),
      });
    }
    await app.request(`/api/task/status/${storyIds[0]}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });

    const listRes = await app.request(
      `/api/task/requirements?workspaceId=${member.workspace.id}`,
    );
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as Array<{
      id: string;
      title: string;
      spec: { platform: string } | null;
      totalStories: number;
      doneStories: number;
      executedPct: number | null;
      projectName: string;
    }>;
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(requirement.id);
    expect(list[0].spec?.platform).toBe("Loggro");
    expect(list[0].totalStories).toBe(3);
    expect(list[0].doneStories).toBe(1);
    expect(list[0].executedPct).toBe(33);
    expect(list[0].projectName).toBe(project.name);
    expect(list[0].stories).toHaveLength(3);
    expect(list[0].stories.filter((s) => s.done)).toHaveLength(1);
    expect(list[0].stories.map((s) => s.title).sort()).toEqual([
      "HU-A",
      "HU-B",
      "HU-C",
    ]);
  });

  it("rejects a spec on an issueType that does not take one", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const res = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "plain task",
        description: "",
        priority: "medium",
        issueType: "task",
        status: "to-do",
      }),
    });
    const task = (await res.json()) as { id: string };

    const specRes = await app.request(`/api/task/spec/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ spec: { como: "x" } }),
    });
    expect(specRes.status).toBe(400);
  });
});
