import { $ } from "bun";
import { mkdirSync, copyFileSync, cpSync } from "fs";

console.log("🔨 Building backend...");
await $`cd backend && bun run build`;

console.log("🎨 Building frontend...");
await $`cd frontend && bun run build`;

console.log("📦 Preparing Vercel output...");

// Copy API function
mkdirSync(".vercel/output/functions/api/index.func", { recursive: true });
copyFileSync("api/index.js", ".vercel/output/functions/api/index.func/index.js");

// Copy config for serverless function
await Bun.write(
  ".vercel/output/functions/api/index.func/.vc-config.json",
  JSON.stringify({
    runtime: "nodejs20.x",
    handler: "index.js",
    launcherType: "Nodejs",
  })
);

// Copy static frontend
mkdirSync(".vercel/output/static", { recursive: true });
cpSync("dist", ".vercel/output/static", { recursive: true });

// Create config.json
await Bun.write(
  ".vercel/output/config.json",
  JSON.stringify({
    version: 3,
    routes: [
      { src: "/api", dest: "/api/index" },
      { handle: "filesystem" },
      { src: "/(.*)", dest: "/index.html" },
    ],
  })
);

console.log("✅ Build complete!");
