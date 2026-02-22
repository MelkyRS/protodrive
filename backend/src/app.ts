import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { logger } from "./lib/logger";
import { apiResponse } from "./lib/response";

// Routes
import download from "./routes/download";
import files from "./routes/files";
import stream from "./routes/stream";
import system from "./routes/system";
import upload from "./routes/upload";

const app = new Hono();

// Middleware
app.use("*", honoLogger());
app.use("*", cors());

/**
 * Security Layer: API_SECRET Validation
 * Ensures only authorized clients can talk to the librarian.
 */

app.use("/api/*", async (c, next) => {
  const secret =
    c.req.header("Authorization") ||
    c.req.header("X-API-Key") ||
    c.req.query("token");
  const API_SECRET = process.env.API_SECRET;

  logger.debug(
    {
      received: secret ? secret.substring(0, 5) + "..." : "none",
      expected: API_SECRET ? API_SECRET.substring(0, 5) + "..." : "none",
    },
    "Auth Verification:",
  );

  if (!API_SECRET) {
    if (process.env.NODE_ENV === "production" || !!process.env.VERCEL) {
      logger.error(
        "Security configuration error: API_SECRET is not set in production environment.",
      );
      return apiResponse.error(c, "Server Misconfiguration", 500);
    }
    logger.warn(
      "Security warning: API_SECRET is not set. The server is vulnerable.",
    );
  }

  if (API_SECRET && secret !== API_SECRET) {
    logger.warn(
      `Unauthorized access attempt. Header: ${c.req.header("User-Agent")}`,
    );
    return apiResponse.error(c, "Unauthorized", 401);
  }
  await next();
});

// Route Registration
app.get("/api", (c) => {
  return apiResponse.success(c, {
    status: "active",
    librarian: "Proto Drive 🐾",
    version: "2.1.0",
    engine: !!process.env.VERCEL
      ? "Vercel Edge Serverless"
      : "Bun + Hono + Supabase",
    debug: process.env.DEBUG === "true",
  });
});

app.route("/api/upload", upload);
app.route("/api/files", files);
app.route("/api/download", download);
app.route("/api/stream", stream);
app.route("/api/system", system);

// 404 & Error Handling
app.notFound((c) => apiResponse.error(c, "Not Found", 404));
app.onError((err, c) => {
  logger.error(err as Error, "Fatal Server Error:");
  return apiResponse.error(c, "Internal Server Error", 500);
});

export { app };
