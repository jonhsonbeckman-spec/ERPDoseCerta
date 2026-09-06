import { useMemo } from "react";
import type { ViewKey } from "../types";
import { useStore } from "../lib/store";
import { MEI_CAP, brl, brlK, diffDays, todayISO, yearRevenue } from "../lib/utils";
import { alertasLotes } from "../lib/domain/analytics";
import { useUi } from "./modals";
import { useToast } from "./ui";
import {
  IcBox, IcCoins, IcFileText, IcGrid, IcIdCard, IcRefresh, IcSyringe, IcTruck, IcUsers, IcWallet,
} from "./icons";

const NAV: { key: ViewKey; label: string; icon: typeof IcGrid }[] = [
  { key: "dashboard", label: "Hoje", icon: IcGrid },
  { key: "finance", label: "Dinheiro", icon: IcWallet },
  { key: "estoque", label: "Estoque", icon: IcBox },
  { key: "compras", label: "Compras & Lotes", icon: IcTruck },
  { key: "relatorios", label: "Relatórios", icon: IcCoins },
  { key: "rh", label: "RH & Custos", icon: IcIdCard },
  { key: "orcamentos", label: "Orçamentos", icon: IcFileText },
  { key: "clients", label: "Pacientes", icon: IcUsers },
];

export function Sidebar({ view, go }: { view: ViewKey; go: (v: ViewKey) => void }) {
  const { state, resetData } = useStore();
  const ui = useUi();
  const { push } = useToast();

  const hoje = todayISO();
  const dueCount = state.alocacoes.filter((a) => diffDays(hoje, a.dataPrevista) <= 0).length;
  const alertCount = useMemo(() => alertasLotes(state).length, [state]);
  const pendingQuotes = state.quotes.filter((q) => q.status === "PENDING_APPROVAL").length;

  const year = new Date().getFullYear();
  const rev = yearRevenue(state.transactions, year);
  const pct = Math.min(100, (rev / MEI_CAP) * 100);

  const badges: Partial<Record<ViewKey, { n: number; tone: string }>> = {
    dashboard: dueCount > 0 ? { n: dueCount, tone: "bg-lime-400 text-pine-950" } : undefined,
    estoque: alertCount > 0 ? { n: alertCount, tone: "bg-coral-600 text-white" } : undefined,
    orcamentos: pendingQuotes > 0 ? { n: pendingQuotes, tone: "bg-lime-400 text-pine-950" } : undefined,
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-pine-800 bg-pine-900 lg:flex">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(420px_160px_at_30%_-20%,rgba(198,232,107,0.14),transparent_70%)]" />

      <div className="relative flex items-center gap-3 px-5 pb-6 pt-6">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-pine-800 text-lime-400 ring-1 ring-pine-700">
          <IcSyringe size={20} />
        </span>
        <div>
          <p className="font-display text-[19px] font-bold leading-none tracking-tight text-white">DoseCerta</p>
          <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-lime-400/70">controle do MEI</p>
        </div>
      </div>

      <nav className="relative flex-1 space-y-1 overflow-y-auto px-3">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Operação</p>
        {NAV.map((item) => {
          const active = view === item.key;
          const Icon = item.icon;
          const badge = badges[item.key];
          return (
            <button key={item.key} onClick={() => go(item.key)}
              className={`btn-press group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                active ? "bg-pine-800 text-white" : "text-white/55 hover:bg-pine-800/50 hover:text-white"
              }`}>
              {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-lime-400" />}
              <Icon size={17} className={active ? "text-lime-400" : ""} />
              {item.label}
              {badge && <span className={`num ml-auto rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${badge.tone}`}>{badge.n}</span>}
            </button>
          );
        })}
      </nav>

      <div className="relative space-y-3 px-4 pb-5">
        <div className="rounded-xl border border-pine-700 bg-pine-800/70 p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Teto MEI {year}</p>
            <p className="num text-[11px] font-semibold text-lime-400">{pct.toFixed(1)}%</p>
          </div>
          <p className="num mt-1.5 font-display text-lg font-bold leading-none text-white">{brlK(rev)}</p>
          <p className="mt-0.5 text-[11px] text-white/45">de {brl(MEI_CAP, 0)}</p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-pine-950">
            <div className="h-full rounded-full bg-lime-400 transition-[width] duration-1000 ease-out" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button
          onClick={() =>
            ui.confirm({
              title: "Restaurar dados de exemplo",
              message: "Todos os dados atuais serão substituídos pelos dados de demonstração.",
              confirmLabel: "Restaurar",
              action: () => { resetData(); push("info", "Dados de exemplo restaurados."); },
            })
          }
          className="btn-press flex w-full items-center justify-center gap-2 rounded-lg border border-pine-700 px-3 py-2 text-[12px] font-semibold text-white/45 transition-colors hover:border-pine-600 hover:text-white/80">
          <IcRefresh size={13} /> Restaurar exemplo
        </button>
      </div>
    </aside>
  );
}
