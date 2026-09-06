import { useEffect, useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { MEI_CAP, brl, monthFull, monthTotals, yearRevenue, todayISO, monthKey } from "../lib/utils";
import { cmvDoMes } from "../lib/domain/analytics";
import { CountUp } from "./ui";
import { IcInfo } from "./icons";

const META_KEY = "dosecerta:metaMensal";

export function ResumoMes({ month }: { month: string }) {
  const { state } = useStore();
  const [meta, setMeta] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem(META_KEY) ?? "");
    return isNaN(v) ? 12000 : v;
  });
  const [editMeta, setEditMeta] = useState(false);
  const [metaInput, setMetaInput] = useState("");

  const tot = useMemo(() => monthTotals(state.transactions, month), [state.transactions, month]);
  const cmv = useMemo(() => cmvDoMes(state, month), [state, month]);
  const outrasDesp = tot.des - state.transactions.filter((t) => t.type === "despesa" && t.category === "Custo do serviço prestado" && t.date.startsWith(month)).reduce((a, t) => a + t.amount, 0);
  const sobra = tot.rec - tot.des;
  const margem = tot.rec > 0 ? (sobra / tot.rec) * 100 : 0;

  const ano = new Date().getFullYear();
  const revAno = yearRevenue(state.transactions, ano);
  const pctMEI = Math.min(100, (revAno / MEI_CAP) * 100);
  const faltamMeta = Math.max(0, meta - tot.rec);

  useEffect(() => {
    localStorage.setItem(META_KEY, String(meta));
  }, [meta]);

  const salvarMeta = () => {
    const v = Math.round((parseFloat(metaInput.replace(",", ".")) || 0));
    if (v > 0) setMeta(v);
    setEditMeta(false);
  };

  return (
    <section className="anim-rise card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft bg-pine-900 px-5 py-3.5">
        <h3 className="font-display text-[15px] font-bold tracking-tight text-white">Como está {monthFull(month).toLowerCase()}?</h3>
        {editMeta ? (
          <span className="flex items-center gap-1.5">
            <input autoFocus className="num w-28 rounded-lg border border-pine-700 bg-pine-800 px-2 py-1 text-right text-[12px] font-bold text-white"
              type="number" min="0" value={metaInput} onChange={(e) => setMetaInput(e.target.value)} placeholder="12000" />
            <button onClick={salvarMeta} className="btn-press rounded-lg bg-lime-400 px-2.5 py-1 text-[11.5px] font-bold text-pine-950">OK</button>
          </span>
        ) : (
          <button onClick={() => { setMetaInput(String(meta)); setEditMeta(true); }} className="btn-press rounded-lg border border-pine-700 px-2.5 py-1 text-[11.5px] font-bold text-lime-400 hover:bg-pine-800">
            meta {brl(meta, 0)} ✎
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 divide-x divide-line-soft border-b border-line-soft sm:grid-cols-4">
        <div className="px-4 py-3.5">
          <p className="eyebrow">Receita</p>
          <CountUp value={tot.rec} format={(n) => brl(n, 0)} className="num mt-1 block font-display text-[19px] font-bold text-leaf-700" />
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-mist">
            <div className="h-full rounded-full bg-leaf-500 transition-[width] duration-700" style={{ width: `${Math.min(100, (tot.rec / Math.max(1, meta)) * 100)}%` }} />
          </div>
          <p className="mt-1 text-[10.5px] font-semibold text-ink-faint">{faltamMeta > 0 ? `faltam ${brl(faltamMeta, 0)} p/ meta` : "meta batida 🎉"}</p>
        </div>
        <div className="px-4 py-3.5">
          <p className="eyebrow">Insumos (CMV)</p>
          <CountUp value={cmv} format={(n) => brl(n, 0)} className="num mt-1 block font-display text-[19px] font-bold text-coral-600" />
          <p className="mt-1 text-[10.5px] font-semibold text-ink-faint">custo do que foi aplicado</p>
        </div>
        <div className="px-4 py-3.5">
          <p className="eyebrow">Outras despesas</p>
          <CountUp value={Math.max(0, outrasDesp)} format={(n) => brl(n, 0)} className="num mt-1 block font-display text-[19px] font-bold text-ink-soft" />
          <p className="mt-1 text-[10.5px] font-semibold text-ink-faint">aluguel, DAS, marketing…</p>
        </div>
        <div className="px-4 py-3.5">
          <p className="eyebrow">Sobra líquida</p>
          <CountUp value={sobra} format={(n) => `${n < 0 ? "−" : ""}${brl(Math.abs(n), 0)}`} className={`num mt-1 block font-display text-[19px] font-bold ${sobra >= 0 ? "text-ink" : "text-coral-600"}`} />
          <p className={`mt-1 text-[10.5px] font-semibold ${margem >= 0 ? "text-leaf-700" : "text-coral-600"}`}>margem {margem.toFixed(1)}%</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-5 py-3">
        <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-ink-soft">
          Teto MEI {ano}: <span className="num text-ink">{brl(revAno, 0)}</span>
        </span>
        <div className="h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-mist">
          <div className={`h-full rounded-full transition-[width] duration-700 ${pctMEI >= 85 ? "bg-coral-600" : pctMEI >= 60 ? "bg-amber-500" : "bg-leaf-500"}`} style={{ width: `${pctMEI}%` }} />
        </div>
        <span className={`num text-[11.5px] font-bold ${pctMEI >= 85 ? "text-coral-600" : "text-ink-faint"}`}>{pctMEI.toFixed(1)}%</span>
        <span className="flex items-center gap-1 text-[10.5px] font-medium text-ink-faint">
          <IcInfo size={11} /> DAS ~R$ 75,90 · vence dia 20
        </span>
      </div>
    </section>
  );
}
