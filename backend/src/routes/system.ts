import { Hono } from "hono";
import db from "../db";
import { backupDatabase } from "../lib/backup";
import { logger } from "../lib/logger";
import { apiResponse } from "../lib/response";
import { SystemStats } from "../types";

const system = new Hono();
/**
 * System Health & Diagnostics
 */
// Cache health status to avoid rate limits and reduce latency
let lastCheck = 0;
let cachedDiscordStatus = "unknown";
const CACHE_TTL = 30000; // 30 seconds

system.get("/health", async (c) => {
  const now = Date.now();
  const stats: SystemStats = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: "offline",
    discord: "checking", // Will be overwritten
    version: "2.0",
    debug: process.env.DEBUG === "true",
  };

  try {
    // 1. Check Supabase (Fast enough to run every time)
    const { error } = await db.from("files").select("id").limit(1);
    if (!error) {
      stats.database = "online";
    }
  } catch (error) {
    logger.error(error, "DB Health Check Failed:");
    stats.database = "error";
  }

  // 2. Check Discord Connectivity (Cached)
  if (now - lastCheck > CACHE_TTL || cachedDiscordStatus === "unknown") {
    try {
      const start = Date.now();
      const discordRes = await fetch("https://discord.com/api/v10/gateway", {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      });

      if (discordRes.ok) {
        const latency = Date.now() - start;
        cachedDiscordStatus = `online (${latency}ms)`;
      } else {
        cachedDiscordStatus = `unauthorized/failed (${discordRes.status})`;
      }
    } catch (error) {
      logger.error(error, "Discord Health Check Failed:");
      cachedDiscordStatus = "unreachable";
    }
    lastCheck = now;
  }

  stats.discord = cachedDiscordStatus;

  return apiResponse.success<SystemStats>(c, stats);
});

/**
 * Storage Statistics
 */
system.get("/stats", async (c) => {
  try {
    // Get total files and size
    // Note: sum(size) might be heavy on large tables without aggregate materialized view or approximation.
    // Supabase/Postgres count is fast with approximate, but sum needs scan.

    const { count, error: countError } = await db
      .from("files")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    // For total size, we might need a stored procedure or just sum it if rows are few.
    // Call the RPC to get total size
    const { data: totalSize, error: sizeError } =
      await db.rpc("get_total_size");

    // Call the RPC to get database size
    const { data: dbSize, error: dbSizeError } = await db.rpc("get_db_size");

    if (countError) {
      logger.error(countError, "Count Error:");
      throw countError;
    }
    if (sizeError) {
      logger.error(sizeError, "Size Error:");
      throw sizeError;
    }
    if (dbSizeError) {
      logger.error(
        dbSizeError,
        "DB Size RPC Error (Did you run the SQL in Supabase?):",
      );
    }

    return apiResponse.success(c, {
      storage: {
        totalFiles: count || 0,
        totalSize: totalSize || 0,
      },
      dbSize: dbSize || 0,
    });
  } catch (error: unknown) {
    logger.error(error, "Stats Error:");
    return apiResponse.error(c, "Failed to fetch storage stats", 500);
  }
});

/**
 * Trigger manual redundant backup
 */
system.post("/backup", async (c) => {
  try {
    logger.info("Manual backup triggered via API");
    // Run in background to avoid blocking the user
    backupDatabase().catch((err: unknown) => {
      logger.error(err, "Background manual backup failed:");
    });

    return apiResponse.success(c, { message: "Backup initiative started." });
  } catch (error: unknown) {
    logger.error(error, "Manual Backup Trigger Error:");
    return apiResponse.error(c, "Failed to initiate backup", 500);
  }
});

export default system;
