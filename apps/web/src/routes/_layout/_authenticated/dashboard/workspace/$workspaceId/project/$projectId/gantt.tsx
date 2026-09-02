import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  isWeekend,
  parseISO,
  startOfWeek,
  subDays,
} from "date-fns";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import {
  type DependencyLine,
  GanttDependencyOverlay,
} from "@/components/gantt/gantt-dependency-overlay";
import { GanttTaskBar } from "@/components/gantt/gantt-task-bar";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import useGetProjectBlockingRelations from "@/hooks/queries/task-relation/use-get-project-blocking-relations";
import useGetProjectSubtaskRelations from "@/hooks/queries/task-relation/use-get-project-subtask-relations";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/cn";
import { getStatusLabel } from "@/lib/i18n/domain";
import { getIssueTypeIcon } from "@/lib/task-type";
import { useUserPreferencesStore } from "@/store/user-preferences";

type GanttSearchParams = {
  taskId?: string;
};

type GanttZoomLevel = "day" | "week" | "month" | "quarter";

const GANTT_ZOOM_LEVELS: GanttZoomLevel[] = ["day", "week", "month", "quarter"];

// ASYGNUZ: rem por dia en cada nivel de zoom. El piso de 0.5rem en mes/
// trimestre evita que una barra de 1 dia quede en 0px -- sigue siendo
// angosta a proposito (es la vista de "panorama", no de detalle diario),
// pero se puede ver y tocar.
const ZOOM_DAY_WIDTH_REM_DESKTOP: Record<GanttZoomLevel, number> = {
  day: 2.75,
  week: 1.1,
  month: 0.6,
  quarter: 0.5,
};
const ZOOM_DAY_WIDTH_REM_MOBILE: Record<GanttZoomLevel, number> = {
  day: 3.125,
  week: 1.4,
  month: 0.75,
  quarter: 0.5,
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/gantt",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): GanttSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function parseTaskDate(value: string | null) {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data: project } = useGetTasks(projectId);
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useIsMobile();
  const [isTaskRailOpen, setIsTaskRailOpen] = useState(false);

  // ASYGNUZ: mismo árbol Épica -> Historia/Tarea -> Subtarea que usa la
  // vista de Lista, para que el Gantt anide las barras en vez de mostrar
  // todo en una sola fila plana.
  const { data: subtaskRelations } = useGetProjectSubtaskRelations(
    project?.id ?? "",
  );
  // ASYGNUZ: flechas de dependencia -- "blocks" es un dato distinto del
  // árbol de subtareas de arriba, se pide aparte.
  const { data: blockingRelations } = useGetProjectBlockingRelations(
    project?.id ?? "",
  );
  const childrenOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const rel of subtaskRelations ?? []) {
      const kids = map.get(rel.sourceTaskId) ?? [];
      kids.push(rel.targetTaskId);
      map.set(rel.sourceTaskId, kids);
    }
    return map;
  }, [subtaskRelations]);
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(
    new Set(),
  );
  const toggleCollapsed = (taskId: string) => {
    setCollapsedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Wider day columns on small screens so dragging and reading dates is easier.
  // ASYGNUZ: zoom -- el timeline sigue siendo un grid de dias por debajo
  // (misma logica de arrastre/redimension basada en indice de dia, sin
  // tocarla); lo unico que cambia por nivel es que tan ancho se dibuja
  // cada columna de dia, y que tanto detalle muestra el encabezado.
  const [zoomLevel, setZoomLevel] = useState<GanttZoomLevel>("day");
  const dayColumnWidthRem = isMobile
    ? ZOOM_DAY_WIDTH_REM_MOBILE[zoomLevel]
    : ZOOM_DAY_WIDTH_REM_DESKTOP[zoomLevel];
  const taskColumnWidthRem = isMobile ? 12 : 14;
  const showTaskRail = !isMobile || isTaskRailOpen;
  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const [pixelsPerDay, setPixelsPerDay] = useState(44);

  // ASYGNUZ: flechas de dependencia -- el contenedor del cuerpo del Gantt
  // (mismo origen de coordenadas que usa el fondo de la cuadrícula) más un
  // ref por barra visible, para medir posiciones reales en vez de asumir
  // una altura de fila fija (el alto de fila puede variar entre mobile y
  // desktop según el contenido de la columna de tareas).
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const barRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const setBarRef = (taskId: string) => (el: HTMLDivElement | null) => {
    if (el) barRefs.current.set(taskId, el);
    else barRefs.current.delete(taskId);
  };
  const [dependencyLines, setDependencyLines] = useState<DependencyLine[]>([]);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!isMobile) {
      setIsTaskRailOpen(true);
      return;
    }

    setIsTaskRailOpen(false);
  }, [isMobile]);

  const allTasks = useMemo(
    () => [
      ...(project?.columns.flatMap((column) => column.tasks) ?? []),
      ...(project?.plannedTasks ?? []),
    ],
    [project],
  );

  const parsedTasks = useMemo(() => {
    return allTasks
      .map((task) => {
        const parsedStart =
          parseTaskDate(task.startDate) ?? parseTaskDate(task.dueDate);
        const parsedEnd =
          parseTaskDate(task.dueDate) ?? parseTaskDate(task.startDate);

        if (!parsedStart || !parsedEnd) return null;

        const start = parsedStart <= parsedEnd ? parsedStart : parsedEnd;
        const end = parsedEnd >= parsedStart ? parsedEnd : parsedStart;

        return {
          ...task,
          scheduleStart: start,
          scheduleEnd: end,
        };
      })
      .filter((task): task is NonNullable<typeof task> => task !== null)
      .sort(
        (left, right) =>
          left.scheduleStart.getTime() - right.scheduleStart.getTime(),
      );
  }, [allTasks]);

  type ParsedTask = (typeof parsedTasks)[number];

  // ASYGNUZ: aplana el árbol en orden padre -> hijos (cada hijo justo debajo
  // de su padre, indentado), en vez del orden plano por fecha que había
  // antes. Solo se anida entre tareas que ya tienen fecha (aparecen en el
  // Gantt) -- si el padre no tiene fecha, el hijo simplemente sale como raíz.
  const orderedTasks = useMemo(() => {
    const byId = new Map(parsedTasks.map((task) => [task.id, task]));
    const scheduledIds = new Set(byId.keys());
    const childIds = new Set<string>();
    for (const [parentId, kidIds] of childrenOf) {
      if (!scheduledIds.has(parentId)) continue;
      for (const kidId of kidIds) {
        if (scheduledIds.has(kidId)) childIds.add(kidId);
      }
    }
    const rootTasks = parsedTasks.filter((task) => !childIds.has(task.id));

    const result: (ParsedTask & { level: number; childCount: number })[] = [];
    const visit = (task: ParsedTask, level: number) => {
      const kidIds = (childrenOf.get(task.id) ?? []).filter((id) =>
        scheduledIds.has(id),
      );
      const kids = kidIds
        .map((id) => byId.get(id))
        .filter((t): t is ParsedTask => Boolean(t))
        .sort((a, b) => a.scheduleStart.getTime() - b.scheduleStart.getTime());

      result.push({ ...task, level, childCount: kids.length });
      if (collapsedTaskIds.has(task.id)) return;
      for (const kid of kids) visit(kid, level + 1);
    };

    for (const task of rootTasks) visit(task, 0);
    return result;
  }, [parsedTasks, childrenOf, collapsedTaskIds]);

  const scheduledTasks = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return orderedTasks;

    // Con búsqueda activa mostramos coincidencias planas -- mezclar
    // resultados sueltos con la jerarquía completa confunde más de lo que
    // ayuda.
    return parsedTasks
      .filter((task) => {
        return (
          task.title.toLowerCase().includes(normalizedQuery) ||
          `${project?.slug ?? ""}-${task.number ?? ""}`
            .toLowerCase()
            .includes(normalizedQuery) ||
          task.status.toLowerCase().includes(normalizedQuery)
        );
      })
      .map((task) => ({ ...task, level: 0, childCount: 0 }));
  }, [orderedTasks, parsedTasks, project?.slug, searchQuery]);

  const timeline = useMemo(() => {
    if (parsedTasks.length === 0) return null;

    const earliest = parsedTasks.reduce(
      (current, task) =>
        task.scheduleStart < current ? task.scheduleStart : current,
      parsedTasks[0].scheduleStart,
    );
    const latest = parsedTasks.reduce(
      (current, task) =>
        task.scheduleEnd > current ? task.scheduleEnd : current,
      parsedTasks[0].scheduleEnd,
    );

    // Week-aligned bounds around task dates, then pad with extra days so bars can
    // be resized or moved past the current last task without running out of grid.
    const weekStart = startOfWeek(earliest, { weekStartsOn });
    const weekEnd = endOfWeek(latest, { weekStartsOn });
    const rangeStart = subDays(weekStart, 7);
    const rangeEnd = addDays(weekEnd, 28);

    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

    return {
      days,
      rangeStart,
      gridTemplateColumns: `repeat(${days.length}, minmax(${dayColumnWidthRem}rem, ${dayColumnWidthRem}rem))`,
      timelineMinWidthRem: days.length * dayColumnWidthRem,
    };
  }, [parsedTasks, dayColumnWidthRem, weekStartsOn]);

  useLayoutEffect(() => {
    const element = timelineTrackRef.current;
    if (!element || !timeline) return;

    const update = () => {
      const count = timeline.days.length;
      if (count <= 0) return;
      setPixelsPerDay(element.clientWidth / count);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [timeline]);

  // ASYGNUZ: recalcula las flechas de dependencia a partir de las posiciones
  // REALES en pantalla de cada barra (no de una altura de fila asumida) --
  // se vuelve a medir cuando cambian las tareas visibles, el orden, el zoom
  // (pixelsPerDay) o el tamaño del contenedor.
  useLayoutEffect(() => {
    const body = timelineBodyRef.current;
    if (!body || (blockingRelations?.length ?? 0) === 0) {
      setDependencyLines([]);
      setOverlaySize({ width: 0, height: 0 });
      return;
    }

    const visibleIds = new Set(scheduledTasks.map((task) => task.id));

    const measure = () => {
      const bodyRect = body.getBoundingClientRect();
      setOverlaySize({ width: body.scrollWidth, height: body.scrollHeight });

      const lines: DependencyLine[] = [];
      for (const rel of blockingRelations ?? []) {
        if (
          !visibleIds.has(rel.sourceTaskId) ||
          !visibleIds.has(rel.targetTaskId)
        ) {
          continue;
        }
        const sourceEl = barRefs.current.get(rel.sourceTaskId);
        const targetEl = barRefs.current.get(rel.targetTaskId);
        if (!sourceEl || !targetEl) continue;

        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        // A barra sin fechas en rango (fuera de la ventana visible del
        // timeline) mide 0x0 -- no dibujar una flecha desde/hacia la nada.
        if (
          sourceRect.width === 0 ||
          sourceRect.height === 0 ||
          targetRect.width === 0 ||
          targetRect.height === 0
        ) {
          continue;
        }

        // getBoundingClientRect is viewport-relative for both, so the
        // subtraction below already cancels out any scrolling of the
        // ancestor scroll container -- no need to add its scrollLeft/Top.
        lines.push({
          id: rel.id,
          x1: sourceRect.right - bodyRect.left,
          y1: sourceRect.top + sourceRect.height / 2 - bodyRect.top,
          x2: targetRect.left - bodyRect.left,
          y2: targetRect.top + targetRect.height / 2 - bodyRect.top,
        });
      }
      setDependencyLines(lines);
    };

    measure();
    // A ResizeObserver on `body` alone is enough: it fires whenever the
    // container's own rendered width/height changes, which is exactly when
    // pixelsPerDay would have changed too (both are driven by the same
    // window/sidebar resize) -- no need to also list pixelsPerDay here.
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, [scheduledTasks, blockingRelations]);

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="gantt"
    >
      <PageTitle
        title={t("tasks:gantt.pageTitle", { name: project?.name })}
        hideAppName
      />
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="border-b border-border/80 px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-sm font-semibold text-foreground">
                {t("tasks:gantt.title")}
              </h1>
            </div>

            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("tasks:gantt.searchPlaceholder")}
                className="h-9 min-h-11 touch-manipulation sm:h-8 sm:min-h-0 [&_[data-slot=input]]:pl-8 [&_[data-slot=input]]:text-xs"
              />
            </div>

            <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5">
              {GANTT_ZOOM_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={zoomLevel === level}
                  onClick={() => setZoomLevel(level)}
                  className={cn(
                    "min-h-9 touch-manipulation rounded px-2 text-xs font-medium transition-colors sm:min-h-0 sm:px-2 sm:py-1",
                    zoomLevel === level
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`tasks:gantt.zoom.${level}`)}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="xs"
              className="min-h-11 touch-manipulation sm:hidden"
              onClick={() => setIsTaskRailOpen((current) => !current)}
            >
              {showTaskRail ? (
                <ChevronLeft className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              {showTaskRail
                ? t("tasks:gantt.hideTasks")
                : t("tasks:gantt.showTasks")}
            </Button>
          </div>
        </div>

        {!timeline || parsedTasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <h2 className="text-sm font-semibold text-foreground">
                {t("tasks:gantt.noTasks")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("tasks:gantt.noTasksSubtitle")}
              </p>
            </div>
          </div>
        ) : scheduledTasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <h2 className="text-sm font-semibold text-foreground">
                {t("tasks:gantt.noTasksFound")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("tasks:gantt.noTasksMatch", { query: searchQuery })}
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
            <div className="relative min-w-max touch-pan-x touch-pan-y">
              <div className="sticky top-0 z-20 flex border-b border-border bg-background/95 backdrop-blur">
                {showTaskRail ? (
                  <div
                    className="sticky left-0 z-30 shrink-0 border-r border-border bg-background px-2 py-2.5 sm:w-80 sm:px-4 sm:py-3"
                    style={{
                      width: isMobile ? `${taskColumnWidthRem}rem` : undefined,
                    }}
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t("tasks:gantt.taskHeader")}
                    </p>
                  </div>
                ) : null}
                <div
                  className="grid shrink-0"
                  style={{
                    gridTemplateColumns: timeline.gridTemplateColumns,
                    minWidth: `${timeline.timelineMinWidthRem}rem`,
                  }}
                >
                  {timeline.days.map((day, index) => {
                    const showMonth =
                      index === 0 ||
                      !isSameMonth(day, timeline.days[index - 1] ?? day);

                    // ASYGNUZ (zoom): a month/trimestre cada columna mide unos
                    // pocos px -- ni el numero de dia ni "MMM" caben adentro.
                    // Se muestra solo el nombre de mes, en el primer dia de
                    // cada mes, y se deja desbordar hacia la derecha (mismo
                    // truco que usan los Gantt comerciales a este zoom): no
                    // hay nada interactivo debajo con lo que choque.
                    const isCompact =
                      zoomLevel === "month" || zoomLevel === "quarter";

                    if (isCompact) {
                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "relative h-9 border-r border-border/40",
                            isToday(day) && "bg-primary/10",
                          )}
                        >
                          {showMonth ? (
                            <span className="absolute top-1 left-0.5 whitespace-nowrap text-[10px] font-medium text-muted-foreground">
                              {format(day, "MMM yyyy")}
                            </span>
                          ) : null}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "border-r border-border/70 px-0.5 py-2 text-center sm:px-1",
                          isWeekend(day) && "bg-muted/25",
                        )}
                      >
                        <div className="h-4 text-[10px] font-medium text-muted-foreground">
                          {showMonth ? format(day, "MMM") : ""}
                        </div>
                        <div
                          className={cn(
                            "mx-auto flex size-6 items-center justify-center rounded-full text-xs font-medium",
                            isToday(day) &&
                              "bg-primary text-primary-foreground",
                          )}
                        >
                          {format(day, "d")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div ref={timelineBodyRef} className="relative">
                <div
                  ref={timelineTrackRef}
                  className="absolute inset-y-0 z-0 grid"
                  style={{
                    left: showTaskRail
                      ? isMobile
                        ? `${taskColumnWidthRem}rem`
                        : "20rem"
                      : "0rem",
                    gridTemplateColumns: timeline.gridTemplateColumns,
                    width: `${timeline.timelineMinWidthRem}rem`,
                  }}
                >
                  {timeline.days.map((day) => (
                    <div
                      key={`bg-line-${day.toISOString()}`}
                      className={cn(
                        "h-full min-h-0 border-r border-border/60",
                        // A esta escala (mes/trimestre) una franja de fin de
                        // semana por dia es puro ruido visual -- se omite.
                        zoomLevel !== "month" &&
                          zoomLevel !== "quarter" &&
                          isWeekend(day) &&
                          "bg-muted/25",
                      )}
                    />
                  ))}
                </div>

                <div className="relative z-10 flex flex-col">
                  {scheduledTasks.map((task) => {
                    return (
                      <div
                        key={task.id}
                        className="grid items-stretch border-b border-border/70"
                        style={{
                          gridTemplateColumns: showTaskRail
                            ? isMobile
                              ? `${taskColumnWidthRem}rem max-content`
                              : "20rem max-content"
                            : "max-content",
                        }}
                      >
                        {showTaskRail ? (
                          <div className="sticky left-0 z-[11] h-full border-r border-border bg-background">
                            {/* ASYGNUZ: div en vez de <button> -- este bloque
                            ya contiene la flechita de expandir/colapsar como
                            botón propio, y HTML no permite anidar <button>s
                            (rompía el click y disparaba un warning de
                            hidratación en React). */}
                            {/* biome-ignore lint/a11y/noStaticElementInteractions: false positive for onClick/onKeyDown, matches list-view/task-row.tsx */}
                            <div
                              className="flex min-h-[44px] w-full min-w-0 flex-col items-start justify-center gap-0.5 px-2 py-2 text-left transition-colors hover:bg-muted sm:min-h-0 sm:px-3 sm:py-1.5 cursor-pointer"
                              style={{
                                paddingLeft: `${task.level * 0.875 + (isMobile ? 0.5 : 0.75)}rem`,
                              }}
                              onClick={() =>
                                navigate({
                                  to: ".",
                                  search: { taskId: task.id },
                                  replace: true,
                                })
                              }
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ")
                                  return;
                                event.preventDefault();
                                navigate({
                                  to: ".",
                                  search: { taskId: task.id },
                                  replace: true,
                                });
                              }}
                            >
                              <div className="flex w-full items-center gap-1.5">
                                {task.childCount > 0 ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleCollapsed(task.id);
                                    }}
                                    className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                                  >
                                    <ChevronRight
                                      className={cn(
                                        "size-3 transition-transform",
                                        !collapsedTaskIds.has(task.id) &&
                                          "rotate-90",
                                      )}
                                    />
                                  </button>
                                ) : (
                                  task.level > 0 && (
                                    <div className="w-3 flex-shrink-0" />
                                  )
                                )}
                                <div
                                  className="flex-shrink-0"
                                  title={t(
                                    `tasks:type.${task.issueType || "task"}`,
                                  )}
                                >
                                  {getIssueTypeIcon(task.issueType)}
                                </div>
                                <span className="max-w-[7rem] truncate rounded-full bg-secondary px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-secondary-foreground sm:max-w-none">
                                  {getStatusLabel(task.status)}
                                </span>
                                <span className="truncate text-[10px] text-muted-foreground">
                                  {project?.slug}-{task.number}
                                </span>
                              </div>
                              <p className="w-full line-clamp-1 text-xs font-medium leading-tight text-foreground">
                                {task.title}
                              </p>
                              <p className="w-full truncate text-[11px] leading-tight text-muted-foreground">
                                {format(task.scheduleStart, "MMM d")} -{" "}
                                {format(task.scheduleEnd, "MMM d")}
                                {task.assigneeName
                                  ? ` • ${task.assigneeName}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                        ) : null}

                        <div
                          ref={setBarRef(task.id)}
                          className="relative min-h-11 shrink-0 select-none"
                          style={{
                            minWidth: `${timeline.timelineMinWidthRem}rem`,
                          }}
                        >
                          <GanttTaskBar
                            task={task}
                            timeline={timeline}
                            pixelsPerDay={pixelsPerDay}
                            isMobile={isMobile}
                            onOpenTask={() =>
                              navigate({
                                to: ".",
                                search: { taskId: task.id },
                                replace: true,
                              })
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <GanttDependencyOverlay
                  lines={dependencyLines}
                  width={overlaySize.width}
                  height={overlaySize.height}
                />
              </div>
            </div>
          </div>
        )}

        <TaskDetailsSheet
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
          onClose={() =>
            navigate({
              to: ".",
              search: {},
              replace: true,
            })
          }
        />
      </div>
    </ProjectLayout>
  );
}
