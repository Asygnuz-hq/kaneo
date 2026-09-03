import { describe, expect, it } from "vitest";
import { getChecklistProgress } from "./checklist-progress";

describe("getChecklistProgress", () => {
  it("returns null when there is no checklist", () => {
    expect(getChecklistProgress(null)).toBeNull();
    expect(getChecklistProgress("")).toBeNull();
    expect(getChecklistProgress("Just a plain description.")).toBeNull();
  });

  it("counts checked and total items", () => {
    const description = [
      "Some intro text.",
      "",
      "- [x] Done item",
      "- [ ] Pending item",
      "- [X] Also done (uppercase X)",
    ].join("\n");

    expect(getChecklistProgress(description)).toEqual({
      checked: 2,
      total: 3,
    });
  });

  it("ignores plain bullet lists without checkboxes", () => {
    const description = ["- Just a bullet", "* Another bullet"].join("\n");

    expect(getChecklistProgress(description)).toBeNull();
  });

  it("counts nested/indented checklist items", () => {
    const description = ["- [ ] Parent", "  - [x] Nested child"].join("\n");

    expect(getChecklistProgress(description)).toEqual({
      checked: 1,
      total: 2,
    });
  });
});
