import { describe, expect, it } from "vitest";
import {
  localAssigneeEmail,
  localStatusFor,
  remoteAssigneeEmail,
  remoteStatusFor,
} from "../../../apps/api/src/external-mirror/config";

describe("external mirror aliases", () => {
  it("maps a kaneo-mia work email to the account used here", () => {
    expect(localAssigneeEmail("Nicolas.Loaiza@financieramentecu.com ")).toBe(
      "nlo9619loaocam@gmail.com",
    );
    expect(localAssigneeEmail("warles.rivera@financieramentecu.com")).toBe(
      "warlesrivera123@gmail.com",
    );
  });

  it("leaves unknown or empty emails untouched", () => {
    expect(localAssigneeEmail("juan.marin@asygnuz.com")).toBe(
      "juan.marin@asygnuz.com",
    );
    expect(localAssigneeEmail(null)).toBeNull();
    expect(localAssigneeEmail(undefined)).toBeUndefined();
  });

  it("maps Comisiones' renamed Code Review column to code-review", () => {
    expect(localStatusFor("in-review", "Comisiones")).toBe("code-review");
    expect(localStatusFor("qa", "Comisiones")).toBe("qa");
  });

  it("keeps in-review for every other project", () => {
    expect(localStatusFor("in-review", "Tecnología")).toBe("in-review");
    expect(localStatusFor("in-review", undefined)).toBe("in-review");
  });

  it("sends kaneo-mia its own email for the same person", () => {
    expect(remoteAssigneeEmail("nlo9619loaocam@gmail.com")).toBe(
      "nicolas.loaiza@financieramentecu.com",
    );
    expect(remoteAssigneeEmail("juan.marin@asygnuz.com")).toBe(
      "juan.marin@asygnuz.com",
    );
    expect(remoteAssigneeEmail(null)).toBeNull();
  });

  it("sends Comisiones tasks back with their own Code Review slug", () => {
    expect(remoteStatusFor("code-review", ["Comisiones"])).toBe("in-review");
    expect(remoteStatusFor("code-review", ["Tecnología"])).toBe("code-review");
    expect(remoteStatusFor("qa", ["Comisiones"])).toBe("qa");
  });

  it("translates the hand-made back-log column to backlog", () => {
    expect(remoteStatusFor("back-log", ["Comisiones"])).toBe("backlog");
    expect(remoteStatusFor(null, [])).toBeNull();
  });
});
