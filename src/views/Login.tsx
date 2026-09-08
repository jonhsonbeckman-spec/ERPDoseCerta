import { useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { IcSyringe, IcCheck, IcAlert } from "../components/icons";

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } catch (err) {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
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
          <p className="mt-1 text-sm text-ink-soft">Sistema Corporativo de Controle Financeiro</p>
        </div>

        {/* Card de login */}
        <div className="card p-6">
          <div className="mb-5">
            <h2 className="text-center text-lg font-bold text-ink">Acesso Restrito</h2>
            <p className="mt-1 text-center text-[12px] text-ink-faint">
              Entre com suas credenciais corporativas
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="eyebrow mb-1.5 block">E-mail Corporativo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input"
                placeholder="seu.email@empresa.com"
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
                autoComplete="current-password"
                required
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
                  Entrando...
                </span>
              ) : (
                <>
                  <IcCheck size={18} />
                  Entrar
                </>
              )}
            </button>
          </form>

          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-2 text-[12px] font-bold text-amber-700">Acesso Corporativo</p>
            <p className="text-[11.5px] leading-snug text-ink-soft">
              Este sistema é restrito a usuários autorizados. Caso não tenha acesso, 
              entre em contato com o administrador do sistema.
            </p>
          </div>
        </div>

        {/* Rodapé */}
        <p className="mt-6 text-center text-[11px] text-ink-faint">
          Sistema protegido por autenticação segura · Dados criptografados
        </p>
      </div>
    </div>
  );
}
