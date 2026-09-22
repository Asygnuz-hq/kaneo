import { postToGenericWebhook } from "../plugins/generic-webhook/client";
import { financieramenteBaseUrl, mirrorSecret } from "./config";

// Tells kaneo-mia which of its tasks a just-created local mirror belongs to,
// so a later status change made by our own team can find its way back (see
// AGENTS.md decision to sync status both ways). Best-effort: a failure here
// only means this one task misses reverse sync, never blocks the forward
// mirror that already succeeded.
export async function registerReverseMirror(
  externalTaskId: string,
  localTaskId: string,
): Promise<void> {
  const baseUrl = financieramenteBaseUrl();
  if (!baseUrl) {
    return;
  }

  try {
    await postToGenericWebhook(
      `${baseUrl.replace(/\/+$/, "")}/api/external-mirror/register`,
      { externalTaskId, localTaskId },
      mirrorSecret(),
    );
  } catch (error) {
    console.error(
      "external-mirror: failed to register reverse mapping with kaneo-mia",
      { externalTaskId, localTaskId, error },
    );
  }
}
