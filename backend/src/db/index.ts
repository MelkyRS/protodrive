import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const SUPABASE_URL = process.env.SUPABASE_URL;
// Use service role key if available for backend operations to bypass RLS,
// otherwise use anon key but RLS policies must allow server operations.
// Given this is a backend server, Service Role is appropriate for full access without user context.
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("CRITICAL: Missing Supabase configuration.");
  console.error(
    "Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in Vercel Environment Variables.",
  );
}

const db = createClient(SUPABASE_URL || "", SUPABASE_KEY || "");

export default db;
