import { useEffect, useState } from "react";
import { auth, type AuditLog } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";
import { Badge } from "../../components/ui";
import { IcAlert, IcClipboard } from "../../components/icons";
import { fmtMed } from "../../lib/utils";

export function AuditLogs() {
  const { user: currentUser } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Verifica se é admin
  if (currentUser?.role !== "admin") {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <IcAlert size={48} className="mx-auto mb-4 text-coral-600" />
          <h2 className="text-xl font-bold text-ink">Acesso Negado</h2>
          <p className="mt-2 text-sm text-ink-soft">Apenas administradores podem acessar esta página.</p>
        </div>
      </div>
    );
  }

  const loadLogs = async () => {
    setLoading(true);
    const { logs, error } = await auth.listAuditLogs(200);
    if (error) {
      console.error("Erro ao carregar logs:", error);
    } else {
      setLogs(logs);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const getActionBadge = (action: string) => {
    switch (action) {
      case "CREATE":
        return <Badge tone="leaf">Criou</Badge>;
      case "UPDATE":
        return <Badge tone="amber">Atualizou</Badge>;
      case "DELETE":
        return <Badge tone="coral">Excluiu</Badge>;
      case "LOGIN":
        return <Badge tone="pine">Login</Badge>;
      case "LOGOUT":
        return <Badge tone="neutral">Logout</Badge>;
      default:
        return <Badge tone="neutral">{action}</Badge>;
    }
  };

  const getEntityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      users: "Usuário",
      clients: "Paciente",
      products: "Produto",
      transactions: "Transação",
      stock_batches: "Lote",
      stock_movements: "Movimentação",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-5">
      <header className="anim-rise">
        <p className="eyebrow">Exclusivo para Administradores</p>
        <h1 className="mt-1 font-display text-[28px] font-bold tracking-tight sm:text-3xl">Auditoria do Sistema</h1>
        <p className="mt-1 text-sm text-ink-soft">Registro de todas as ações críticas realizadas no sistema</p>
      </header>

      <div className="anim-rise card overflow-hidden" style={{ animationDelay: "60ms" }}>
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
          <div className="flex items-center gap-2">
            <IcClipboard size={18} className="text-leaf-700" />
            <h3 className="font-display text-[15px] font-bold tracking-tight">Logs de Auditoria</h3>
          </div>
          <Badge tone="neutral">{logs.length} registros</Badge>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-ink-faint">Carregando logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-ink-faint">Nenhum log de auditoria encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead>
                <tr className="border-b border-line-soft bg-mist/50">
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint">Data/Hora</th>
                  <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint">Usuário</th>
                  <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint">Ação</th>
                  <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint">Entidade</th>
                  <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint">ID</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-line-soft transition-colors last:border-0 hover:bg-leaf-50/40">
                    <td className="whitespace-nowrap px-5 py-3 text-[12px] text-ink-soft">
                      {new Date(log.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-3">
                      <div>
                        <p className="text-[12px] font-semibold">{log.userEmail}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3">{getActionBadge(log.action)}</td>
                    <td className="px-3 py-3 text-[12px] font-semibold">{getEntityTypeLabel(log.entityType)}</td>
                    <td className="px-3 py-3">
                      <span className="num text-[11px] text-ink-faint">{log.entityId?.slice(0, 8) || "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
