/* ============================================================
   Cliente Supabase — fonte de verdade para Pacientes/Clientes.
   Configurado via variáveis de ambiente do Vite:
     VITE_SUPABASE_URL       → URL do projeto (https://xxx.supabase.co)
     VITE_SUPABASE_ANON_KEY  → chave pública (anon) do projeto

   Quando as variáveis NÃO estão definidas (ex.: pré-visualização),
   o app opera em "modo local" (localStorage) sem quebrar.
   ============================================================ */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true quando há credenciais válidas → modo nuvem ativo */
export const isSupabaseConfigured = Boolean(url && anonKey);

/** Cliente único (null em modo local) */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
