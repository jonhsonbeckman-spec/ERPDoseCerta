import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { useUi } from "../components/modals";
import { Badge, CountUp, EmptyState, Segmented, useToast } from "../components/ui";
import { ResumoMes } from "../components/ResumoMes";
import { BackupModal } from "../components/BackupModal";
import { IcChevronL, IcChevronR, IcPencil, IcPlus, IcRefresh, IcSearch, IcTrash, IcWallet } from "../components/icons";
import { METHOD_LABEL, brl, clientName, fmtMed, monthFull, monthKey, shiftMonth, todayISO } from "../lib/utils";

type Filter = "todos" | "receita" | "despesa";

export function Finance() {
  const { state, deleteTransaction } = useStore();
  const ui = useUi();
  const { push } = useToast();
  const [backup, setBackup] = useState(false);

  const [month, setMonth] = useState(monthKey(todayISO()));
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return state.transactions
      .filter((t) => monthKey(t.date) === month)
      .filter((t) => filter === "todos" || t.type === filter)
      .filter((t) => !term || t.description.toLowerCase().includes(term) || t.category.toLowerCase().includes(term) || clientName(state.clients, t.clientId).toLowerCase().includes(term))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [state.transactions, state.clients, month, filter, q]);

  const counts = useMemo(() => {
    const inMonth = state.transactions.filter((t) => monthKey(t.date) === month);
    return {
      todos: inMonth.length,
      receita: inMonth.filter((t) => t.type === "receita").length,
      despesa: inMonth.filter((t) => t.type === "despesa").length,
    };
  }, [state.transactions, month]);

  const askDelete = (id: string, desc: string) =>
    ui.confirm({
      title: "Excluir lançamento",
      message: <>Remover <strong className="text-ink">{desc}</strong>? Essa ação não pode ser desfeita.</>,
      confirmLabel: "Excluir", danger: true,
      action: () => { deleteTransaction(id); push("success", "Lançamento excluído."); },
    });

  return (
    <div className="space-y-5">
      <header className="anim-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Entradas, saídas e resultado do MEI</p>
          <h1 className="mt-1 font-display text-[28px] font-bold tracking-tight sm:text-3xl">Dinheiro</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setBackup(true)} className="btn-press inline-flex items-center gap-2 rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm font-bold text-ink-soft hover:border-leaf-200 hover:text-leaf-700">
            <IcRefresh size={15} /> Backup
          </button>
          <button onClick={() => ui.openTransaction()} className="btn-press inline-flex items-center gap-2 rounded-lg bg-pine-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-pine-800">
            <IcPlus size={15} /> Novo lançamento
          </button>
        </div>
      </header>

      <ResumoMes month={month} />
      <BackupModal open={backup} onClose={() => setBackup(false)} />

      <div className="anim-rise card flex flex-wrap items-center gap-3 p-3.5" style={{ animationDelay: "60ms" }}>
        <div className="flex items-center rounded-lg border border-line bg-paper">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="btn-press p-2 text-ink-soft hover:text-ink" aria-label="Mês anterior"><IcChevronL size={15} /></button>
          <span className="num min-w-[118px] px-1 text-center text-[13px] font-bold">{monthFull(month)}</span>
          <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= monthKey(todayISO())}
            className="btn-press p-2 text-ink-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-30" aria-label="Próximo mês"><IcChevronR size={15} /></button>
        </div>
        <div className="relative min-w-[160px] flex-1">
          <IcSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input className="field-input pl-9" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "todos", label: "Todos", count: counts.todos },
            { value: "receita", label: "Receitas", count: counts.receita },
            { value: "despesa", label: "Despesas", count: counts.despesa },
          ]}
        />
      </div>

      <div className="anim-rise card overflow-hidden" style={{ animationDelay: "120ms" }}>
        {filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<IcWallet size={19} />}
              title={q || filter !== "todos" ? "Nada encontrado" : "Mês sem lançamentos"}
              hint={q || filter !== "todos" ? "Ajuste a busca ou o filtro." : "Registre uma receita ou despesa para começar."}
              action={<button onClick={() => ui.openTransaction()} className="btn-press rounded-lg bg-pine-900 px-3.5 py-2 text-[13px] font-bold text-white hover:bg-pine-800">Novo lançamento</button>}
            />
          </div>
        ) : (
          <ul>
            {filtered.map((t) => (
              <li key={t.id} className="group flex items-center gap-3 border-b border-line-soft px-4 py-3 transition-colors last:border-0 hover:bg-leaf-50/60">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${t.type === "receita" ? "bg-leaf-100 text-leaf-700" : "bg-coral-50 text-coral-600"}`}>
                  <IcWallet size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold">{t.description}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="num text-[11px] font-semibold text-ink-faint">{fmtMed(t.date)}</span>
                    <Badge tone={t.type === "receita" ? "leaf" : "neutral"}>{t.category}</Badge>
                    <span className="text-[10.5px] text-ink-faint">{METHOD_LABEL[t.method]}</span>
                    {t.clientId && <span className="truncate text-[10.5px] text-ink-faint">· {clientName(state.clients, t.clientId)}</span>}
                  </div>
                </div>
                <span className={`num shrink-0 text-[14px] font-bold ${t.type === "receita" ? "text-leaf-700" : "text-coral-600"}`}>
                  {t.type === "receita" ? "+" : "−"}{brl(t.amount)}
                </span>
                <span className="flex shrink-0 gap-1">
                  <button onClick={() => ui.openTransaction(t)} className="btn-press rounded-md p-1.5 text-ink-faint hover:bg-mist hover:text-ink" aria-label="Editar"><IcPencil size={14} /></button>
                  <button onClick={() => askDelete(t.id, t.description)} className="btn-press rounded-md p-1.5 text-ink-faint hover:bg-coral-50 hover:text-coral-600" aria-label="Excluir"><IcTrash size={14} /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-line-soft bg-mist/60 px-4 py-2.5 text-[11.5px] font-medium text-ink-faint">
          {filtered.length} lançamento{filtered.length !== 1 ? "s" : ""} em {monthFull(month)}
        </div>
      </div>
    </div>
  );
}
