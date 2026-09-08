/* ============================================================
   Cliente Supabase + modo demo local
   ============================================================
   Se as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
   estiverem configuradas, usa Supabase Auth real.
   Caso contrário, usa um modo demo local (email/senha salvos
   em localStorage) para que o app continue funcionando em
   pré-visualizações sem backend.
   ============================================================ */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let supabaseClient: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  supabaseClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export { supabaseClient };

/* ---------- Modo demo local (fallback) ---------- */

const DEMO_USERS_KEY = "dosecerta:demoUsers";
const DEMO_SESSION_KEY = "dosecerta:demoSession";

interface DemoUser {
  id: string;
  email: string;
  password: string;
  name: string;
}

function getDemoUsers(): DemoUser[] {
  try {
    const raw = localStorage.getItem(DEMO_USERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* corrompido */
  }
  // Usuário demo padrão
  const defaultUser: DemoUser = {
    id: "demo-user-001",
    email: "demo@dosecerta.com",
    password: "demo1234",
    name: "Usuário Demo",
  };
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify([defaultUser]));
  return [defaultUser];
}

function getDemoSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* corrompido */
  }
  return null;
}

function setDemoSession(session: AuthSession | null) {
  if (session) {
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(DEMO_SESSION_KEY);
  }
}

/* ---------- API de autenticação unificada ---------- */

export type AuthChangeCallback = (session: AuthSession | null) => void;

let authChangeCallbacks: AuthChangeCallback[] = [];

function notifyAuthChange(session: AuthSession | null) {
  authChangeCallbacks.forEach((cb) => cb(session));
}

export const auth = {
  /** Retorna a sessão atual (Supabase ou demo) */
  async getSession(): Promise<AuthSession | null> {
    if (supabaseClient) {
      const { data } = await supabaseClient.auth.getSession();
      if (data.session?.user) {
        return {
          user: {
            id: data.session.user.id,
            email: data.session.user.email ?? "",
            name: data.session.user.user_metadata?.name ?? data.session.user.email?.split("@")[0] ?? "Usuário",
          },
          accessToken: data.session.access_token,
        };
      }
      return null;
    }
    return getDemoSession();
  },

  /** Login com email e senha */
  async signIn(email: string, password: string): Promise<{ session: AuthSession | null; error?: string }> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) return { session: null, error: error.message };
      if (data.session?.user) {
        const session: AuthSession = {
          user: {
            id: data.session.user.id,
            email: data.session.user.email ?? "",
            name: data.session.user.user_metadata?.name ?? data.session.user.email?.split("@")[0] ?? "Usuário",
          },
          accessToken: data.session.access_token,
        };
        notifyAuthChange(session);
        return { session };
      }
      return { session: null, error: "Não foi possível fazer login." };
    }

    // Modo demo
    const users = getDemoUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) {
      return { session: null, error: "E-mail ou senha incorretos." };
    }
    const session: AuthSession = {
      user: { id: user.id, email: user.email, name: user.name },
      accessToken: "demo-token-" + Date.now(),
    };
    setDemoSession(session);
    notifyAuthChange(session);
    return { session };
  },

  /** Cadastro de novo usuário */
  async signUp(email: string, password: string, name: string): Promise<{ session: AuthSession | null; error?: string }> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) return { session: null, error: error.message };
      if (data.session?.user) {
        const session: AuthSession = {
          user: {
            id: data.session.user.id,
            email: data.session.user.email ?? "",
            name: data.session.user.user_metadata?.name ?? name,
          },
          accessToken: data.session.access_token,
        };
        notifyAuthChange(session);
        return { session };
      }
      // Se o Supabase exigir confirmação de email, retorna sem sessão
      return { session: null, error: "Verifique seu e-mail para confirmar o cadastro." };
    }

    // Modo demo
    const users = getDemoUsers();
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { session: null, error: "Este e-mail já está cadastrado." };
    }
    const newUser: DemoUser = {
      id: "demo-user-" + Date.now(),
      email,
      password,
      name,
    };
    users.push(newUser);
    localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
    const session: AuthSession = {
      user: { id: newUser.id, email: newUser.email, name: newUser.name },
      accessToken: "demo-token-" + Date.now(),
    };
    setDemoSession(session);
    notifyAuthChange(session);
    return { session };
  },

  /** Logout */
  async signOut(): Promise<void> {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    } else {
      setDemoSession(null);
    }
    notifyAuthChange(null);
  },

  /** Escuta mudanças de sessão */
  onAuthStateChange(callback: AuthChangeCallback): () => void {
    authChangeCallbacks.push(callback);

    if (supabaseClient) {
      const { data: subscription } = supabaseClient.auth.onAuthStateChange(async (event, supabaseSession) => {
        if (supabaseSession?.user) {
          const session: AuthSession = {
            user: {
              id: supabaseSession.user.id,
              email: supabaseSession.user.email ?? "",
              name: supabaseSession.user.user_metadata?.name ?? supabaseSession.user.email?.split("@")[0] ?? "Usuário",
            },
            accessToken: supabaseSession.access_token,
          };
          callback(session);
        } else {
          callback(null);
        }
      });
      return () => {
        authChangeCallbacks = authChangeCallbacks.filter((cb) => cb !== callback);
        subscription?.subscription.unsubscribe();
      };
    }

    return () => {
      authChangeCallbacks = authChangeCallbacks.filter((cb) => cb !== callback);
    };
  },
};
