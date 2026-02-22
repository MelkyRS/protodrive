import { Hono } from "hono";
import db from "../db";
import { backupDatabase } from "../lib/backup";
import { bulkDeleteFromDiscord } from "../lib/discord";
import { logger } from "../lib/logger";
import { apiResponse } from "../lib/response";
import {
  ChunkMetadata,
  DBFile,
  FileMetadata,
  PaginatedResponse,
} from "../types";

const files = new Hono();

/**
 * List all active files (with Pagination)
 */
files.get("/", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "50");
    const offset = parseInt(c.req.query("offset") || "0");
    const status = c.req.query("status") || "active"; // 'active' or 'trashed'

    logger.debug(
      `Listing files (status: ${status}, limit: ${limit}, offset: ${offset})`,
    );

    // Get files with pagination
    const {
      data: allFiles,
      error: filesError,
      count,
    } = await db
      .from("files")
      .select(
        "id, name, size, type, iv, salt, status, created_at, chunks(count)",
        { count: "exact" },
      )
      .eq("status", status)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (filesError) {
      throw filesError;
    }

    // Map response to match expected format
    const mappedFiles: FileMetadata[] = (allFiles as unknown as DBFile[]).map(
      (f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type,
        iv: f.iv,
        salt: f.salt,
        status: f.status,
        createdAt: new Date(f.created_at).getTime(),
        chunks: f.chunks && f.chunks.length > 0 ? f.chunks[0].count : 0,
      }),
    );

    return apiResponse.success<PaginatedResponse<FileMetadata>>(c, {
      items: mappedFiles,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    logger.error(error, "Failed to list files:");
    return apiResponse.error(c, "Failed to list files", 500);
  }
});

/**
 * Search files using FTS5 (Filtered by Status)
 */
files.get("/search", async (c) => {
  const query = c.req.query("q");
  const status = c.req.query("status") || "active";

  if (!query) {
    return c.redirect(`/api/files?status=${status}`);
  }

  try {
    logger.debug(`Searching files for: "${query}" (status: ${status})`);

    // Perform Full Text Search
    const { data: results, error } = await db
      .from("files")
      .select("id, name, size, type, iv, salt, status, created_at")
      .eq("status", status)
      .textSearch("search_vector", `'${query}'`);

    if (error) {
      throw error;
    }

    const mappedResults: FileMetadata[] = (results as unknown as DBFile[]).map(
      (f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type,
        iv: f.iv,
        salt: f.salt,
        status: f.status,
        createdAt: new Date(f.created_at).getTime(),
      }),
    );

    return apiResponse.success<FileMetadata[]>(c, mappedResults);
  } catch (error: unknown) {
    logger.error(error as Error, `Search error for "${query}":`);
    return apiResponse.error(c, "Search failed", 500);
  }
});

/**
 * Get file details including chunk mapping
 */
files.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    logger.debug(`Fetching file details for ${id}`);

    const { data: file, error: fileError } = await db
      .from("files")
      .select("id, name, size, type, iv, salt, status, created_at")
      .eq("id", id)
      .single();

    if (fileError || !file) {
      logger.warn(`File not found: ${id}`);
      return apiResponse.error(c, "File not found", 404);
    }

    const { data: chunks, error: chunksError } = await db
      .from("chunks")
      .select("*")
      .eq("file_id", id)
      .order("idx", { ascending: true });

    if (chunksError) {
      throw chunksError;
    }

    const fileData = file as unknown as DBFile;

    return apiResponse.success<
      Omit<FileMetadata, "chunks"> & { chunks: ChunkMetadata[] }
    >(c, {
      id: fileData.id,
      name: fileData.name,
      size: fileData.size,
      type: fileData.type,
      iv: fileData.iv,
      salt: fileData.salt,
      status: fileData.status,
      chunks: chunks as ChunkMetadata[],
      createdAt: new Date(fileData.created_at).getTime(),
    });
  } catch (error: unknown) {
    logger.error(error as Error, `Failed to fetch file details for ${id}:`);
    return apiResponse.error(c, "Failed to fetch file details", 500);
  }
});

/**
 * Restore file from Trash
 */
files.post("/:id/restore", async (c) => {
  const id = c.req.param("id");
  try {
    const { data: file } = await db
      .from("files")
      .select("status")
      .eq("id", id)
      .single();

    if (!file) return apiResponse.error(c, "File not found", 404);

    if (file.status !== "trashed") {
      return apiResponse.error(c, "File is not in trash", 400);
    }

    const { error: updateError } = await db
      .from("files")
      .update({ status: "active" })
      .eq("id", id);

    if (updateError) {
      throw updateError;
    }

    logger.info(`Restored file ${id} from trash`);

    backupDatabase().catch((err: unknown) => {
      logger.error(err, "Background backup failed after restoration:");
    });

    return apiResponse.success(c, { message: "File restored" });
  } catch (error: unknown) {
    logger.error(error, `Restoration Error for ${id}:`);
    return apiResponse.error(c, "Failed to restore file", 500);
  }
});

/**
 * Empty Trash (Hard Delete all trashed files)
 */
files.delete("/trash", async (c) => {
  try {
    // Get all chunks for trashed files
    const { data: chunks, error: chunksError } = await db
      .from("chunks")
      .select("message_id, files!inner(status)")
      .eq("files.status", "trashed");

    if (chunksError) throw chunksError;

    if (!chunks || chunks.length === 0) {
      return apiResponse.success(c, {
        message: "Trash is already empty",
        deletedCount: 0,
      });
    }

    const messageIds = chunks.map((c: { message_id: string }) => c.message_id);

    // Delete files (CASCADE deletes chunks)
    const { error: deleteError, count } = await db
      .from("files")
      .delete({ count: "exact" })
      .eq("status", "trashed");

    if (deleteError) throw deleteError;

    logger.info(
      `Emptied trash: Deleted ${count} files and cleaning up ${messageIds.length} chunks`,
    );

    // Async cleanup on Discord
    const { bulkDeleteFromDiscord } = await import("../lib/discord");
    bulkDeleteFromDiscord(messageIds).catch((err: unknown) => {
      logger.error(err, "Background Discord cleanup failed for empty trash:");
    });

    backupDatabase().catch((err: unknown) => {
      logger.error(err, "Background backup failed after empty trash:");
    });

    return apiResponse.success(c, {
      message: "Trash emptied",
      deletedCount: count,
    });
  } catch (error: unknown) {
    logger.error(error, "Failed to empty trash:");
    return apiResponse.error(c, "Failed to empty trash", 500);
  }
});

/**
 * Delete file (Soft Delete -> Hard Delete)
 */
files.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const { data: file } = await db
      .from("files")
      .select("status, name")
      .eq("id", id)
      .single();

    if (!file) return apiResponse.error(c, "File not found", 404);

    // 1. Soft Delete: Active -> Trashed
    if (file.status === "active") {
      const { error } = await db
        .from("files")
        .update({ status: "trashed" })
        .eq("id", id);
      if (error) throw error;

      logger.info(`Soft deleted (trashed) file ${id}`);

      backupDatabase().catch((err: unknown) => {
        logger.error(err, "Background backup failed after trashing:");
      });

      return apiResponse.success(c, { message: "File moved to trash" });
    }

    // 2. Hard Delete: Trashed -> Permanent
    logger.info(`Permanently deleting file ${id}`);

    const { data: chunks } = await db
      .from("chunks")
      .select("message_id")
      .eq("file_id", id);
    const messageIds =
      chunks?.map((c: { message_id: string }) => c.message_id) || [];

    const { error: deleteError } = await db.from("files").delete().eq("id", id);
    if (deleteError) throw deleteError;

    logger.debug(
      `Deleted metadata for ${id}, cleaning up ${messageIds.length} chunks on Discord`,
    );

    bulkDeleteFromDiscord(messageIds).catch((err: unknown) => {
      logger.error(
        err as Error,
        `Background Discord cleanup failed for ${id}:`,
      );
    });

    backupDatabase().catch((err: unknown) => {
      logger.error(err, "Background backup failed after deletion:");
    });

    return apiResponse.success(c, { message: "File permanently deleted" });
  } catch (error: unknown) {
    logger.error(error as Error, `Deletion Error for ${id}:`);
    return apiResponse.error(c, "Failed to delete file", 500);
  }
});

export default files;
