import { useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { IcSyringe, IcCheck, IcAlert } from "../components/icons";

export function Login() {
  const { signIn, signUp, isDemo } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) setError(error);
      } else {
        if (!name.trim()) {
          setError("Informe seu nome.");
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password, name);
        if (error) setError(error);
      }
    } catch (err) {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail("demo@dosecerta.com");
    setPassword("demo1234");
  };

  return (
    <div className="app-bg flex min-h-screen items-center justify-center px-4 py-8">
      <div className="anim-pop w-full max-w-md">
        {/* Cabeçalho */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-pine-900 text-lime-400 shadow-[var(--shadow-pop)]">
            <IcSyringe size={32} />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">DoseCerta</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {isDemo ? "Modo demonstração · dados locais" : "Controle financeiro do MEI"}
          </p>
        </div>

        {/* Card de login */}
        <div className="card p-6">
          <div className="mb-5 flex gap-1 rounded-xl bg-mist p-1">
            <button
              onClick={() => setMode("login")}
              className={`btn-press flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${
                mode === "login" ? "bg-paper text-ink shadow-sm" : "text-ink-soft hover:text-ink"
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`btn-press flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${
                mode === "signup" ? "bg-paper text-ink shadow-sm" : "text-ink-soft hover:text-ink"
              }`}
            >
              Cadastrar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="eyebrow mb-1.5 block">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field-input"
                  placeholder="Seu nome completo"
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div>
              <label className="eyebrow mb-1.5 block">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input"
                placeholder="seu@email.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="eyebrow mb-1.5 block">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input"
                placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-coral-100 bg-coral-50 px-3 py-2.5">
                <IcAlert size={16} className="mt-0.5 shrink-0 text-coral-600" />
                <p className="text-[12.5px] font-semibold text-coral-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-big disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" fill="currentColor" className="opacity-90" />
                  </svg>
                  {mode === "login" ? "Entrando..." : "Cadastrando..."}
                </span>
              ) : (
                <>
                  <IcCheck size={18} />
                  {mode === "login" ? "Entrar" : "Criar conta"}
                </>
              )}
            </button>
          </form>

          {isDemo && mode === "login" && (
            <div className="mt-5 rounded-xl border border-leaf-200 bg-leaf-50 p-4">
              <p className="mb-2 text-[12px] font-bold text-leaf-700">Modo demonstração</p>
              <p className="mb-3 text-[11.5px] leading-snug text-ink-soft">
                Use as credenciais abaixo para explorar o app sem configurar Supabase:
              </p>
              <button
                onClick={fillDemo}
                className="btn-press w-full rounded-lg border border-leaf-200 bg-paper px-3 py-2 text-[12px] font-bold text-leaf-700 hover:bg-leaf-100"
              >
                Preencher credenciais demo
              </button>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <p className="mt-6 text-center text-[11px] text-ink-faint">
          {isDemo
            ? "Dados salvos localmente no navegador. Configure Supabase para sincronização em nuvem."
            : "Autenticação segura via Supabase Auth"}
        </p>
      </div>
    </div>
  );
}
