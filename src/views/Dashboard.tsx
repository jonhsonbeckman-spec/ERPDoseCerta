import { useMemo, useState } from "react";
import type { ViewKey } from "../types";
import { useStore } from "../lib/store";
import { useUi } from "../components/modals";
import { Avatar, Badge, CountUp, EmptyState, Skeleton, useToast } from "../components/ui";
import { FlowChart, GaugeArc } from "../components/charts";
import { IcAlert, IcBox, IcCheck, IcShieldAlert, IcSyringe, IcTrendDown, IcTrendUp, IcWhats, IcX } from "../components/icons";
import {
  MEI_CAP, brl, diffDays, flowSeries, fmtShort, monthFull, monthKey, monthTotals, shiftMonth, todayISO, waLink, weekdayLong, yearRevenue,
} from "../lib/utils";
import { resumoEstoque } from "../lib/domain/analytics";

export function Dashboard({ go }: { go: (v: ViewKey) => void }) {
  const { state, hydrated, cancelarAlocacao } = useStore();
  const ui = useUi();
  const { push } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);

  const hoje = todayISO();
  const key = monthKey(hoje);
  const tot = monthTotals(state.transactions, key);
  const prev = monthTotals(state.transactions, shiftMonth(key, -1));
  const deltaPct = prev.rec > 0 ? ((tot.rec - prev.rec) / prev.rec) * 100 : null;

  const fila = useMemo(() => [...state.alocacoes].sort((a, b) => a.dataPrevista.localeCompare(b.dataPrevista)), [state.alocacoes]);
  const dosesPendentes = useMemo(
    () =>
      state.protocolos
        .filter((p) => p.ativo)
        .flatMap((p) => p.doses.filter((d) => d.status === "AGENDADA" && diffDays(hoje, d.data) <= 7).map((d) => ({ p, d })))
        .sort((a, b) => a.d.data.localeCompare(b.d.data)),
    [state.protocolos, hoje],
  );
  const dosesVencidas = dosesPendentes.filter((x) => diffDays(hoje, x.d.data) <= 0).length;
  const dueToday = fila.filter((a) => diffDays(hoje, a.dataPrevista) <= 0).length + dosesVencidas;
  const semAgendamento = state.clients.filter((c) => c.active && !state.alocacoes.some((a) => a.idCliente === c.id));
  const estoque = useMemo(() => resumoEstoque(state), [state]);
  const series = useMemo(() => flowSeries(state.transactions, 6), [state.transactions]);
  const pctMEI = Math.min(100, (yearRevenue(state.transactions, new Date().getFullYear()) / MEI_CAP) * 100);

  if (!hydrated) {
    return (
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[86px]" />)}</div>
        <Skeleton className="h-64" />
        <div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="anim-rise">
        <p className="eyebrow capitalize">{weekdayLong()}</p>
        <h1 className="mt-1 font-display text-[26px] font-bold leading-tight tracking-tight sm:text-3xl">
          {dueToday > 0 ? `${dueToday} aplicaç${dueToday > 1 ? "ões" : "ão"} na fila` : "Agenda em dia"}
        </h1>
      </header>

      {/* fila: doses de protocolo + alocações */}
      <section className="anim-rise space-y-3" style={{ animationDelay: "60ms" }}>
        {dosesPendentes.map(({ p, d }, i) => {
          const c = state.clients.find((x) => x.id === p.idCliente);
          const prod = state.produtos.find((x) => x.id === d.idProduto);
          const dd = diffDays(hoje, d.data);
          if (!c) return null;
          return (
            <div key={d.id} className={`anim-rise card card-hover p-4 ${dd < 0 ? "border-coral-100" : dd === 0 ? "border-leaf-200" : ""}`} style={{ animationDelay: `${80 + i * 50}ms` }}>
              <div className="flex items-center gap-2">
                {dd < 0 ? <Badge tone="coral">atrasada {-dd}d</Badge> : dd === 0 ? (
                  <Badge tone="leaf"><span className="dot-live inline-block h-1.5 w-1.5 rounded-full bg-leaf-600" /> hoje</Badge>
                ) : (
                  <Badge tone="neutral">em {dd}d · {fmtShort(d.data)}</Badge>
                )}
                <Badge tone="pine">protocolo</Badge>
                <span className="num ml-auto text-[11px] font-semibold text-ink-faint">dose {d.numero}/{p.doses.length}</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Avatar name={c.name} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-bold">{c.name}</p>
                  <p className="truncate text-[12.5px] text-ink-soft">{prod?.nome} · {p.nome}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => ui.openAplicarDose(p.id, d.id)} className="btn-big flex-1"><IcSyringe size={19} /> Aplicar agora</button>
                {c.phone && (
                  <a href={waLink(c.phone, `Olá, ${c.name.split(" ")[0]}! Lembrete da sua dose de hoje (${prod?.nome}). Posso confirmar?`)} target="_blank" rel="noreferrer"
                    className="btn-press grid w-12 place-items-center rounded-2xl border border-line text-ink-soft hover:border-leaf-200 hover:text-leaf-700">
                    <IcWhats size={17} />
                  </a>
                )}
              </div>
            </div>
          );
        })}

        {fila.map((a, i) => {
          const c = state.clients.find((x) => x.id === a.idCliente);
          const f = state.fichas.find((x) => x.id === a.idFicha);
          if (!c) return null;
          const dd = diffDays(hoje, a.dataPrevista);
          const notes = c.notes.split("\n").filter(Boolean);
          const open = expanded === a.id;
          return (
            <div key={a.id} className={`anim-rise card card-hover flex flex-col p-4 ${dd < 0 ? "border-coral-100" : dd === 0 ? "border-leaf-200" : ""}`} style={{ animationDelay: `${120 + i * 50}ms` }}>
              <div className="flex items-center gap-2">
                {dd < 0 ? <Badge tone="coral">atrasada {-dd}d</Badge> : dd === 0 ? (
                  <Badge tone="leaf"><span className="dot-live inline-block h-1.5 w-1.5 rounded-full bg-leaf-600" /> hoje</Badge>
                ) : (
                  <Badge tone="neutral">em {dd}d · {fmtShort(a.dataPrevista)}</Badge>
                )}
                <span className="num ml-auto text-[11px] font-semibold text-ink-faint">{f?.tipo}</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Avatar name={c.name} />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold">{c.name}</p>
                  <p className="truncate text-[12px] text-ink-soft">{f?.nome}</p>
                </div>
              </div>
              {notes.length > 0 && (
                <button onClick={() => setExpanded(open ? null : a.id)} className="mt-3 rounded-lg bg-mist/80 px-3 py-2 text-left transition-colors hover:bg-mist">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-faint">Orientações diárias</p>
                  <ul className="mt-1 space-y-0.5">
                    {(open ? notes : notes.slice(0, 2)).map((n, j) => (
                      <li key={j} className="flex items-start gap-1.5 text-[12px] leading-snug text-ink-soft">
                        <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-leaf-500" /> {n}
                      </li>
                    ))}
                  </ul>
                </button>
              )}
              <div className="mt-auto flex items-center gap-2 pt-3">
                <button onClick={() => ui.openApplication(c.id, a.id)} className="btn-big flex-1"><IcCheck size={17} /> Aplicar agora</button>
                {c.phone && (
                  <a href={waLink(c.phone, `Olá, ${c.name.split(" ")[0]}! Lembrete da sua aplicação. Posso confirmar?`)} target="_blank" rel="noreferrer"
                    className="btn-press grid w-11 place-items-center rounded-xl border border-line p-2 text-ink-soft hover:border-leaf-200 hover:text-leaf-700">
                    <IcWhats size={15} />
                  </a>
                )}
                <button
                  onClick={() => ui.confirm({
                    title: "Cancelar agendamento",
                    message: <>Remover a aplicação de <strong className="text-ink">{c.name}</strong> da fila? A alocação de estoque será liberada.</>,
                    confirmLabel: "Cancelar agendamento", danger: true,
                    action: () => { cancelarAlocacao(a.id); push("info", "Agendamento cancelado — estoque virtual liberado."); },
                  })}
                  className="btn-press grid w-11 place-items-center rounded-xl border border-line p-2 text-ink-soft hover:border-coral-100 hover:bg-coral-50 hover:text-coral-600">
                  <IcX size={15} />
                </button>
              </div>
            </div>
          );
        })}

        {fila.length === 0 && dosesPendentes.length === 0 && (
          <EmptyState
            icon={<IcSyringe size={20} />}
            title="Nenhuma aplicação agendada"
            hint="Agende pelos protocolos dos pacientes para montar a fila do dia e alocar estoque."
            action={semAgendamento[0] ? (
              <button onClick={() => ui.openAgendar(semAgendamento[0].id)} className="btn-press rounded-lg bg-pine-900 px-3.5 py-2 text-[13px] font-bold text-white hover:bg-pine-800">
                Agendar {semAgendamento[0].name.split(" ")[0]}
              </button>
            ) : undefined}
          />
        )}

        {semAgendamento.length > 0 && (
          <div className="anim-rise flex flex-wrap items-center gap-2" style={{ animationDelay: "200ms" }}>
            <span className="text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">Sem agendamento:</span>
            {semAgendamento.map((c) => (
              <button key={c.id} onClick={() => ui.openAgendar(c.id)} className="btn-press inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[12px] font-bold text-ink-soft hover:border-leaf-200 hover:text-leaf-700">
                <Avatar name={c.name} size="sm" /> {c.name.split(" ")[0]}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Aplicações na fila", node: <span className={`num font-display text-[22px] font-bold ${dueToday > 0 ? "text-ink" : "text-leaf-700"}`}>{fila.length + dosesPendentes.length}</span>, foot: `${dueToday} para hoje/atrasadas`, icon: null },
          { label: `Receita · ${monthFull(key)}`, node: <CountUp value={tot.rec} format={(n) => brl(n, 0)} className="num block font-display text-[22px] font-bold text-leaf-700" />, foot: deltaPct == null ? "sem base de comparação" : `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(0)}% vs mês anterior`, icon: deltaPct != null ? (deltaPct >= 0 ? <IcTrendUp size={11} className="text-leaf-600" /> : <IcTrendDown size={11} className="text-coral-600" />) : null },
          { label: "Resultado do mês", node: <CountUp value={tot.result} format={(n) => `${n < 0 ? "−" : "+"}${brl(Math.abs(n), 0)}`} className={`num block font-display text-[22px] font-bold ${tot.result >= 0 ? "text-ink" : "text-coral-600"}`} />, foot: `despesas ${brl(tot.des, 0)}`, icon: null },
          { label: "Pacientes ativos", node: <span className="num font-display text-[22px] font-bold">{state.clients.filter((c) => c.active).length}</span>, foot: `${state.protocolos.filter((p) => p.ativo).length} protocolos em curso`, icon: null },
        ].map((k, i) => (
          <div key={k.label} className="anim-rise card card-hover px-4 py-3.5" style={{ animationDelay: `${240 + i * 60}ms` }}>
            <p className="eyebrow">{k.label}</p>
            <div className="mt-1.5">{k.node}</div>
            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-ink-faint">{k.icon}{k.foot}</p>
          </div>
        ))}
      </section>

      {/* MEI + fluxo + estoque */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="anim-rise card p-5 lg:col-span-4" style={{ animationDelay: "320ms" }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-[15px] font-bold tracking-tight">Teto anual do MEI</h3>
              <p className="text-[11.5px] text-ink-faint">limite {brl(MEI_CAP, 0)}</p>
            </div>
            <Badge tone={pctMEI >= 85 ? "coral" : pctMEI >= 60 ? "amber" : "leaf"}>{pctMEI >= 85 ? "atenção" : pctMEI >= 60 ? "monitorar" : "saudável"}</Badge>
          </div>
          <div className="mt-2"><GaugeArc pct={pctMEI} /></div>
        </div>

        <div className="anim-rise card p-5 lg:col-span-5" style={{ animationDelay: "380ms" }}>
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[15px] font-bold tracking-tight">Fluxo de caixa · 6 meses</h3>
            <button onClick={() => go("finance")} className="btn-press text-[12px] font-bold text-leaf-700 hover:text-leaf-600">Dinheiro →</button>
          </div>
          <div className="mt-4"><FlowChart data={series} /></div>
          <div className="mt-3 flex gap-4 text-[11px] font-semibold text-ink-faint">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-leaf-500" /> receitas</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-coral-600/85" /> despesas</span>
          </div>
        </div>

        <div className="anim-rise card flex flex-col p-5 lg:col-span-3" style={{ animationDelay: "440ms" }}>
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[15px] font-bold tracking-tight">Estoque</h3>
            <button onClick={() => go("estoque")} className="btn-press text-[12px] font-bold text-leaf-700 hover:text-leaf-600">Abrir →</button>
          </div>
          <p className="num mt-2 font-display text-[20px] font-bold">{brl(estoque.valorTotal, 0)}</p>
          <p className="text-[11px] text-ink-faint">valor total pelo custo médio (PMP)</p>
          <ul className="mt-3 space-y-2">
            {estoque.alertas.slice(0, 4).map((a) => (
              <li key={a.lote.id + a.tipo} className="flex items-center gap-2 rounded-lg bg-mist/70 px-2.5 py-2 text-[11.5px] font-semibold">
                <span className={a.tipo === "quarentena" ? "text-amber-700" : "text-coral-600"}>
                  {a.tipo === "quarentena" ? <IcShieldAlert size={13} /> : <IcAlert size={13} />}
                </span>
                <span className="min-w-0 flex-1 truncate">{a.produto.nome} · {a.lote.numeroLote}</span>
                <span className="num text-ink-faint">{a.tipo === "vencido" ? `${-a.dias}d` : a.tipo === "vence30" ? `${a.dias}d` : "bloq."}</span>
              </li>
            ))}
            {estoque.alertas.length === 0 && <li className="rounded-lg bg-leaf-50 px-2.5 py-2 text-[11.5px] font-semibold text-leaf-700">Nenhum alerta de lote</li>}
            {estoque.abaixoPP > 0 && (
              <li className="flex items-center gap-2 rounded-lg bg-mist/70 px-2.5 py-2 text-[11.5px] font-semibold">
                <IcBox size={13} className="text-amber-700" />
                <span className="flex-1">{estoque.abaixoPP} item(ns) abaixo do ponto de pedido</span>
              </li>
            )}
          </ul>
          <button onClick={() => go("compras")} className="btn-press mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12.5px] font-bold text-ink-soft hover:border-leaf-200 hover:text-leaf-700">
            Ver Compras &amp; Lotes
          </button>
        </div>
      </section>
    </div>
  );
}
