import { useEffect, useMemo, useState } from "react";
import type { Client } from "../types";
import { useStore } from "../lib/store";
import { useUi } from "../components/modals";
import { Avatar, Badge, EmptyState, Segmented, StatusBadge, useToast } from "../components/ui";
import { IcCalendar, IcChevronL, IcClipboard, IcPencil, IcPlus, IcSearch, IcSyringe, IcTrash, IcUsers, IcWhats } from "../components/icons";
import { brl, dueStatus, fmtCPF, fmtMed, fmtShort, nextDate, productName, waLink } from "../lib/utils";
import { Protocolos } from "./clients/Protocolos";

type Filter = "todos" | "hoje" | "atrasados" | "emdia" | "inativos";
type Aba = "pacientes" | "protocolos";

export function Clients() {
  const { state, saveClient, deleteClient } = useStore();
  const ui = useUi();
  const { push } = useToast();

  const [aba, setAba] = useState<Aba>("pacientes");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const withStatus = useMemo(() => state.clients.map((c) => ({ c, d: dueStatus(c) })), [state.clients]);

  const counts = useMemo(
    () => ({
      todos: withStatus.filter((x) => x.c.active).length,
      hoje: withStatus.filter((x) => x.c.active && x.d.status === "hoje").length,
      atrasados: withStatus.filter((x) => x.c.active && x.d.status === "atrasado").length,
      emdia: withStatus.filter((x) => x.c.active && (x.d.status === "proximo" || x.d.status === "agendado")).length,
      inativos: withStatus.filter((x) => !x.c.active).length,
    }),
    [withStatus],
  );

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return withStatus
      .filter(({ c, d }) => {
        if (filter === "inativos") return !c.active;
        if (!c.active) return false;
        if (filter === "hoje") return d.status === "hoje";
        if (filter === "atrasados") return d.status === "atrasado";
        if (filter === "emdia") return d.status === "proximo" || d.status === "agendado";
        return true;
      })
      .filter(({ c }) => !term || c.name.toLowerCase().includes(term))
      .sort((a, b) => a.d.days - b.d.days);
  }, [withStatus, filter, q]);

  useEffect(() => {
    if (list.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !list.some((x) => x.c.id === selectedId)) setSelectedId(list[0].c.id);
  }, [list, selectedId]);

  const selected = state.clients.find((c) => c.id === selectedId) ?? null;
  const selectedStatus = selected ? dueStatus(selected) : null;
  const selectedFicha = selected?.fichaTecnicaId ? state.fichas.find((f) => f.id === selected.fichaTecnicaId) : undefined;
  const temAgendamento = selected ? state.alocacoes.some((a) => a.idCliente === selected.id) : false;
  const protocolosDoCliente = selected ? state.protocolos.filter((p) => p.idCliente === selected.id) : [];

  const history = useMemo(
    () => (selected ? state.transactions.filter((t) => t.clientId === selected.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6) : []),
    [state.transactions, selected],
  );

  const askDelete = (c: Client) =>
    ui.confirm({
      title: "Excluir paciente",
      message: <>Remover <strong className="text-ink">{c.name}</strong> da carteira? Protocolos e alocações pendentes também serão removidos; o histórico financeiro permanece.</>,
      confirmLabel: "Excluir", danger: true,
      action: () => { deleteClient(c.id); setSelectedId(null); push("success", `${c.name} removido da carteira.`); },
    });

  return (
    <div className="space-y-5">
      <header className="anim-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Protocolos, rastreabilidade e orientações</p>
          <h1 className="mt-1 font-display text-[28px] font-bold tracking-tight sm:text-3xl">Pacientes</h1>
        </div>
        <button onClick={() => ui.openClientModal()} className="btn-press inline-flex items-center gap-2 rounded-lg bg-pine-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-pine-800">
          <IcPlus size={15} /> Novo paciente
        </button>
      </header>

      <div className="anim-rise" style={{ animationDelay: "40ms" }}>
        <Segmented<Aba>
          value={aba}
          onChange={setAba}
          options={[
            { value: "pacientes", label: "Pacientes", count: counts.todos },
            { value: "protocolos", label: "Protocolos", count: state.protocolos.filter((p) => p.ativo).length },
          ]}
        />
      </div>

      {aba === "protocolos" ? (
        <Protocolos />
      ) : (
        <>
          <div className="anim-rise card flex flex-wrap items-center gap-3 p-3.5" style={{ animationDelay: "60ms" }}>
            <div className="relative min-w-[160px] flex-1">
              <IcSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input className="field-input pl-9" placeholder="Buscar paciente…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: "todos", label: "Ativos", count: counts.todos },
                { value: "hoje", label: "Hoje", count: counts.hoje },
                { value: "atrasados", label: "Atrasados", count: counts.atrasados },
                { value: "emdia", label: "Em dia", count: counts.emdia },
                { value: "inativos", label: "Inativos", count: counts.inativos },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
            <section className={`anim-rise md:col-span-5 ${selected ? "hidden md:block" : ""}`} style={{ animationDelay: "120ms" }}>
              <div className="card overflow-hidden">
                {list.length === 0 ? (
                  <div className="p-4">
                    <EmptyState icon={<IcUsers size={19} />} title="Nenhum paciente aqui" hint={q ? "Nenhum nome corresponde à busca." : "Nenhum paciente nesse filtro."}
                      action={<button onClick={() => ui.openClientModal()} className="btn-press rounded-lg bg-pine-900 px-3.5 py-2 text-[13px] font-bold text-white hover:bg-pine-800">Cadastrar paciente</button>} />
                  </div>
                ) : (
                  <ul>
                    {list.map(({ c, d }) => (
                      <li key={c.id} className="border-b border-line-soft last:border-0">
                        <button onClick={() => setSelectedId(c.id)}
                          className={`btn-press flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${selectedId === c.id ? "bg-leaf-50 shadow-[inset_3px_0_0_#1d9e71]" : "hover:bg-mist/70"}`}>
                          <Avatar name={c.name} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-bold">{c.name}</span>
                            <span className="block truncate text-[11.5px] text-ink-faint">
                              {state.fichas.find((f) => f.id === c.fichaTecnicaId)?.nome ?? productName(state.produtos, c.productId)} · {c.frequencyDays} em {c.frequencyDays} dias
                            </span>
                          </span>
                          {!c.active ? <Badge tone="neutral">inativo</Badge> : <StatusBadge status={d.status} days={d.days} />}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className={`anim-rise md:col-span-7 ${selected ? "" : "hidden md:block"}`} style={{ animationDelay: "180ms" }}>
              {!selected || !selectedStatus ? (
                <div className="card grid h-full min-h-[320px] place-items-center p-6">
                  <EmptyState icon={<IcUsers size={20} />} title="Selecione um paciente" hint="Protocolo, orientações diárias e histórico aparecem aqui." />
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="card p-5">
                    <button onClick={() => setSelectedId(null)} className="btn-press mb-3 inline-flex items-center gap-1 text-[12px] font-bold text-ink-faint hover:text-ink md:hidden">
                      <IcChevronL size={14} /> Voltar para a lista
                    </button>
                    <div className="flex flex-wrap items-start gap-4">
                      <Avatar name={selected.name} size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-display text-xl font-bold tracking-tight">{selected.name}</h2>
                          {selected.active ? <StatusBadge status={selectedStatus.status} days={selectedStatus.days} /> : <Badge tone="neutral">inativo</Badge>}
                          {temAgendamento && <Badge tone="leaf">agendado</Badge>}
                        </div>
                        <p className="mt-0.5 text-[12.5px] text-ink-soft">
                          <span className="num">{selected.phone || "sem telefone"}</span>
                          {selected.cpf ? <> · CPF <span className="num">{fmtCPF(selected.cpf)}</span></> : <span className="text-amber-700"> · CPF não informado</span>}
                          {" "}· desde {fmtMed(selected.since)}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {selected.active && (
                            <button onClick={() => ui.openApplication(selected.id)} className="btn-press inline-flex items-center gap-1.5 rounded-lg bg-leaf-600 px-3.5 py-2 text-[13px] font-bold text-white hover:bg-leaf-700">
                              <IcSyringe size={14} /> Registrar aplicação
                            </button>
                          )}
                          {selected.active && !temAgendamento && (
                            <button onClick={() => ui.openAgendar(selected.id)} className="btn-press inline-flex items-center gap-1.5 rounded-lg bg-pine-900 px-3.5 py-2 text-[13px] font-bold text-white hover:bg-pine-800">
                              <IcCalendar size={14} /> Agendar
                            </button>
                          )}
                          {selected.phone && (
                            <a href={waLink(selected.phone, `Olá, ${selected.name.split(" ")[0]}! Como você está? Qualquer dúvida sobre o protocolo, estou por aqui.`)} target="_blank" rel="noreferrer"
                              className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-[13px] font-bold text-ink-soft hover:border-leaf-200 hover:text-leaf-700">
                              <IcWhats size={14} /> WhatsApp
                            </a>
                          )}
                          <button onClick={() => ui.openClientModal(selected)} className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-[13px] font-bold text-ink-soft hover:border-leaf-200 hover:text-ink">
                            <IcPencil size={14} /> Editar
                          </button>
                          <button onClick={() => { saveClient({ ...selected, active: !selected.active }); push("info", selected.active ? `${selected.name} marcado como inativo.` : `${selected.name} voltou para a agenda.`); }}
                            className="btn-press rounded-lg border border-line px-3.5 py-2 text-[13px] font-bold text-ink-soft hover:border-amber-300 hover:text-amber-700">
                            {selected.active ? "Pausar" : "Reativar"}
                          </button>
                          <button onClick={() => askDelete(selected)} title="Excluir paciente" className="btn-press ml-auto rounded-lg p-2 text-ink-faint hover:bg-coral-50 hover:text-coral-600">
                            <IcTrash size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="card p-5">
                      <h3 className="eyebrow">Protocolo</h3>
                      <dl className="mt-3 space-y-2.5 text-[13px]">
                        <div className="flex justify-between gap-3"><dt className="text-ink-faint">Protocolo da ficha</dt><dd className="text-right font-bold">{selectedFicha?.nome ?? "—"}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-ink-faint">Fármaco principal</dt><dd className="text-right font-bold">{productName(state.produtos, selected.productId)}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-ink-faint">Valor por aplicação</dt><dd className="num text-right font-bold text-leaf-700">{brl(selectedFicha?.precoVenda ?? 0, 0)}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-ink-faint">Intervalo</dt><dd className="text-right font-bold">a cada {selected.frequencyDays} dias</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-ink-faint">Última aplicação</dt><dd className="num text-right font-bold">{fmtShort(selected.lastApplication)}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-ink-faint">Próxima pelo intervalo</dt><dd className="num text-right font-bold">{fmtShort(nextDate(selected))}</dd></div>
                      </dl>
                      {protocolosDoCliente.length > 0 && (
                        <div className="mt-3 border-t border-line-soft pt-3">
                          <p className="eyebrow">Protocolos comprados</p>
                          <ul className="mt-2 space-y-1">
                            {protocolosDoCliente.map((p) => (
                              <li key={p.id} className="flex items-center justify-between text-[12.5px] font-semibold">
                                <span className="truncate">{p.nome}</span>
                                <span className="num text-ink-faint">{p.doses.filter((d) => d.status === "APLICADA").length}/{p.doses.length} doses</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="card p-5">
                      <h3 className="eyebrow flex items-center gap-1.5"><IcClipboard size={13} /> Orientações diárias</h3>
                      {selected.notes ? (
                        <ul className="mt-3 space-y-2">
                          {selected.notes.split("\n").filter(Boolean).map((n, i) => (
                            <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-ink-soft">
                              <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-lime-400 ring-2 ring-lime-400/25" />
                              {n}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-[13px] text-ink-faint">Sem orientações registradas. Edite o paciente para adicionar.</p>
                      )}
                    </div>
                  </div>

                  <div className="card overflow-hidden">
                    <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
                      <h3 className="font-display text-[15px] font-bold tracking-tight">Histórico</h3>
                      <Badge tone="neutral">{history.length}</Badge>
                    </div>
                    {history.length === 0 ? (
                      <p className="px-5 py-6 text-center text-[13px] text-ink-faint">Nenhuma aplicação registrada para este paciente ainda.</p>
                    ) : (
                      <ul>
                        {history.map((t) => (
                          <li key={t.id} className="flex items-center gap-3 border-b border-line-soft px-5 py-2.5 transition-colors last:border-0 hover:bg-leaf-50/60">
                            <span className="num w-11 shrink-0 rounded-md bg-mist px-1.5 py-1 text-center text-[11px] font-bold text-ink-soft">{fmtShort(t.date)}</span>
                            <span className="flex-1 truncate text-[13px] font-semibold">{t.description}</span>
                            <span className={`num text-[13px] font-bold ${t.type === "receita" ? "text-leaf-700" : "text-coral-600"}`}>{t.type === "receita" ? "+" : "−"}{brl(t.amount, 0)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
