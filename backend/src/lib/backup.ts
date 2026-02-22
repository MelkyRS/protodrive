import { logger } from "./logger";

/**
 * Uploads the SQLite database to Discord as a backup
 * @deprecated Database is now Supabase (PostgreSQL), which has its own backup.
 */
export async function backupDatabase() {
  logger.debug(
    "Backup requested, but database is migrated to Supabase (Managed). Skipping.",
  );
  return;
}
