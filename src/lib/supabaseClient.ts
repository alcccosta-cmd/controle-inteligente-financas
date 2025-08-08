import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Public anon client for browser. URL and anon key are public and safe to expose.
// We read from a global window config to stay compatible with Lovable's Supabase integration.
// You can also set them in localStorage keys SUPABASE_URL and SUPABASE_ANON_KEY for local dev.

type SupabaseBrowserConfig = {
  url: string;
  anonKey: string;
};

function loadConfig(): SupabaseBrowserConfig | null {
  const w = window as any;
  const url = w.__SUPABASE_URL__ || localStorage.getItem("SUPABASE_URL");
  const anonKey = w.__SUPABASE_ANON_KEY__ || localStorage.getItem("SUPABASE_ANON_KEY");
  if (url && anonKey) return { url, anonKey };
  console.warn("Supabase config not found. Set window.__SUPABASE_URL__ and window.__SUPABASE_ANON_KEY__ or localStorage.");
  return null;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const cfg = loadConfig();
  if (!cfg) return null;
  client = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}
