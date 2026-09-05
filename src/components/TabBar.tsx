import { useMemo, useState } from "react";
import type { ViewKey } from "../types";
import { useStore } from "../lib/store";
import { Modal } from "./ui";
import { alertasLotes } from "../lib/domain/analytics";
import { diffDays, todayISO } from "../lib/utils";
import {
  IcBox, IcCoins, IcFileText, IcGrid, IcIdCard, IcSyringe, IcTruck, IcUsers, IcWallet, IcX,
} from "./icons";

const PRIMARY: { key: ViewKey; label: string; icon: typeof IcGrid }[] = [
  { key: "dashboard", label: "Hoje", icon: IcSyringe },
  { key: "clients", label: "Pacientes", icon: IcUsers },
  { key: "estoque", label: "Estoque", icon: IcBox },
  { key: "finance", label: "Dinheiro", icon: IcWallet },
];

const EXTRA: { key: ViewKey; label: string; desc: string; icon: typeof IcGrid }[] = [
  { key: "compras", label: "Compras & Lotes", desc: "Receber nota, lote e validade", icon: IcTruck },
  { key: "relatorios", label: "Relatórios", desc: "Kardex, CMV e curva ABC", icon: IcCoins },
  { key: "orcamentos", label: "Orçamentos", desc: "Precificar e fechar serviço", icon: IcFileText },
  { key: "rh", label: "RH & Custos", desc: "Custo de equipe MOD × MOI", icon: IcIdCard },
];

export function TabBar({ view, go }: { view: ViewKey; go: (v: ViewKey) => void }) {
  const { state } = useStore();
  const [mais, setMais] = useState(false);

  const hoje = todayISO();
  const dueCount = state.alocacoes.filter((a) => diffDays(hoje, a.dataPrevista) <= 0).length;
  const alertCount = useMemo(() => alertasLotes(state).length, [state]);

  const activeKey: ViewKey | "mais" = EXTRA.some((e) => e.key === view) ? "mais" : view;

  const goAndClose = (k: ViewKey) => {
    setMais(false);
    go(k);
  };

  return (
    <>
      <nav className="tabbar lg:hidden" aria-label="Navegação principal">
        <div className="safe-bottom mx-auto flex max-w-md items-stretch justify-between px-2 pt-1.5">
          {PRIMARY.map((t) => {
            const Icon = t.icon;
            const active = activeKey === t.key;
            const badge = t.key === "dashboard" ? dueCount : t.key === "estoque" ? alertCount : 0;
            return (
              <button key={t.key} onClick={() => go(t.key)}
                className={`btn-press relative flex min-w-[64px] flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 ${active ? "text-leaf-700" : "text-ink-faint"}`}>
                <span className={`relative grid h-8 w-12 place-items-center rounded-full transition-colors ${active ? "bg-leaf-100" : ""}`}>
                  <Icon size={20} />
                  {badge > 0 && (
                    <span className="num absolute -right-1 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral-600 px-1 text-[9px] font-bold text-white">{badge}</span>
                  )}
                </span>
                <span className="text-[10px] font-bold">{t.label}</span>
              </button>
            );
          })}
          <button onClick={() => setMais(true)}
            className={`btn-press flex min-w-[64px] flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 ${activeKey === "mais" ? "text-leaf-700" : "text-ink-faint"}`}>
            <span className={`grid h-8 w-12 place-items-center rounded-full ${activeKey === "mais" ? "bg-leaf-100" : ""}`}>
              <IcGrid size={20} />
            </span>
            <span className="text-[10px] font-bold">Mais</span>
          </button>
        </div>
      </nav>

      <Modal open={mais} onClose={() => setMais(false)} title="Mais módulos" subtitle="Gestão avançada do negócio">
        <div className="grid grid-cols-1 gap-2">
          {EXTRA.map((t) => {
            const Icon = t.icon;
            const active = view === t.key;
            return (
              <button key={t.key} onClick={() => goAndClose(t.key)}
                className={`btn-press flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  active ? "border-leaf-200 bg-leaf-50" : "border-line bg-paper hover:border-leaf-200 hover:bg-leaf-50/60"
                }`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${active ? "bg-pine-900 text-lime-400" : "bg-mist text-ink-soft"}`}>
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold">{t.label}</span>
                  <span className="block text-[11.5px] text-ink-faint">{t.desc}</span>
                </span>
                {active && <IcX size={14} className="text-leaf-700" />}
              </button>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
