import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth, isSupabaseConfigured, type AuthSession, type AuthUser } from "../lib/supabase";

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  isDemo: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carrega sessão inicial
    auth.getSession().then((s) => {
      setSession(s);
      setLoading(false);
    });

    // Escuta mudanças de sessão
    const unsubscribe = auth.onAuthStateChange((s) => {
      setSession(s);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await auth.signIn(email, password);
    return { error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await auth.signUp(email, password, name);
    return { error };
  };

  const signOut = async () => {
    await auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        isDemo: !isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        user: session?.user ?? null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
