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
