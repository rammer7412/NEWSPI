import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/supabase/config";

export function createClient() {
  const { url, key } = supabaseConfig();
  return createBrowserClient(url, key);
}
