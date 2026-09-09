import { IcClipboard } from "../../components/icons";

export function AuditLogs() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <IcClipboard size={48} className="mx-auto mb-4 text-ink-faint" />
        <h2 className="text-xl font-bold text-ink">Auditoria</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Esta funcionalidade está disponível apenas quando a autenticação está habilitada.
        </p>
        <div className="mt-6 rounded-xl border border-line bg-mist/50 p-4 text-left">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Para habilitar:</p>
          <p className="mt-1 text-xs text-ink-soft">
            Configure o Supabase e restaure o sistema de autenticação no código.
          </p>
        </div>
      </div>
    </div>
  );
}
