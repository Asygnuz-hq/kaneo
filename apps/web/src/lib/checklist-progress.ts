// ASYGNUZ: la descripción de una tarea guarda su checklist como texto
// Markdown (mismo formato que sirve @tiptap/markdown para renderizar los
// checkboxes en el editor: "- [ ] " / "- [x] "). No existe una entidad de
// checklist aparte -- para mostrar un contador "3/7" en la tarjeta del
// Kanban/lista basta con contar esas líneas en el texto ya guardado.
const TASK_ITEM_LINE = /^\s*[-+*]\s+\[([ xX])\]\s+/gm;

export type ChecklistProgress = {
  checked: number;
  total: number;
};

export function getChecklistProgress(
  description: string | null | undefined,
): ChecklistProgress | null {
  if (!description) return null;

  let total = 0;
  let checked = 0;

  for (const match of description.matchAll(TASK_ITEM_LINE)) {
    total += 1;
    if (match[1].toLowerCase() === "x") checked += 1;
  }

  return total > 0 ? { checked, total } : null;
}
