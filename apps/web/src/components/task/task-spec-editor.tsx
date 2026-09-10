import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateTaskSpec } from "@/hooks/mutations/task/use-update-task-spec";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { toast } from "@/lib/toast";
import type { RequirementSpec, StorySpec } from "@/types/task";

const TRACEABILITY: {
  value: RequirementSpec["traceabilityStatus"];
  label: string;
}[] = [
  { value: "inicio", label: "Inicio" },
  { value: "cotizacion", label: "Cotización" },
  { value: "desarrollo", label: "Desarrollo" },
  { value: "pruebas", label: "Pruebas" },
  { value: "finalizado", label: "Finalizado" },
  { value: "bloqueado", label: "Bloqueado" },
];

const EMPTY_REQUIREMENT: RequirementSpec = {
  context: "",
  traceabilityStatus: "inicio",
  plannedPct: 0,
  implementationPhase: "",
  platform: "",
  changeType: "",
};

const EMPTY_STORY: StorySpec = {
  como: "",
  quiero: "",
  para: "",
  asIs: "",
  toBe: "",
  acceptanceCriteria: "",
  businessRules: "",
  functionalRequirements: "",
  definitionOfDone: "",
};

function fieldLabel(text: string) {
  return <Label className="text-xs text-muted-foreground">{text}</Label>;
}

export default function TaskSpecEditor({
  taskId,
  projectId,
}: {
  taskId: string;
  projectId: string;
}) {
  const { t } = useTranslation();
  const { data: task } = useGetTask(taskId);
  const { mutateAsync, isPending } = useUpdateTaskSpec();
  const issueType = task?.issueType;

  const [requirement, setRequirement] =
    useState<RequirementSpec>(EMPTY_REQUIREMENT);
  const [story, setStory] = useState<StorySpec>(EMPTY_STORY);

  useEffect(() => {
    if (!task?.spec) return;
    if (issueType === "requirement") {
      setRequirement({
        ...EMPTY_REQUIREMENT,
        ...(task.spec as RequirementSpec),
      });
    } else if (issueType === "story") {
      setStory({ ...EMPTY_STORY, ...(task.spec as StorySpec) });
    }
  }, [task?.spec, issueType]);

  if (issueType !== "requirement" && issueType !== "story") return null;

  async function save(spec: RequirementSpec | StorySpec) {
    try {
      await mutateAsync({ taskId, projectId, spec });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common:error"));
    }
  }

  function setReq<K extends keyof RequirementSpec>(
    k: K,
    v: RequirementSpec[K],
  ) {
    const next = { ...requirement, [k]: v };
    setRequirement(next);
    save(next);
  }

  function setStoryField<K extends keyof StorySpec>(k: K, v: StorySpec[K]) {
    setStory((prev) => ({ ...prev, [k]: v }));
  }

  const executedPct = task?.executedPct ?? null;

  if (issueType === "requirement") {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-sm font-semibold">Requisito de Negocio</p>

        <div className="flex flex-col gap-1.5">
          {fieldLabel("Descripción / Contexto del requisito")}
          <Textarea
            rows={4}
            value={requirement.context}
            onChange={(e) =>
              setRequirement((prev) => ({ ...prev, context: e.target.value }))
            }
            onBlur={() => save(requirement)}
            placeholder="Qué se necesita y por qué, desde el negocio."
          />
        </div>

        <div className="flex flex-col gap-1.5">
          {fieldLabel("Estado de Trazabilidad")}
          <div className="flex flex-wrap gap-1.5">
            {TRACEABILITY.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setReq("traceabilityStatus", s.value)}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  requirement.traceabilityStatus === s.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-accent/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            {fieldLabel("% Planificado (Meta)")}
            <Input
              type="number"
              min={0}
              max={100}
              value={requirement.plannedPct}
              onChange={(e) =>
                setRequirement((prev) => ({
                  ...prev,
                  plannedPct: Number(e.target.value),
                }))
              }
              onBlur={() => save(requirement)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            {fieldLabel("% Ejecutado (Real)")}
            <div className="flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm">
              {executedPct == null ? "—" : `${executedPct}%`}
              <span className="ml-2 text-[10px] text-muted-foreground">
                calculado desde las historias
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Meta {requirement.plannedPct}%</span>
            <span>Real {executedPct ?? 0}%</span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-background">
            <div
              className="absolute inset-y-0 left-0 bg-primary/25"
              style={{ width: `${Math.min(100, requirement.plannedPct)}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-success-foreground"
              style={{ width: `${Math.min(100, executedPct ?? 0)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            {fieldLabel("Fase de Implementación")}
            <Input
              value={requirement.implementationPhase}
              onChange={(e) =>
                setRequirement((prev) => ({
                  ...prev,
                  implementationPhase: e.target.value,
                }))
              }
              onBlur={() => save(requirement)}
              placeholder="Fase 1"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            {fieldLabel("Plataforma / Software")}
            <Input
              value={requirement.platform}
              onChange={(e) =>
                setRequirement((prev) => ({
                  ...prev,
                  platform: e.target.value,
                }))
              }
              onBlur={() => save(requirement)}
              placeholder="Nomma"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            {fieldLabel("Tipo de Cambio")}
            <Input
              value={requirement.changeType}
              onChange={(e) =>
                setRequirement((prev) => ({
                  ...prev,
                  changeType: e.target.value,
                }))
              }
              onBlur={() => save(requirement)}
              placeholder="Automatización"
            />
          </div>
        </div>
      </div>
    );
  }

  // issueType === "story"
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-sm font-semibold">Historia de Usuario</p>

      <div className="flex flex-col gap-1.5">
        {fieldLabel("Como (rol de usuario)")}
        <Input
          value={story.como}
          onChange={(e) => setStoryField("como", e.target.value)}
          onBlur={() => save(story)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        {fieldLabel("Quiero (funcionalidad)")}
        <Input
          value={story.quiero}
          onChange={(e) => setStoryField("quiero", e.target.value)}
          onBlur={() => save(story)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        {fieldLabel("Para (beneficio de negocio)")}
        <Input
          value={story.para}
          onChange={(e) => setStoryField("para", e.target.value)}
          onBlur={() => save(story)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          {fieldLabel("Comportamiento Actual (AS-IS)")}
          <Textarea
            rows={4}
            value={story.asIs}
            onChange={(e) => setStoryField("asIs", e.target.value)}
            onBlur={() => save(story)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          {fieldLabel("Comportamiento Esperado (TO-BE)")}
          <Textarea
            rows={4}
            value={story.toBe}
            onChange={(e) => setStoryField("toBe", e.target.value)}
            onBlur={() => save(story)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {fieldLabel("Criterios de Aceptación (uno por línea)")}
        <Textarea
          rows={3}
          value={story.acceptanceCriteria}
          onChange={(e) => setStoryField("acceptanceCriteria", e.target.value)}
          onBlur={() => save(story)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        {fieldLabel("Reglas de Negocio")}
        <Textarea
          rows={3}
          value={story.businessRules}
          onChange={(e) => setStoryField("businessRules", e.target.value)}
          onBlur={() => save(story)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          {fieldLabel("Requisitos Funcionales")}
          <Textarea
            rows={3}
            value={story.functionalRequirements}
            onChange={(e) =>
              setStoryField("functionalRequirements", e.target.value)
            }
            onBlur={() => save(story)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          {fieldLabel("Definición de Terminado (DoD)")}
          <Textarea
            rows={3}
            value={story.definitionOfDone}
            onChange={(e) => setStoryField("definitionOfDone", e.target.value)}
            onBlur={() => save(story)}
          />
        </div>
      </div>
      {isPending && (
        <p className="text-[10px] text-muted-foreground">Guardando…</p>
      )}
    </div>
  );
}
