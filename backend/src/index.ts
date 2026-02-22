import { app } from "./app";
import { logger } from "./lib/logger";
import { serve } from "@hono/node-server";

const port = process.env.PORT || 3000;
logger.info(`Librarian starting on port ${port} (Safe Mode)`);

serve({
  fetch: app.fetch,
  port,
});
