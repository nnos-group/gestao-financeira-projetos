import { createClient } from "@supabase/supabase-js";

// Cliente de servidor com privilégios totais. Usar APENAS em código de servidor (route handlers, server actions, scripts).
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Variáveis do Supabase (URL / SERVICE_ROLE_KEY) não configuradas.");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Modo desenvolvimento sem login.
export function authDisabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.AUTH_DISABLED === "true";
}
