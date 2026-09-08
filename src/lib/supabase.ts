/* ============================================================
   Cliente Supabase - Sistema Corporativo Restrito
   ============================================================
   Sistema de autenticação restrito sem cadastro público.
   Apenas usuários previamente cadastrados pelo Admin podem acessar.
   ============================================================ */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "admin" | "operator";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
}

export interface SystemUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  userEmail: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT";
  entityType: string;
  entityId: string | null;
  oldData: any;
  newData: any;
  createdAt: string;
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

/* Helper para verificar se o Supabase está configurado */
function getClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error("Supabase não configurado. Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY");
  }
  return supabaseClient;
}

/* ---------- API de autenticação corporativa ---------- */

export type AuthChangeCallback = (session: AuthSession | null) => void;

let authChangeCallbacks: AuthChangeCallback[] = [];

function notifyAuthChange(session: AuthSession | null) {
  authChangeCallbacks.forEach((cb) => cb(session));
}

async function getUserProfile(userId: string): Promise<AuthUser | null> {
  if (!supabaseClient) return null;
  
  const { data, error } = await supabaseClient
    .from("users")
    .select("id, email, name, role, is_active")
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role as UserRole,
    isActive: data.is_active,
  };
}

export const auth = {
  /** Retorna a sessão atual com perfil do usuário */
  async getSession(): Promise<AuthSession | null> {
    if (!supabaseClient) return null;
    
    const { data } = await supabaseClient.auth.getSession();
    if (!data.session?.user) return null;

    const profile = await getUserProfile(data.session.user.id);
    if (!profile || !profile.isActive) {
      await supabaseClient.auth.signOut();
      return null;
    }

    return {
      user: profile,
      accessToken: data.session.access_token,
    };
  },

  /** Login com email e senha (apenas usuários cadastrados pelo Admin) */
  async signIn(email: string, password: string): Promise<{ session: AuthSession | null; error?: string }> {
    if (!supabaseClient) {
      return { session: null, error: "Supabase não configurado. Configure as variáveis de ambiente." };
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (error) {
      return { session: null, error: "E-mail ou senha incorretos." };
    }

    if (!data.session?.user) {
      return { session: null, error: "Não foi possível fazer login." };
    }

    const profile = await getUserProfile(data.session.user.id);
    
    if (!profile) {
      await supabaseClient.auth.signOut();
      return { session: null, error: "Usuário não encontrado no sistema. Contate o administrador." };
    }

    if (!profile.isActive) {
      await supabaseClient.auth.signOut();
      return { session: null, error: "Usuário desativado. Contate o administrador." };
    }

    // Atualiza último login
    await supabaseClient
      .from("users")
      .update({ last_login: new Date().toISOString() })
      .eq("id", profile.id);

    // Registra log de auditoria
    await supabaseClient.from("audit_logs").insert({
      user_id: profile.id,
      user_email: profile.email,
      action: "LOGIN",
      entity_type: "user",
      entity_id: profile.id,
      new_data: { action: "login" },
    });

    const session: AuthSession = {
      user: profile,
      accessToken: data.session.access_token,
    };

    notifyAuthChange(session);
    return { session };
  },

  /** Logout com registro de auditoria */
  async signOut(): Promise<void> {
    if (!supabaseClient) return;

    const session = await this.getSession();
    
    if (session) {
      await supabaseClient.from("audit_logs").insert({
        user_id: session.user.id,
        user_email: session.user.email,
        action: "LOGOUT",
        entity_type: "user",
        entity_id: session.user.id,
        new_data: { action: "logout" },
      });
    }

    await supabaseClient.auth.signOut();
    notifyAuthChange(null);
  },

  /** Escuta mudanças de sessão */
  onAuthStateChange(callback: AuthChangeCallback): () => void {
    authChangeCallbacks.push(callback);

    if (!supabaseClient) {
      return () => {
        authChangeCallbacks = authChangeCallbacks.filter((cb) => cb !== callback);
      };
    }

    const { data } = supabaseClient.auth.onAuthStateChange(async (event, supabaseSession) => {
      if (supabaseSession?.user) {
        const profile = await getUserProfile(supabaseSession.user.id);
        if (profile && profile.isActive) {
          const session: AuthSession = {
            user: profile,
            accessToken: supabaseSession.access_token,
          };
          callback(session);
        } else {
          callback(null);
        }
      } else {
        callback(null);
      }
    });

    return () => {
      authChangeCallbacks = authChangeCallbacks.filter((cb) => cb !== callback);
      data.subscription.unsubscribe();
    };
  },

  /* ---------- Gestão de Usuários (Admin Only) ---------- */

  /** Lista todos os usuários (apenas admin) */
  async listUsers(): Promise<{ users: SystemUser[]; error?: string }> {
    if (!supabaseClient) return { users: [], error: "Supabase não configurado" };

    const { data, error } = await supabaseClient
      .from("users")
      .select("id, email, name, role, is_active, created_at, last_login")
      .order("created_at", { ascending: false });

    if (error) return { users: [], error: error.message };

    return {
      users: data.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role as UserRole,
        isActive: u.is_active,
        createdAt: u.created_at,
        lastLogin: u.last_login,
      })),
    };
  },

  /** Cria novo usuário (apenas admin) */
  async createUser(
    email: string,
    password: string,
    name: string,
    role: UserRole
  ): Promise<{ user: SystemUser | null; error?: string }> {
    const client = getClient();

    const { data: authData, error: authError } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) return { user: null, error: authError.message };
    if (!authData.user) return { user: null, error: "Não foi possível criar o usuário." };

    const { data: profileData, error: profileError } = await client
      .from("users")
      .insert({
        id: authData.user.id,
        email,
        name,
        role,
        is_active: true,
      })
      .select()
      .single();

    if (profileError) {
      await client.auth.admin.deleteUser(authData.user.id);
      return { user: null, error: profileError.message };
    }

    const session = await this.getSession();
    if (session) {
      await client.from("audit_logs").insert({
        user_id: session.user.id,
        user_email: session.user.email,
        action: "CREATE",
        entity_type: "user",
        entity_id: profileData.id,
        new_data: { email, name, role },
      });
    }

    return {
      user: {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        role: profileData.role as UserRole,
        isActive: profileData.is_active,
        createdAt: profileData.created_at,
        lastLogin: profileData.last_login,
      },
    };
  },

  /** Atualiza usuário (apenas admin) */
  async updateUser(
    userId: string,
    updates: { name?: string; role?: UserRole; isActive?: boolean }
  ): Promise<{ success: boolean; error?: string }> {
    const client = getClient();

    const { error } = await client
      .from("users")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) return { success: false, error: error.message };

    const session = await this.getSession();
    if (session) {
      await client.from("audit_logs").insert({
        user_id: session.user.id,
        user_email: session.user.email,
        action: "UPDATE",
        entity_type: "user",
        entity_id: userId,
        new_data: updates,
      });
    }

    return { success: true };
  },

  /** Desativa usuário (apenas admin) */
  async deactivateUser(userId: string): Promise<{ success: boolean; error?: string }> {
    return this.updateUser(userId, { isActive: false });
  },

  /** Reativa usuário (apenas admin) */
  async activateUser(userId: string): Promise<{ success: boolean; error?: string }> {
    return this.updateUser(userId, { isActive: true });
  },

  /** Exclui usuário permanentemente (apenas admin) */
  async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    const client = getClient();

    const session = await this.getSession();
    if (session) {
      await client.from("audit_logs").insert({
        user_id: session.user.id,
        user_email: session.user.email,
        action: "DELETE",
        entity_type: "user",
        entity_id: userId,
      });
    }

    const { error } = await client.auth.admin.deleteUser(userId);
    if (error) return { success: false, error: error.message };

    return { success: true };
  },

  /* ---------- Auditoria ---------- */

  /** Lista logs de auditoria */
  async listAuditLogs(limit: number = 100): Promise<{ logs: AuditLog[]; error?: string }> {
    if (!supabaseClient) return { logs: [], error: "Supabase não configurado" };

    const { data, error } = await supabaseClient
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { logs: [], error: error.message };

    return {
      logs: data.map((log) => ({
        id: log.id,
        userId: log.user_id,
        userEmail: log.user_email,
        action: log.action,
        entityType: log.entity_type,
        entityId: log.entity_id,
        oldData: log.old_data,
        newData: log.new_data,
        createdAt: log.created_at,
      })),
    };
  },

  /** Registra ação manual de auditoria */
  async logAction(
    action: "CREATE" | "UPDATE" | "DELETE",
    entityType: string,
    entityId: string,
    oldData?: any,
    newData?: any
  ): Promise<void> {
    if (!supabaseClient) return;

    const session = await this.getSession();
    if (!session) return;

    await supabaseClient.from("audit_logs").insert({
      user_id: session.user.id,
      user_email: session.user.email,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_data: oldData,
      new_data: newData,
    });
  },
};
