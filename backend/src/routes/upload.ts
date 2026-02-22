import { Hono } from "hono";
import db from "../db";
import { backupDatabase } from "../lib/backup";
import { uploadToDiscord } from "../lib/discord";
import { logger } from "../lib/logger";
import { apiResponse } from "../lib/response";
import { FileMetadata } from "../types";

const upload = new Hono();

/**
 * Handle individual chunk upload
 * Client sends encrypted ArrayBuffer via UpChunk
 */
upload.post("/file/:id/chunk", async (c) => {
  const fileId = c.req.param("id");
  // Smart Chunk Indexing
  let chunkIndex = 0;
  const chunkHeader = c.req.header("X-Chunk-Number");
  const contentRange = c.req.header("Content-Range"); // bytes start-end/total

  if (chunkHeader) {
    chunkIndex = parseInt(chunkHeader) - 1;
  } else if (contentRange) {
    const match = contentRange.match(/bytes (\d+)-(\d+)\/(\d+)/);
    if (match) {
      const start = parseInt(match[1]);
      if (start === 0) {
        chunkIndex = 0;
      } else {
        // Fetch size of chunk 0
        const { data: chunk0 } = await db
          .from("chunks")
          .select("size")
          .eq("file_id", fileId)
          .eq("idx", 0)
          .single();

        if (chunk0) {
          chunkIndex = Math.round(start / chunk0.size);
        } else {
          logger.warn(
            `Received chunk at offset ${start} but Chunk 0 is missing. Assuming Index 0 (RISKY).`,
          );
          chunkIndex = 0;
        }
      }
    }
  }

  logger.debug(
    `[Upload Debug] Computed Chunk Index: ${chunkIndex} (Range: ${contentRange})`,
  );

  const buffer = await c.req.arrayBuffer();

  if (!buffer || buffer.byteLength === 0) {
    return apiResponse.error(c, "Empty chunk", 400);
  }

  // Validate File Existence before uploading to Discord
  // Validate File Existence before uploading to Discord
  const { data: fileExists } = await db
    .from("files")
    .select("id")
    .eq("id", fileId)
    .eq("status", "pending")
    .single();

  if (!fileExists) {
    logger.warn(
      `Rejected chunk ${chunkIndex} for aborted/missing file: ${fileId}`,
    );
    return apiResponse.error(c, "Upload session invalid or aborted", 404);
  }

  try {
    logger.debug(
      `Starting chunk upload for file ${fileId}, index ${chunkIndex}`,
    );

    // 0. Idempotency Check: Remove existing chunk if retrying
    const { data: existingChunk } = await db
      .from("chunks")
      .select("message_id")
      .eq("file_id", fileId)
      .eq("idx", chunkIndex)
      .single();

    if (existingChunk) {
      logger.warn(
        `Overwriting existing chunk ${chunkIndex} for file ${fileId}`,
      );
      // Remove DB Record
      await db
        .from("chunks")
        .delete()
        .eq("file_id", fileId)
        .eq("idx", chunkIndex);

      // Async cleanup (Fire & Forget)
      const { bulkDeleteFromDiscord } = await import("../lib/discord");
      bulkDeleteFromDiscord([existingChunk.message_id]).catch((err) =>
        logger.error("Failed to clean up overwritten chunk:", err),
      );
    }

    // 1. Proxy to Discord
    const filename = `chunk_${fileId}_${chunkIndex}.bin`;
    const attachment = await uploadToDiscord(
      buffer,
      filename,
      c.req.raw.signal,
    );

    logger.debug(`Chunk ${chunkIndex} uploaded to Discord: ${attachment.id}`);

    // 2. Double Check: Verify file still exists (Race Condition Protection)
    const { data: fileStillExists } = await db
      .from("files")
      .select("id")
      .eq("id", fileId)
      .eq("status", "pending")
      .single();

    if (!fileStillExists) {
      logger.warn(
        `File ${fileId} aborted during chunk ${chunkIndex} upload. Cleaning up orphaned chunk.`,
      );
      // Immediate cleanup of the just-uploaded chunk
      const { bulkDeleteFromDiscord } = await import("../lib/discord");
      bulkDeleteFromDiscord([attachment.id]).catch((err) =>
        logger.error("Failed to clean up orphaned chunk:", err),
      );
      return apiResponse.error(c, "Upload aborted during transfer", 404);
    }

    // 3. Save Chunk Metadata to Supabase
    const { error: insertError } = await db.from("chunks").insert({
      file_id: fileId,
      idx: chunkIndex,
      message_id: attachment.id,
      channel_id: process.env.DISCORD_CHANNEL_ID || "",
      size: buffer.byteLength,
      url: attachment.url,
    });

    if (insertError) throw insertError;

    return apiResponse.success(c, {
      messageId: attachment.id,
    });
  } catch (error: unknown) {
    logger.error(error, `Chunk ${chunkIndex} Error:`);
    return apiResponse.error(c, "Failed to upload chunk to storage", 500);
  }
});

/**
 * Finalize file upload
 * Saves initial file metadata
 */
upload.post("/file/init", async (c) => {
  const { id, name, size, type, iv, salt } =
    (await c.req.json()) as Partial<FileMetadata>;

  if (!id || !name || size === undefined) {
    return apiResponse.error(c, "Missing file metadata", 400);
  }

  try {
    // Check if ID already exists
    const { data: existing } = await db
      .from("files")
      .select("status")
      .eq("id", id)
      .single();

    if (existing) {
      if (existing.status === "active") {
        return apiResponse.error(
          c,
          "File ID already exists and is active",
          409,
        );
      }
      logger.debug(`Replacing pending file record: ${id}`);
      await db.from("files").delete().eq("id", id);
    }

    logger.debug(`Initializing file record: ${name} (${id})`);

    // Prepare tsvector manually or let trigger handle it?
    // We already have a trigger 'files_search_vector_update' in scheme.

    const { error: insertError } = await db.from("files").insert({
      id,
      name,
      size,
      type: type || "application/octet-stream",
      iv: iv || "",
      salt: salt || "",
      status: "pending",
      // created_at is default now()
    });

    if (insertError) throw insertError;
    return apiResponse.success(c);
  } catch (error: unknown) {
    logger.error(error as Error, "Init Error:");
    return apiResponse.error(c, "Failed to initialize file record", 500);
  }
});

/**
 * Get uploaded chunk indices for a file
 * Used for resumable upload discovery
 */
upload.get("/file/:id/chunks", async (c) => {
  const fileId = c.req.param("id");
  try {
    const { data: chunks, error } = await db
      .from("chunks")
      .select("idx")
      .eq("file_id", fileId);

    if (error) throw error;

    return apiResponse.success(
      c,
      chunks.map((ch) => ch.idx),
    );
  } catch (error: unknown) {
    logger.error(error as Error, "Chunk Discovery Error:");
    return apiResponse.error(c, "Failed to fetch chunk metadata", 500);
  }
});

/**
 * Finalize file upload status
 */
upload.post("/file/:id/finalize", async (c) => {
  const fileId = c.req.param("id");

  try {
    logger.info(`Finalizing file ${fileId}`);

    const { error } = await db
      .from("files")
      .update({ status: "active" })
      .eq("id", fileId);

    if (error) throw error;

    const skipBackup = c.req.query("skip_backup") === "true";

    // Supabase handles vacuuming
    // Trigger background backup unless skipped (Supabase backup is managed)
    // Keeping this logic in case we want to do something else

    if (!skipBackup) {
      backupDatabase().catch((err: unknown) => {
        logger.error(err, "Background task failed:");
      });
    } else {
      logger.debug(`Skipping backup for file ${fileId} (batch mode)`);
    }

    return apiResponse.success(c);
  } catch (error: unknown) {
    logger.error(error as Error, "Finalize Error:");
    return apiResponse.error(c, "Failed to finalize file", 500);
  }
});

/**
 * Abort archival process
 * Cleans up pending records and purged shards from Discord
 */
upload.post("/file/:id/abort", async (c) => {
  const fileId = c.req.param("id");

  try {
    logger.info(`Aborting archival for file ${fileId}`);
    logger.info(`Aborting archival for file ${fileId}`);
    // 1. Get shard IDs for cleanup
    const { data: chunks } = await db
      .from("chunks")
      .select("message_id")
      .eq("file_id", fileId);

    const messageIds = chunks?.map((c) => c.message_id) || [];

    // 2. Delete metadata (Foreign key cascade handles chunks)
    await db.from("files").delete().eq("id", fileId).eq("status", "pending");

    logger.debug(
      `Purged pending metadata for ${fileId}, cleaning up ${messageIds.length} shards`,
    );

    // 3. Trigger Discord Cleanup
    if (messageIds.length > 0) {
      const { bulkDeleteFromDiscord } = await import("../lib/discord");
      bulkDeleteFromDiscord(messageIds).catch((err: unknown) => {
        logger.error(
          err as Error,
          `Background abort cleanup failed for ${fileId}:`,
        );
        // logger.error(err, `Background abort cleanup failed for ${fileId}:`);
      });
    }

    return apiResponse.success(c);
  } catch (error: unknown) {
    logger.error(error as Error, `Purge Error for ${fileId}:`);
    return apiResponse.error(c, "Failed to abort archival", 500);
  }
});

/**
 * Bulk purge all pending uploads
 */
upload.delete("/file/pending/all", async (c) => {
  try {
    logger.info("Bulk purging all pending uploads");
    // 1. Get all chunks for all pending files
    // 1. Get all chunks for all pending files
    // Complex subquery; do in two steps or use join
    const { data: chunks } = await db
      .from("chunks")
      .select("message_id, files!inner(status)")
      .eq("files.status", "pending");

    const messageIds =
      chunks?.map((c: { message_id: string }) => c.message_id) || [];

    // 2. Delete from DB (Delete files, cascade chunks)
    await db.from("files").delete().eq("status", "pending");

    logger.debug(
      `Purged all pending metadata, cleaning up ${messageIds.length} shards`,
    );

    // 3. Trigger Discord Cleanup
    if (messageIds.length > 0) {
      const { bulkDeleteFromDiscord } = await import("../lib/discord");
      bulkDeleteFromDiscord(messageIds).catch((err: unknown) => {
        logger.error(err, "Background bulk-purge cleanup failed:");
      });
    }

    return apiResponse.success(c, { purgedCount: messageIds.length });
  } catch (error: unknown) {
    logger.error(error as Error, "Bulk Purge Error:");
    return apiResponse.error(c, "Failed to purge pending uploads", 500);
  }
});

export default upload;
