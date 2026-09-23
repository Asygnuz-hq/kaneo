import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, like } from "drizzle-orm";
import db from "../database";
import {
  assetTable,
  projectTable,
  taskTable,
  workspaceTable,
} from "../database/schema";
import {
  buildMirroredObjectKey,
  getPrivateObject,
  isImageContentType,
  putObjectAtKey,
  sanitizePathSegment,
} from "../storage/s3";
import { mirrorSecret } from "./config";

// Files can't ride inside a webhook, so the receiving side pulls them: the
// sender exposes GET /api/external-mirror/asset/:id, authenticated by an HMAC
// of the asset id under the shared secret (same trust model as the events).
export function signAssetId(assetId: string): string {
  return createHmac("sha256", mirrorSecret()).update(assetId).digest("hex");
}

export function verifyAssetSignature(
  assetId: string,
  signature: string | undefined,
): boolean {
  if (!signature || !mirrorSecret()) {
    return false;
  }
  const expected = Buffer.from(signAssetId(assetId), "hex");
  const received = Buffer.from(signature, "hex");
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

export async function readAssetForMirror(assetId: string) {
  const [asset] = await db
    .select({
      objectKey: assetTable.objectKey,
      mimeType: assetTable.mimeType,
      filename: assetTable.filename,
    })
    .from(assetTable)
    .where(eq(assetTable.id, assetId))
    .limit(1);
  if (!asset) {
    return null;
  }
  const object = await getPrivateObject(asset.objectKey);
  return { ...asset, body: object.body as ReadableStream };
}

// Where rewritten links must point: this instance's own public API.
export function ownApiBase(): string {
  const explicit = process.env.KANEO_API_URL?.trim();
  const base =
    explicit ||
    `${(process.env.KANEO_CLIENT_URL ?? "").replace(/\/+$/, "")}/api`;
  return base.replace(/\/+$/, "");
}

const MAX_MIRRORED_ASSET_BYTES = 100 * 1024 * 1024;

type Target = {
  taskId: string;
  activityId?: string | null;
  surface: "description" | "comment";
};

// Copies one file from the other instance into our own storage and records
// it against a local task. Re-running for the same source file reuses the
// row created the first time (deterministic key), so an edited description
// that still contains the same link doesn't copy the file again.
export async function mirrorAsset(
  senderBaseUrl: string,
  sourceAssetId: string,
  target: Target,
): Promise<{ id: string; filename: string; isImage: boolean } | null> {
  const [context] = await db
    .select({
      projectId: taskTable.projectId,
      workspaceId: workspaceTable.id,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .innerJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
    .where(eq(taskTable.id, target.taskId))
    .limit(1);
  if (!context) {
    return null;
  }

  const [alreadyCopied] = await db
    .select({
      id: assetTable.id,
      filename: assetTable.filename,
      mimeType: assetTable.mimeType,
    })
    .from(assetTable)
    .where(
      and(
        eq(assetTable.taskId, target.taskId),
        like(
          assetTable.objectKey,
          `%/mirror-${sanitizePathSegment(sourceAssetId)}%`,
        ),
      ),
    )
    .limit(1);
  if (alreadyCopied) {
    return {
      id: alreadyCopied.id,
      filename: alreadyCopied.filename,
      isImage: isImageContentType(alreadyCopied.mimeType),
    };
  }

  const response = await fetch(
    `${senderBaseUrl.replace(/\/+$/, "")}/api/external-mirror/asset/${encodeURIComponent(sourceAssetId)}`,
    { headers: { "X-Kaneo-Signature": signAssetId(sourceAssetId) } },
  );
  if (!response.ok) {
    return null;
  }

  const contentType =
    response.headers.get("content-type") ?? "application/octet-stream";
  const filename = decodeURIComponent(
    response.headers.get("x-kaneo-filename") ?? sourceAssetId,
  );
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length === 0 || body.length > MAX_MIRRORED_ASSET_BYTES) {
    return null;
  }

  const uploadContext = {
    workspaceId: context.workspaceId,
    projectId: context.projectId,
    taskId: target.taskId,
    surface: target.surface,
    filename,
    contentType,
  };
  const key = buildMirroredObjectKey(uploadContext, sourceAssetId);

  const [existing] = await db
    .select({ id: assetTable.id })
    .from(assetTable)
    .where(
      and(eq(assetTable.objectKey, key), eq(assetTable.taskId, target.taskId)),
    )
    .limit(1);
  if (existing) {
    return {
      id: existing.id,
      filename,
      isImage: isImageContentType(contentType),
    };
  }

  await putObjectAtKey(key, body, contentType);

  const [asset] = await db
    .insert(assetTable)
    .values({
      workspaceId: context.workspaceId,
      projectId: context.projectId,
      taskId: target.taskId,
      activityId: target.activityId ?? null,
      objectKey: key,
      filename,
      mimeType: contentType,
      size: body.length,
      kind: isImageContentType(contentType) ? "image" : "attachment",
      surface: target.surface,
      createdBy: null,
    })
    .returning({ id: assetTable.id });
  if (!asset) {
    return null;
  }
  return { id: asset.id, filename, isImage: isImageContentType(contentType) };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Rewrites every link to the sender's /api/asset/<id> so it points at our own
// copy. A file that can't be fetched keeps its original link, which simply
// stays as broken as it would have been without the mirror.
export async function localizeAssetLinks(
  text: string,
  senderBaseUrl: string,
  target: Target,
): Promise<string> {
  if (!senderBaseUrl) {
    return text;
  }
  const pattern = new RegExp(
    `${escapeRegExp(senderBaseUrl.replace(/\/+$/, ""))}/api/asset/([A-Za-z0-9]+)`,
    "g",
  );
  const ids = [
    ...new Set([...text.matchAll(pattern)].map((m) => m[1] as string)),
  ];
  let result = text;
  for (const sourceId of ids) {
    try {
      const copied = await mirrorAsset(senderBaseUrl, sourceId, target);
      if (copied) {
        result = result.replaceAll(
          `${senderBaseUrl.replace(/\/+$/, "")}/api/asset/${sourceId}`,
          `${ownApiBase()}/asset/${copied.id}`,
        );
      }
    } catch (error) {
      console.error("external-mirror: could not copy attachment", {
        sourceId,
        error,
      });
    }
  }
  return result;
}
