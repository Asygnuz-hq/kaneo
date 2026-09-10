import { z } from "@hono/zod-openapi";
import { TRACEABILITY_STATUSES } from "./validate-task-fields";

// ASYGNUZ: structured payload carried on task.spec (jsonb), shaped by
// issueType. Kept separate from `description`, which is regenerated from
// this on every save so cards, search, exports and notifications still see
// readable text.

export const requirementSpecSchema = z
  .object({
    traceabilityStatus: z.enum(TRACEABILITY_STATUSES).default("inicio"),
    plannedPct: z.number().int().min(0).max(100).default(0),
    implementationPhase: z.string().default(""),
    platform: z.string().default(""),
    changeType: z.string().default(""),
  })
  .openapi("RequirementSpec");

export const storySpecSchema = z
  .object({
    como: z.string().default(""),
    quiero: z.string().default(""),
    para: z.string().default(""),
    asIs: z.string().default(""),
    toBe: z.string().default(""),
    acceptanceCriteria: z.string().default(""),
    businessRules: z.string().default(""),
    functionalRequirements: z.string().default(""),
    definitionOfDone: z.string().default(""),
  })
  .openapi("StorySpec");

export type RequirementSpec = z.infer<typeof requirementSpecSchema>;
export type StorySpec = z.infer<typeof storySpecSchema>;

// A permissive shape for the wire: the client sends whichever fields apply.
export const taskSpecInputSchema = z
  .record(z.string(), z.unknown())
  .openapi("TaskSpecInput");

export function parseSpec(
  issueType: string,
  raw: unknown,
): RequirementSpec | StorySpec | null {
  if (raw == null) return null;
  if (issueType === "requirement") {
    const parsed = requirementSpecSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }
  if (issueType === "story") {
    const parsed = storySpecSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }
  return null;
}

const TRACEABILITY_LABEL: Record<string, string> = {
  inicio: "Inicio",
  cotizacion: "Cotización",
  desarrollo: "Desarrollo",
  pruebas: "Pruebas",
  finalizado: "Finalizado",
  bloqueado: "Bloqueado",
};

// Regenerate the human-readable `description` from a spec. Order and
// headings match the fields the UI edits.
export function specToDescription(
  issueType: string,
  spec: RequirementSpec | StorySpec | null,
  fallback: string,
): string {
  if (!spec) return fallback;

  if (issueType === "requirement") {
    const s = spec as RequirementSpec;
    const lines = [
      `**Estado de trazabilidad:** ${TRACEABILITY_LABEL[s.traceabilityStatus] ?? s.traceabilityStatus}`,
      `**% Planificado (meta):** ${s.plannedPct}%`,
    ];
    if (s.implementationPhase)
      lines.push(`**Fase de implementación:** ${s.implementationPhase}`);
    if (s.platform) lines.push(`**Plataforma / Software:** ${s.platform}`);
    if (s.changeType) lines.push(`**Tipo de cambio:** ${s.changeType}`);
    return lines.join("\n");
  }

  const s = spec as StorySpec;
  const parts: string[] = [];
  if (s.como || s.quiero || s.para) {
    parts.push(
      [
        s.como && `**Como** ${s.como}`,
        s.quiero && `**Quiero** ${s.quiero}`,
        s.para && `**Para** ${s.para}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  if (s.asIs) parts.push(`## Comportamiento Actual (AS-IS)\n${s.asIs}`);
  if (s.toBe) parts.push(`## Comportamiento Esperado (TO-BE)\n${s.toBe}`);
  if (s.acceptanceCriteria)
    parts.push(`## Criterios de Aceptación\n${s.acceptanceCriteria}`);
  if (s.businessRules) parts.push(`## Reglas de Negocio\n${s.businessRules}`);
  if (s.functionalRequirements)
    parts.push(`## Requisitos Funcionales\n${s.functionalRequirements}`);
  if (s.definitionOfDone)
    parts.push(`## Definición de Terminado (DoD)\n${s.definitionOfDone}`);
  return parts.join("\n\n") || fallback;
}
