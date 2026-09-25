// Names come from two different Kaneos and typed by different people:
// "Juan manuel azlate", "JUAN MANUEL AZLATE " and "Juan Manuel Azláte" are the
// same person. Compare them without case, accents or stray spacing.
export function normalizeName(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
