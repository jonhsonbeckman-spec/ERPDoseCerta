import { useMemo, useState } from "react";
import { useStore } from "../../lib/store";
import { Badge, CountUp, EmptyState, Segmented } from "../../components/ui";
import { IcCoins, IcShieldAlert } from "../../components/icons";
import { brl, clientName, fmtMed, fmtQtd, fmtShort } from "../../lib/utils";
import { curvaABC, disponibilidade, valoracao, alertasLotes, cmvMensal } from "../../lib/domain/analytics";
import { loteEfetiva } from "../../lib/domain/engine";
import { MOV_META, TIPO_LABEL, ColdTag } from "./shared";

type Sub = "cmv" | "kardex" | "valoracao" | "abc" | "alertas";

export function Relatorios() {
  const { state } = useStore();
  const [sub, setSub] = useState<Sub>("cmv");

  const produtosComMov = useMemo(
    () => state.produtos.filter((p) => state.movimentacoes.some((m) => m.idProduto === p.id)),
    [state.produtos, state.movimentacoes],
  );
  const [prodSel, setProdSel] = useState("");
  const prodId = prodSel || produtosComMov[0]?.id || "";

  const kardex = useMemo(
    () => state.movimentacoes.filter((m) => m.idProduto === prodId).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
    [state.movimentacoes, prodId],
  );

  const val = useMemo(() => valoracao(state), [state]);
  const abc = useMemo(() => curvaABC(state), [state]);
  const alertas = useMemo(() => alertasLotes(state), [state]);
  const disp = useMemo(() => disponibilidade(state).filter((d) => d.status !== "ok"), [state]);
  const cmv = useMemo(() => cmvMensal(state, 6), [state]);
  const cmvTot = cmv.reduce((a, r) => ({ receita: a.receita + r.receita, cmv: a.cmv + r.cmv, lucro: a.lucro + r.lucro }), { receita: 0, cmv: 0, lucro: 0 });
  const cmvTotMargem = cmvTot.receita > 0 ? (cmvTot.lucro / cmvTot.receita) * 100 : 0;

  const loteNum = (id?: string) => state.lotes.find((l) => l.id === id)?.numeroLote ?? "—";

  return (
    <div className="space-y-5">
      <header className="anim-rise">
        <p className="eyebrow">Análise e auditoria de estoque</p>
        <h1 className="mt-1 font-display text-[28px] font-bold tracking-tight sm:text-3xl">Relatórios</h1>
      </header>

      <div className="anim-rise">
        <Segmented<Sub>
          value={sub}
          onChange={setSub}
          options={[
            { value: "cmv", label: "CMV & Margem" },
            { value: "kardex", label: "Kardex" },
            { value: "valoracao", label: "Valoração" },
            { value: "abc", label: "Curva ABC" },
            { value: "alertas", label: "Alertas", count: alertas.length + disp.length },
          ]}
        />
      </div>

      {sub === "cmv" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <section className="anim-rise space-y-3 xl:col-span-4">
            {[
              { label: "Receita · 6 meses", v: cmvTot.receita, tone: "text-leaf-700" },
              { label: "CMV · 6 meses", v: cmvTot.cmv, tone: "text-coral-600" },
              { label: "Lucro bruto", v: cmvTot.lucro, tone: cmvTot.lucro >= 0 ? "text-ink" : "text-coral-600" },
            ].map((k, i) => (
              <div key={k.label} className="card card-hover px-4 py-3.5" style={{ animationDelay: `${i * 60}ms` }}>
                <p className="eyebrow">{k.label}</p>
                <CountUp value={k.v} format={(n) => brl(n, 0)} className={`num mt-1 block font-display text-[21px] font-bold ${k.tone}`} />
              </div>
            ))}
            <div className="card bg-pine-900 px-4 py-3.5 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Margem bruta média</p>
              <p className="num mt-1 font-display text-[24px] font-bold text-lime-400">{cmvTotMargem.toFixed(1)}%</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-pine-950">
                <div className="h-full rounded-full bg-lime-400 transition-[width] duration-700" style={{ width: `${Math.min(100, Math.max(2, cmvTotMargem))}%` }} />
              </div>
            </div>
          </section>
          <section className="anim-rise card overflow-hidden xl:col-span-8" style={{ animationDelay: "120ms" }}>
            <div className="border-b border-line-soft px-5 py-3.5">
              <h3 className="font-display text-[15px] font-bold tracking-tight">CMV mensal — saídas × custo médio na baixa</h3>
            </div>
            <ul>
              {cmv.map((r) => (
                <li key={r.key} className="flex items-center gap-3 border-b border-line-soft px-5 py-2.5 last:border-0 hover:bg-leaf-50/40">
                  <span className="num w-12 text-[12.5px] font-bold capitalize text-ink-soft">{r.label}</span>
                  <span className="num text-[12px] font-bold text-leaf-700">rec {brl(r.receita, 0)}</span>
                  <span className="num text-[12px] font-bold text-coral-600">cmv {brl(r.cmv, 0)}</span>
                  <span className="num ml-auto text-[12px] font-bold">{brl(r.lucro, 0)}</span>
                  <div className="hidden w-24 sm:block">
                    <div className="h-1.5 overflow-hidden rounded-full bg-mist">
                      <div className={`h-full rounded-full ${r.margemPct >= 0 ? "bg-leaf-500" : "bg-coral-600"}`} style={{ width: `${Math.min(100, Math.max(2, r.margemPct))}%` }} />
                    </div>
                  </div>
                  <span className="num w-12 text-right text-[11.5px] font-bold">{r.margemPct.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {sub === "kardex" && (
        <section className="anim-rise card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-5 py-3.5">
            <h3 className="font-display text-[15px] font-bold tracking-tight">Kardex do produto</h3>
            <select className="field-input ml-auto w-auto min-w-[200px]" value={prodId} onChange={(e) => setProdSel(e.target.value)}>
              {produtosComMov.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          {kardex.length === 0 ? (
            <div className="p-5"><EmptyState icon={<IcCoins size={19} />} title="Sem movimentações" hint="Entradas, saídas, ajustes e perdas aparecem aqui com saldo corrido." /></div>
          ) : (
            <ul>
              {kardex.map((m) => {
                const meta = MOV_META[m.tipo];
                const sinal = m.tipo === "E" ? "+" : m.tipo === "S" || m.tipo === "PERDA" ? "−" : "±";
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft px-5 py-2.5 last:border-0 hover:bg-leaf-50/40">
                    <span className="num w-11 text-[12px] font-semibold text-ink-soft">{fmtMed(m.criadoEm.slice(0, 10))}</span>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="num text-[12.5px] font-bold">{sinal}{fmtQtd(m.quantidade)}</span>
                    <span className="num text-[11.5px] text-ink-faint">{m.valorUnitario != null ? brl(m.valorUnitario) : "—"}/un</span>
                    <span className="num text-[12px] font-semibold text-ink-soft">saldo {fmtQtd(m.saldoAposMov)}</span>
                    <span className="num text-[11.5px] text-ink-faint">lote {loteNum(m.idLote)}</span>
                    {m.idPaciente && <span className="text-[11.5px] text-ink-faint">· {clientName(state.clients, m.idPaciente)}</span>}
                    <span className="ml-auto max-w-[160px] truncate text-[11px] text-ink-faint" title={m.documentoRef}>{m.documentoRef ?? ""}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {sub === "valoracao" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <section className="anim-rise card p-5 xl:col-span-4">
            <p className="eyebrow">Valor total em estoque (saldo × PMP)</p>
            <CountUp value={val.total} format={(n) => brl(n)} className="num mt-2 block font-display text-[26px] font-bold" />
            <div className="mt-4 space-y-2">
              {(Object.keys(val.porTipo) as (keyof typeof val.porTipo)[]).filter((t) => t !== "SERVICO").map((t) => (
                <div key={t} className="flex items-center justify-between rounded-lg bg-mist/70 px-3 py-2">
                  <span className="text-[12.5px] font-bold text-ink-soft">{TIPO_LABEL[t]}s</span>
                  <span className="num text-[13px] font-bold">{brl(val.porTipo[t], 0)}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="anim-rise card overflow-hidden xl:col-span-8" style={{ animationDelay: "80ms" }}>
            <ul>
              {val.linhas.map((l) => (
                <li key={l.produto.id} className="flex items-center gap-3 border-b border-line-soft px-5 py-2.5 last:border-0 hover:bg-leaf-50/40">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold leading-tight">{l.produto.nome}</p>
                    <div className="flex items-center gap-2"><span className="num text-[10.5px] text-ink-faint">{l.produto.sku}</span><ColdTag on={l.produto.refrigerado} /></div>
                  </div>
                  <span className="num text-[12.5px] font-semibold">{fmtQtd(l.saldo, l.produto.unidade)}</span>
                  <span className="num text-[12px] text-ink-soft">{brl(l.pmp)}</span>
                  <span className="num w-24 text-right text-[13px] font-bold">{brl(l.total)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {sub === "abc" && (
        <section className="anim-rise card overflow-hidden">
          <div className="border-b border-line-soft px-5 py-3.5">
            <h3 className="font-display text-[15px] font-bold tracking-tight">Curva ABC — consumo 30 dias × PMP</h3>
          </div>
          {abc.length === 0 ? (
            <div className="p-5"><EmptyState icon={<IcCoins size={19} />} title="Sem consumo no período" hint="Registre aplicações para alimentar a classificação ABC." /></div>
          ) : (
            <ul>
              {abc.map((r, i) => (
                <li key={r.produto.id} className="border-b border-line-soft px-5 py-3 transition-colors last:border-0 hover:bg-leaf-50/40">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-mist text-[12px] font-bold text-ink-soft">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-bold">{r.produto.nome}</p>
                        <Badge tone={r.classe === "A" ? "pine" : r.classe === "B" ? "leaf" : "neutral"}>classe {r.classe}</Badge>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-mist">
                        <div className={`h-full rounded-full ${r.classe === "A" ? "bg-pine-800" : r.classe === "B" ? "bg-leaf-500" : "bg-line"}`} style={{ width: `${Math.max(3, r.acum)}%` }} />
                      </div>
                    </div>
                    <div className="num text-right">
                      <p className="text-[13px] font-bold">{brl(r.valor30)}</p>
                      <p className="text-[11px] text-ink-faint">{r.pct.toFixed(1)}% · acum {r.acum.toFixed(0)}%</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {sub === "alertas" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <section className="anim-rise card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line-soft px-5 py-3.5">
              <IcShieldAlert size={15} className="text-amber-700" />
              <h3 className="font-display text-[15px] font-bold tracking-tight">Quarentena e vencimentos</h3>
            </div>
            {alertas.length === 0 ? (
              <p className="px-5 py-6 text-center text-[13px] text-ink-faint">Nenhum lote bloqueado ou próximo do vencimento.</p>
            ) : (
              <ul>
                {alertas.map((a) => (
                  <li key={a.lote.id + a.tipo} className="border-b border-line-soft px-5 py-3 last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={a.tipo === "vencido" ? "coral" : "amber"}>
                        {a.tipo === "vencido" ? "vencido" : a.tipo === "quarentena" ? "quarentena" : `vence em ${a.dias}d`}
                      </Badge>
                      <p className="text-[13px] font-bold">{a.produto.nome}</p>
                      <span className="num ml-auto text-[11.5px] font-semibold text-ink-faint">{a.lote.numeroLote} · val {fmtShort(loteEfetiva(a.lote))}</span>
                    </div>
                    {a.lote.motivoQuarentena && <p className="mt-1 text-[11.5px] text-ink-soft">{a.lote.motivoQuarentena}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="anim-rise card overflow-hidden" style={{ animationDelay: "80ms" }}>
            <div className="border-b border-line-soft px-5 py-3.5">
              <h3 className="font-display text-[15px] font-bold tracking-tight">Reposição — abaixo do ponto de pedido</h3>
            </div>
            {disp.length === 0 ? (
              <p className="px-5 py-6 text-center text-[13px] text-ink-faint">Todos os itens com estoque disponível acima do PP.</p>
            ) : (
              <ul>
                {disp.map((d) => (
                  <li key={d.produto.id} className="flex items-center gap-3 border-b border-line-soft px-5 py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold">{d.produto.nome}</p>
                      <p className="num text-[11.5px] text-ink-faint">disponível {fmtQtd(Math.max(0, d.disponivel), d.produto.unidade)} · PP {fmtQtd(d.pp)} · lead {d.produto.leadTimeDias}d</p>
                    </div>
                    <Badge tone={d.status === "critico" ? "coral" : "amber"}>{d.status === "critico" ? "crítico" : "repor"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
