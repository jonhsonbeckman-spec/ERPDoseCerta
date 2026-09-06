import { useMemo } from "react";
import { useStore } from "../../lib/store";
import { useUi } from "../../components/modals";
import { Badge, CountUp, EmptyState } from "../../components/ui";
import { IcBox, IcPencil, IcSnow } from "../../components/icons";
import { brl, fmtQtd } from "../../lib/utils";
import { fefoSort } from "../../lib/domain/engine";

export function Estoque() {
  const { state } = useStore();
  const ui = useUi();

  const rows = useMemo(
    () => state.produtos.filter((p) => p.tipo !== "SERVICO").sort((a, b) => a.nome.localeCompare(b.nome)),
    [state.produtos],
  );

  const mov = useMemo(() => {
    const m: Record<string, { e: number; s: number }> = {};
    for (const x of state.movimentacoes) {
      m[x.idProduto] ??= { e: 0, s: 0 };
      if (x.tipo === "E") m[x.idProduto].e += x.quantidade;
      if (x.tipo === "S") m[x.idProduto].s += x.quantidade;
    }
    return m;
  }, [state.movimentacoes]);

  const totalValor = rows.reduce((a, p) => a + p.saldoAtual * p.precoMedio, 0);

  const statusBadge = (p: (typeof rows)[number]) => {
    const disp = p.saldoAtual;
    if (disp <= 0 || disp < p.estoqueMinimo) return <Badge tone="coral">crítico</Badge>;
    if (disp < p.estoqueMinimo * 2) return <Badge tone="amber">repor</Badge>;
    return <Badge tone="leaf">ok</Badge>;
  };

  return (
    <div className="space-y-5">
      <header className="anim-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Saldo, entradas, saídas e custo médio</p>
          <h1 className="mt-1 font-display text-[28px] font-bold tracking-tight sm:text-3xl">Estoque</h1>
        </div>
        <div className="text-right">
          <p className="eyebrow">Valor total (PMP)</p>
          <CountUp value={totalValor} format={(n) => brl(n, 0)} className="num block font-display text-[22px] font-bold" />
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState icon={<IcBox size={20} />} title="Nenhum produto cadastrado" hint="Registre uma compra em Compras & Lotes para criar produtos e lotes." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p, i) => {
            const e = mov[p.id]?.e ?? 0;
            const s = mov[p.id]?.s ?? 0;
            const total = p.saldoAtual * p.precoMedio;
            const pctMax = p.estoqueMaximo > 0 ? Math.min(100, (p.saldoAtual / p.estoqueMaximo) * 100) : 100;
            const loteAlvo = fefoSort(state.lotes.filter((l) => l.idProduto === p.id && l.status !== "DESCARTADO"))[0];
            return (
              <div key={p.id} className="anim-rise card card-hover flex flex-col p-4" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold">{p.nome}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="num text-[10.5px] font-bold text-ink-faint">{p.sku}</span>
                      <Badge tone={p.tipo === "FARMACO" ? "pine" : "neutral"}>{p.categoria || p.tipo}</Badge>
                      {p.refrigerado && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-sky-700"><IcSnow size={10} /> 2–8 °C</span>}
                    </div>
                  </div>
                  {statusBadge(p)}
                </div>

                <p className="num mt-3 font-display text-[24px] font-bold leading-none">
                  {fmtQtd(p.saldoAtual)} <span className="text-[13px] font-semibold text-ink-faint">{p.unidade}</span>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist">
                  <div className={`h-full rounded-full ${p.saldoAtual < p.estoqueMinimo ? "bg-coral-600" : "bg-leaf-500"} transition-[width] duration-700`} style={{ width: `${pctMax}%` }} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-mist/60 p-2 text-center">
                  <div><p className="num text-[13px] font-bold text-leaf-700">+{fmtQtd(e)}</p><p className="text-[9.5px] font-bold uppercase tracking-wide text-ink-faint">entradas</p></div>
                  <div><p className="num text-[13px] font-bold text-coral-600">−{fmtQtd(s)}</p><p className="text-[9.5px] font-bold uppercase tracking-wide text-ink-faint">saídas</p></div>
                  <div><p className="num text-[13px] font-bold">{brl(p.precoMedio)}</p><p className="text-[9.5px] font-bold uppercase tracking-wide text-ink-faint">custo médio</p></div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line-soft pt-3">
                  <div>
                    <p className="eyebrow">Valor total</p>
                    <p className="num text-[14px] font-bold text-leaf-700">{brl(total)}</p>
                  </div>
                  <button
                    onClick={() => loteAlvo && ui.openAjuste(loteAlvo.id)}
                    disabled={!loteAlvo}
                    title={loteAlvo ? `Ajustar estoque (lote ${loteAlvo.numeroLote}) — perda ou contagem, sem alterar o PMP` : "Sem lotes para ajustar — registre uma aquisição em Compras & Lotes"}
                    className={`btn-press inline-flex items-center gap-1 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${
                      loteAlvo ? "text-ink-soft hover:border-leaf-200 hover:bg-leaf-50 hover:text-leaf-700" : "cursor-not-allowed opacity-40"
                    }`}
                  >
                    <IcPencil size={12} /> Ajustar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="anim-rise text-[11.5px] leading-relaxed text-ink-faint">
        O preço médio (PMP) só é recalculado em entradas de compra — perdas e ajustes nunca o alteram. Detalhes de lotes, validade e quarentena ficam em Compras &amp; Lotes e Relatórios.
      </p>
    </div>
  );
}
