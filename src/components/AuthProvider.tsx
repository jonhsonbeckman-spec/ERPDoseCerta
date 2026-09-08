import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth, type AuthSession, type AuthUser, isSupabaseConfigured, supabaseClient } from "../lib/supabase";

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  user: AuthUser | null;
  connectionStatus: "ok" | "error" | "checking";
  connectionMessage: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<"ok" | "error" | "checking">("checking");
  const [connectionMessage, setConnectionMessage] = useState("Verificando conexão...");

  useEffect(() => {
    // Verifica conexão com Supabase
    if (!isSupabaseConfigured) {
      setConnectionStatus("error");
      setConnectionMessage("Supabase não configurado. Verifique as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY");
      setLoading(false);
      return;
    }

    // Testa conexão fazendo uma query simples
    const testConnection = async () => {
      try {
        if (!supabaseClient) {
          setConnectionStatus("error");
          setConnectionMessage("Cliente Supabase não inicializado.");
          return;
        }
        const { error } = await supabaseClient
          .from("users")
          .select("id")
          .limit(1);
        
        if (error) {
          // Se o erro for de tabela não existe, a conexão está ok mas o schema não foi criado
          if (error.message.includes("relation") || error.message.includes("does not exist") || error.code === "42P01") {
            setConnectionStatus("error");
            setConnectionMessage("Conectado ao Supabase ✓, mas as tabelas não foram criadas. Execute o script SQL no Supabase (SQL Editor).");
          } else if (error.code === "PGRST301" || error.message.includes("policy")) {
            setConnectionStatus("error");
            setConnectionMessage("Conectado ao Supabase ✓, mas as políticas RLS estão bloqueando. Execute o script SQL no Supabase (SQL Editor).");
          } else {
            setConnectionStatus("error");
            setConnectionMessage(`Erro: ${error.message}`);
          }
        } else {
          setConnectionStatus("ok");
          setConnectionMessage("Conectado ao Supabase ✓");
        }
      } catch (err: any) {
        setConnectionStatus("error");
        setConnectionMessage(`Erro de conexão: ${err.message || "Verifique sua internet e as credenciais do Supabase"}`);
      }
    };

    testConnection();

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
    const result = await auth.signIn(email, password);
    return { error: result.error };
  };

  const signOut = async () => {
    await auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        signIn,
        signOut,
        user: session?.user ?? null,
        connectionStatus,
        connectionMessage,
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
