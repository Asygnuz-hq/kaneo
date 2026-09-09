import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const placeholderPattern = "[`\\\"']KANEO_TURNSTILE_SITE_KEY[`\\\"']";
const turnstilePlaceholder = "KANEO_TURNSTILE_SITE_KEY";

describe("runtime environment replacement", () => {
  it("strips unset placeholders regardless of the quote emitted by the bundler", () => {
    const bundle = [
      `const doubleQuoted = "${turnstilePlaceholder}";`,
      `const singleQuoted = '${turnstilePlaceholder}';`,
      `const templateLiteral = \`${turnstilePlaceholder}\`;`,
      `const required = "KANEO_API_URL";`,
      `const configured = "https://example.com";`,
    ].join("\n");

    const result = execFileSync("sed", ["-E", `s#${placeholderPattern}#""#g`], {
      input: bundle,
      encoding: "utf8",
    });

    expect(result).not.toContain("KANEO_TURNSTILE_SITE_KEY");
    expect(result).toContain(`const required = "KANEO_API_URL";`);
    expect(result).toContain(`const doubleQuoted = "";`);
    expect(result).toContain(`const singleQuoted = "";`);
    expect(result).toContain(`const templateLiteral = "";`);
    expect(result).toContain(`const configured = "https://example.com";`);
  });

  it("uses the quote-agnostic pattern in the container entrypoint", () => {
    const entrypoint = readFileSync(
      resolve(import.meta.dirname, "../env.sh"),
      "utf8",
    );

    expect(entrypoint).toContain(
      `sed -i -E 's#[\`"'"'"']KANEO_TURNSTILE_SITE_KEY[\`"'"'"']#""#g' {} +`,
    );
  });
});

describe("KANEO_FRAME_ANCESTORS (CSP frame-ancestors for embedding)", () => {
  // The exact default-value expression from env.sh, run in isolation (no
  // sed -i here -- its in-place flag differs between BSD sed on a dev
  // machine and the GNU/BusyBox sed the container actually runs, which
  // isn't what this line is testing anyway).
  function defaultedValue(kaneoFrameAncestors?: string): string {
    return execFileSync(
      "sh",
      [
        "-c",
        `FRAME_ANCESTORS="\${KANEO_FRAME_ANCESTORS:-'self'}"; printf '%s' "$FRAME_ANCESTORS"`,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          KANEO_FRAME_ANCESTORS: kaneoFrameAncestors ?? "",
        },
      },
    );
  }

  it("defaults to 'self' when unset -- same as X-Frame-Options: SAMEORIGIN before this existed", () => {
    expect(defaultedValue(undefined)).toBe("'self'");
  });

  it("passes through a configured allowlist so another origin can embed Kaneo", () => {
    expect(defaultedValue("'self' https://app.asygnuz.com")).toBe(
      "'self' https://app.asygnuz.com",
    );
  });

  it("env.sh has the exact default-value expression this test exercises", () => {
    const entrypoint = readFileSync(
      resolve(import.meta.dirname, "../env.sh"),
      "utf8",
    );
    expect(entrypoint).toContain(
      `FRAME_ANCESTORS="\${KANEO_FRAME_ANCESTORS:-'self'}"`,
    );
  });

  it("env.sh substitutes the same placeholder the nginx conf declares", () => {
    const entrypoint = readFileSync(
      resolve(import.meta.dirname, "../env.sh"),
      "utf8",
    );
    const nginxConf = readFileSync(
      resolve(import.meta.dirname, "../nginx.kaneo.conf"),
      "utf8",
    );

    expect(entrypoint).toContain("KANEO_FRAME_ANCESTORS_PLACEHOLDER");
    expect(nginxConf).toContain("KANEO_FRAME_ANCESTORS_PLACEHOLDER");
  });
});
