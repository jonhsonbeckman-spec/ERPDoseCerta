import { Component, useState, useMemo, type ErrorInfo, type ReactNode } from "react";
import type { ViewKey } from "./types";
import { StoreProvider, useStore } from "./lib/store-cloud";
import { ToastProvider } from "./components/ui";
import { UiProvider, useUi } from "./components/modals";
import { Sidebar } from "./components/Sidebar";
import { TabBar } from "./components/TabBar";
import { Dashboard } from "./views/Dashboard";
import { Finance } from "./views/Finance";
import { Estoque } from "./views/stock/Estoque";
import { ComprasLotes } from "./views/stock/ComprasLotes";
import { Relatorios } from "./views/stock/Relatorios";
import { RH } from "./views/rh/RH";
import { Orcamentos } from "./views/orcamentos/Orcamentos";
import { Clients } from "./views/Clients";
import { UserManagement } from "./views/admin/UserManagement";
import { AuditLogs } from "./views/admin/AuditLogs";
import { IcAlert, IcCalendar, IcSyringe } from "./components/icons";
import { alertasLotes } from "./lib/domain/analytics";
import { diffDays, fmtLong, todayISO } from "./lib/utils";

const META: Record<ViewKey, { title: string; sub: string }> = {
  dashboard: { title: "Hoje", sub: "Suas doses do dia" },
  finance: { title: "Dinheiro", sub: "Entradas, saídas e resultado" },
  estoque: { title: "Estoque", sub: "O que você tem na geladeira" },
  compras: { title: "Compras & Lotes", sub: "Aquisições, lote, validade e custo médio" },
  relatorios: { title: "Relatórios", sub: "Kardex, valoração, ABC e alertas" },
  rh: { title: "RH & Custos", sub: "Custo real por pessoa · MOD × MOI" },
  orcamentos: { title: "Orçamentos", sub: "Precificação e aprovação que cria o paciente" },
  clients: { title: "Pacientes", sub: "Protocolos e orientações" },
  "admin-users": { title: "Gestão de Usuários", sub: "Cadastro e permissões (Admin)" },
  "audit-logs": { title: "Auditoria", sub: "Log de ações críticas (Admin)" },
};

function Topbar({ view, go }: { view: ViewKey; go: (v: ViewKey) => void }) {
  const { state } = useStore();
  const ui = useUi();
  const hoje = todayISO();

  const dueCount = state.alocacoes.filter((a) => diffDays(hoje, a.dataPrevista) <= 0).length;
  const alertCount = useMemo(() => alertasLotes(state).length, [state]);

  return (
    <div className="sticky top-0 z-30 border-b border-line bg-mist/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-3 sm:px-6">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pine-900 text-lime-400 lg:hidden">
          <IcSyringe size={18} />
        </span>
        <div className="min-w-0">
          <p className="eyebrow hidden sm:block">{META[view].sub}</p>
          <h2 className="truncate font-display text-[20px] font-bold leading-tight tracking-tight lg:text-[19px]">
            {META[view].title}
          </h2>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="num hidden items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[12px] font-semibold capitalize text-ink-soft md:inline-flex">
            <IcCalendar size={13} /> {fmtLong(hoje)}
          </span>
          {(view === "estoque" || view === "compras") && alertCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-coral-100 bg-coral-50 px-3 py-1.5 text-[12px] font-bold text-coral-700">
              <span className="num">{alertCount}</span>
              <span className="hidden sm:inline">alertas</span>
            </span>
          )}
          <button onClick={() => go("dashboard")} title="Doses para hoje ou atrasadas"
            className={`btn-press inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-colors ${
              dueCount > 0 ? "border-leaf-200 bg-leaf-100 text-leaf-700 hover:bg-leaf-200" : "border-line bg-paper text-ink-soft"
            }`}>
            <IcSyringe size={13} />
            <span className="num">{dueCount}</span>
            <span className="hidden sm:inline">hoje</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const [view, setView] = useState<ViewKey>("dashboard");

  return (
    <div className="app-bg min-h-screen">
      <Sidebar view={view} go={setView} />
      <div className="lg:pl-[248px]">
        <Topbar view={view} go={setView} />
        <main className="mx-auto max-w-[1240px] px-4 pb-32 pt-4 sm:px-6 sm:pt-6 lg:pb-16">
          {view === "dashboard" && <Dashboard go={setView} />}
          {view === "finance" && <Finance />}
          {view === "estoque" && <Estoque />}
          {view === "compras" && <ComprasLotes />}
          {view === "relatorios" && <Relatorios />}
          {view === "rh" && <RH />}
          {view === "orcamentos" && <Orcamentos />}
          {view === "clients" && <Clients />}
          {view === "admin-users" && <UserManagement />}
          {view === "audit-logs" && <AuditLogs />}
        </main>
        <footer className="hidden border-t border-line py-5 text-center text-[11px] text-ink-faint lg:block">
          DoseCerta · estoque com rastreabilidade Lote + Validade + CPF · dados salvos neste navegador
        </footer>
      </div>
      <TabBar view={view} go={setView} />
    </div>
  );
}

/* ---------- proteção contra tela branca ---------- */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("DoseCerta — erro de renderização:", error, info.componentStack);
  }

  private recarregar = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    }
    window.location.reload();
  };

  private resetar = () => {
    try {
      localStorage.removeItem("dosecerta:v2");
      localStorage.removeItem("dosecerta:v1");
    } catch {
      /* sem acesso */
    }
    this.recarregar();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app-bg flex min-h-screen items-center justify-center px-4">
        <div className="anim-pop card w-full max-w-md p-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-coral-50 text-coral-600">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3.5 2.5 20h19L12 3.5Z" />
              <path d="M12 9.5v5" />
              <path d="M12 17.4h.01" strokeWidth="2.6" />
            </svg>
          </span>
          <h1 className="mt-4 font-display text-xl font-bold tracking-tight">Algo deu errado</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            O app encontrou um erro ao carregar. Tente recarregar — seus dados continuam salvos.
          </p>
          <p className="num mx-auto mt-3 max-h-24 overflow-auto rounded-lg bg-mist px-3 py-2 text-left text-[11px] text-coral-700">
            {this.state.error.message}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button onClick={this.recarregar} className="btn-big">Recarregar o app</button>
            <button onClick={this.resetar} className="btn-press rounded-2xl border border-coral-100 bg-coral-50 px-5 py-3 text-[13px] font-bold text-coral-600 hover:bg-coral-100">
              Limpar dados locais e recarregar
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <ToastProvider>
          <UiProvider>
            <Shell />
          </UiProvider>
        </ToastProvider>
      </StoreProvider>
    </ErrorBoundary>
  );
}
