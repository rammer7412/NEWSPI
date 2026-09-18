import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "@/lib/supabase/config";

export async function createClient() {
  const { url, key } = supabaseConfig();
  const cookieStore = await cookies();
  type CookieItem = { name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] };
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(items: CookieItem[]) {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // A Server Component cannot write cookies; proxy.ts refreshes sessions.
        }
      },
    },
  });
}
