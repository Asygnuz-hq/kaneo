// ASYGNUZ: ruta crítica para el Gantt.
//
// Esta NO es la fórmula clásica de CPM (adelante/atrás calculando holgura a
// partir de duraciones) -- aquí las fechas ya las puso la persona, no se
// calculan. Lo que se calcula es: siguiendo las dependencias "blocks", cuál
// cadena de tareas es la que efectivamente determina la fecha de cierre más
// tardía del proyecto. Esa cadena es la ruta crítica: si cualquiera de esas
// tareas se atrasa, la fecha final del proyecto se corre. Una tarea fuera de
// esa cadena tiene margen (holgura) antes de afectar el cierre.

export type CriticalPathTask = {
  id: string;
  scheduleEnd: Date;
};

export type BlockingEdge = {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
};

export type CriticalPathResult = {
  criticalTaskIds: Set<string>;
  criticalEdgeIds: Set<string>;
};

const EMPTY_RESULT: CriticalPathResult = {
  criticalTaskIds: new Set(),
  criticalEdgeIds: new Set(),
};

export function computeCriticalPath(
  tasks: CriticalPathTask[],
  edges: BlockingEdge[],
): CriticalPathResult {
  if (tasks.length === 0 || edges.length === 0) return EMPTY_RESULT;

  const taskById = new Map(tasks.map((task) => [task.id, task]));

  // Solo relaciones donde ambas puntas son tareas que de verdad estan en el
  // Gantt ahora mismo -- una relacion hacia una tarea sin fecha (fuera del
  // Gantt) no aporta nada al calculo.
  const validEdges = edges.filter(
    (edge) =>
      taskById.has(edge.sourceTaskId) && taskById.has(edge.targetTaskId),
  );
  if (validEdges.length === 0) return EMPTY_RESULT;

  const successorsOf = new Map<string, BlockingEdge[]>();
  const hasPredecessor = new Set<string>();
  for (const edge of validEdges) {
    const list = successorsOf.get(edge.sourceTaskId) ?? [];
    list.push(edge);
    successorsOf.set(edge.sourceTaskId, list);
    hasPredecessor.add(edge.targetTaskId);
  }

  // chainEnd(t) = la fecha de cierre mas tardia alcanzable siguiendo la
  // cadena de dependencias hacia adelante desde t (incluyendo el propio
  // cierre de t). Memoizado; "visiting" corta ciclos en vez de recursion
  // infinita -- una relacion circular no deberia poder tumbar la vista.
  const memo = new Map<string, number>();
  function chainEnd(id: string, visiting: Set<string>): number {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const own = taskById.get(id)?.scheduleEnd.getTime() ?? 0;
    if (visiting.has(id)) return own;

    visiting.add(id);
    let latest = own;
    for (const edge of successorsOf.get(id) ?? []) {
      latest = Math.max(latest, chainEnd(edge.targetTaskId, visiting));
    }
    visiting.delete(id);

    memo.set(id, latest);
    return latest;
  }

  const roots = tasks.filter((task) => !hasPredecessor.has(task.id));
  if (roots.length === 0) return EMPTY_RESULT; // solo pasa si hay un ciclo puro, sin raiz

  let globalCriticalEnd = Number.NEGATIVE_INFINITY;
  for (const root of roots) {
    globalCriticalEnd = Math.max(
      globalCriticalEnd,
      chainEnd(root.id, new Set()),
    );
  }

  const criticalTaskIds = new Set<string>();
  const criticalEdgeIds = new Set<string>();

  // Camina hacia adelante desde cada raiz que alcanza el cierre critico
  // global, marcando tarea por tarea mientras el siguiente tramo siga
  // igualando ese mismo valor. Si varias cadenas empatan en el maximo, se
  // marcan todas -- mas honesto que elegir una arbitrariamente.
  function walk(id: string, target: number, seen: Set<string>) {
    if (seen.has(id)) return; // ciclo -- no reprocesar
    if (chainEnd(id, new Set()) !== target) return;
    seen.add(id);
    criticalTaskIds.add(id);
    for (const edge of successorsOf.get(id) ?? []) {
      if (chainEnd(edge.targetTaskId, new Set()) === target) {
        criticalEdgeIds.add(edge.id);
        walk(edge.targetTaskId, target, seen);
      }
    }
  }

  const seen = new Set<string>();
  for (const root of roots) {
    if (chainEnd(root.id, new Set()) === globalCriticalEnd) {
      walk(root.id, globalCriticalEnd, seen);
    }
  }

  return { criticalTaskIds, criticalEdgeIds };
}
