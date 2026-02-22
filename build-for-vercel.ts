import { $ } from "bun";
import { mkdirSync, copyFileSync, cpSync } from "fs";

console.log("🔨 Building backend...");
await $`cd backend && bun run build`;

console.log("🎨 Building frontend...");
await $`cd frontend && bun run build`;

console.log("📦 Preparing Vercel output...");

console.log("✅ Build complete!");
