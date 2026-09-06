import { useMemo, useState } from "react";
import type { PayMethod, Quote, QuoteStatus } from "../../types";
import { useStore } from "../../lib/store";
import { useUi } from "../../components/modals";
import { Badge, EmptyState, Field, useToast } from "../../components/ui";
import { IcAlert, IcCheck, IcFileText, IcPencil, IcPlus, IcTrash, IcX } from "../../components/icons";
import { addDays, brl, dOffset, fmtMed, todayISO, uid } from "../../lib/utils";
import { calculateQuotePricing } from "../../lib/domain/orcamentos";
import { calculateEmployeeMonthlyCost } from "../../lib/domain/rh";

const STATUS_META: Record<QuoteStatus, { label: string; tone: "neutral" | "amber" | "leaf" | "coral" }> = {
  DRAFT: { label: "rascunho", tone: "neutral" },
  PENDING_APPROVAL: { label: "aguardando aprovação", tone: "amber" },
  APPROVED: { label: "aprovado", tone: "leaf" },
  REJECTED: { label: "rejeitado", tone: "coral" },
};

interface MatRow { id: string; idProduto: string; qtd: string }
interface LabRow { id: string; idEmployee: string; hours: string }

const novaMat = (): MatRow => ({ id: uid(), idProduto: "", qtd: "" });
const novaLab = (): LabRow => ({ id: uid(), idEmployee: "", hours: "" });

export function Orcamentos() {
  const { state, salvarOrcamento, excluirOrcamento, setStatusOrcamento, aprovarOrcamento } = useStore();
  const ui = useUi();
  const { push } = useToast();

  const [editando, setEditando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [mats, setMats] = useState<MatRow[]>([novaMat()]);
  const [labs, setLabs] = useState<LabRow[]>([]);
  const [markup, setMarkup] = useState("30");
  const [tax, setTax] = useState("0");
  const [validade, setValidade] = useState(addDays(todayISO(), 15));
  const [err, setErr] = useState("");

  const materiais = useMemo(
    () =>
      mats
        .map((m) => {
          const p = state.produtos.find((x) => x.id === m.idProduto);
          const q = parseFloat(m.qtd.replace(",", ".")) || 0;
          return p && q > 0 ? { id: m.id, idProduto: p.id, quantity: q, unitCost: p.precoMedio, totalMaterialCost: q * p.precoMedio } : null;
        })
        .filter(Boolean) as Quote["materiais"],
    [mats, state.produtos],
  );

  const month = todayISO().slice(0, 7);
  const maoObra = useMemo(
    () =>
      labs
        .map((l) => {
          const e = state.employees.find((x) => x.id === l.idEmployee);
          const h = parseFloat(l.hours.replace(",", ".")) || 0;
          if (!e || h <= 0) return null;
          const rate = calculateEmployeeMonthlyCost(e, month).costPerHour;
          return { id: l.id, idEmployee: e.id, hours: h, hourlyRate: rate, totalLaborCost: h * rate };
        })
        .filter(Boolean) as Quote["maoObra"],
    [labs, state.employees, month],
  );

  const pricing = calculateQuotePricing(materiais, maoObra, parseFloat(markup.replace(",", ".")) || 0, parseFloat(tax.replace(",", ".")) || 0);

  const salvar = () => {
    if (!clientName.trim()) return setErr("Informe o nome do cliente.");
    if (!materiais.length && !maoObra.length) return setErr("Adicione ao menos um insumo ou hora de mão de obra.");
    const q: Quote = {
      id: editId ?? uid(),
      clientName: clientName.trim(),
      status: editId ? state.quotes.find((x) => x.id === editId)?.status ?? "DRAFT" : "DRAFT",
      materiais, maoObra,
      markupPct: parseFloat(markup.replace(",", ".")) || 0,
      taxPct: parseFloat(tax.replace(",", ".")) || 0,
      validUntil: validade,
      createdAt: editId ? state.quotes.find((x) => x.id === editId)?.createdAt ?? todayISO() : todayISO(),
      idCliente: state.quotes.find((x) => x.id === editId)?.idCliente,
      idFicha: state.quotes.find((x) => x.id === editId)?.idFicha,
    };
    salvarOrcamento(q);
    push("success", editId ? "Orçamento atualizado." : "Orçamento criado como rascunho.");
    resetBuilder();
  };

  const resetBuilder = () => {
    setEditando(false); setEditId(null); setClientName("");
    setMats([novaMat()]); setLabs([]); setMarkup("30"); setTax("0");
    setValidade(addDays(todayISO(), 15)); setErr("");
  };

  const editar = (q: Quote) => {
    setEditando(true); setEditId(q.id); setClientName(q.clientName);
    setMats(q.materiais.map((m) => ({ id: m.id, idProduto: m.idProduto, qtd: String(m.quantity) })));
    setLabs(q.maoObra.map((l) => ({ id: l.id, idEmployee: l.idEmployee, hours: String(l.hours) })));
    setMarkup(String(q.markupPct)); setTax(String(q.taxPct)); setValidade(q.validUntil); setErr("");
  };

  const pedirExclusao = (q: Quote) =>
    ui.confirm({
      title: "Excluir orçamento",
      message: q.status === "APPROVED" ? (
        <>Excluir o orçamento de <strong className="text-ink">{q.clientName}</strong>? O protocolo criado será removido e o paciente ficará sem protocolo vinculado (o paciente não é apagado).</>
      ) : (
        <>Excluir o orçamento de <strong className="text-ink">{q.clientName}</strong>?</>
      ),
      confirmLabel: "Excluir", danger: true,
      action: () => { excluirOrcamento(q.id); push("success", "Orçamento excluído."); },
    });

  const aprovar = (q: Quote) =>
    ui.confirm({
      title: "Aprovar orçamento",
      message: <>Aprovar e criar o paciente <strong className="text-ink">{q.clientName}</strong> com o protocolo do orçamento? Nenhuma baixa de estoque acontece agora — só na aplicação.</>,
      confirmLabel: "Aprovar e criar paciente",
      action: () => {
        const r = aprovarOrcamento(q.id);
        push(r.ok ? "success" : "error", r.ok ? `Paciente ${r.clientName} criado com protocolo. Agende as aplicações na aba Hoje/Pacientes.` : r.error);
      },
    });

  const grupos: { status: QuoteStatus; items: Quote[] }[] = (["PENDING_APPROVAL", "DRAFT", "APPROVED", "REJECTED"] as QuoteStatus[]).map((s) => ({
    status: s,
    items: state.quotes.filter((q) => q.status === s),
  }));

  return (
    <div className="space-y-5">
      <header className="anim-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Precificação · aprovação cria o paciente</p>
          <h1 className="mt-1 font-display text-[28px] font-bold tracking-tight sm:text-3xl">Orçamentos</h1>
        </div>
        {!editando && (
          <button onClick={() => setEditando(true)} className="btn-press inline-flex items-center gap-2 rounded-lg bg-pine-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-pine-800">
            <IcPlus size={15} /> Novo orçamento
          </button>
        )}
      </header>

      {editando && (
        <section className="anim-rise card p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Cliente (prospect)" className="sm:col-span-2">
              <input className="field-input" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome de quem pediu o orçamento" />
            </Field>
            <Field label="Válido até">
              <input className="field-input num" type="date" value={validade} min={todayISO()} onChange={(e) => setValidade(e.target.value)} />
            </Field>
          </div>

          {/* materiais */}
          <div className="mt-4">
            <p className="eyebrow mb-2">Insumos (custo médio congelado)</p>
            <div className="space-y-2">
              {mats.map((m) => {
                const p = state.produtos.find((x) => x.id === m.idProduto);
                const q = parseFloat(m.qtd.replace(",", ".")) || 0;
                return (
                  <div key={m.id} className="grid grid-cols-[1fr_80px_auto] items-center gap-2">
                    <select className="field-input" value={m.idProduto} onChange={(e) => setMats((prev) => prev.map((x) => (x.id === m.id ? { ...x, idProduto: e.target.value } : x)))}>
                      <option value="">Produto…</option>
                      {state.produtos.filter((x) => x.tipo !== "SERVICO").map((x) => <option key={x.id} value={x.id}>{x.nome} ({brl(x.precoMedio)}/{x.unidade})</option>)}
                    </select>
                    <input className="field-input num" placeholder="Qtd" inputMode="decimal" value={m.qtd} onChange={(e) => setMats((prev) => prev.map((x) => (x.id === m.id ? { ...x, qtd: e.target.value } : x)))} />
                    <div className="flex items-center gap-2">
                      <span className="num w-20 text-right text-[12.5px] font-bold">{p ? brl(q * p.precoMedio) : "—"}</span>
                      <button onClick={() => setMats((prev) => prev.filter((x) => x.id !== m.id))} className="btn-press rounded-md p-1.5 text-ink-faint hover:bg-coral-50 hover:text-coral-600" aria-label="Remover"><IcX size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setMats((p) => [...p, novaMat()])} className="btn-press mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-[12px] font-bold text-ink-soft hover:text-leaf-700">
              <IcPlus size={13} /> Insumo
            </button>
          </div>

          {/* mão de obra */}
          <div className="mt-4">
            <p className="eyebrow mb-2">Mão de obra (custo/hora do RH)</p>
            {labs.length === 0 && <p className="text-[12px] text-ink-faint">Sem horas — só o material será precificado.</p>}
            <div className="space-y-2">
              {labs.map((l) => {
                const e = state.employees.find((x) => x.id === l.idEmployee);
                const h = parseFloat(l.hours.replace(",", ".")) || 0;
                const rate = e ? calculateEmployeeMonthlyCost(e, month).costPerHour : 0;
                return (
                  <div key={l.id} className="grid grid-cols-[1fr_80px_auto] items-center gap-2">
                    <select className="field-input" value={l.idEmployee} onChange={(ev) => setLabs((prev) => prev.map((x) => (x.id === l.id ? { ...x, idEmployee: ev.target.value } : x)))}>
                      <option value="">Colaborador…</option>
                      {state.employees.filter((x) => x.status === "ATIVO").map((x) => <option key={x.id} value={x.id}>{x.name} ({brl(calculateEmployeeMonthlyCost(x, month).costPerHour)}/h)</option>)}
                    </select>
                    <input className="field-input num" placeholder="Horas" inputMode="decimal" value={l.hours} onChange={(ev) => setLabs((prev) => prev.map((x) => (x.id === l.id ? { ...x, hours: ev.target.value } : x)))} />
                    <div className="flex items-center gap-2">
                      <span className="num w-20 text-right text-[12.5px] font-bold">{e ? brl(h * rate) : "—"}</span>
                      <button onClick={() => setLabs((prev) => prev.filter((x) => x.id !== l.id))} className="btn-press rounded-md p-1.5 text-ink-faint hover:bg-coral-50 hover:text-coral-600" aria-label="Remover"><IcX size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setLabs((p) => [...p, novaLab()])} className="btn-press mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-[12px] font-bold text-ink-soft hover:text-leaf-700">
              <IcPlus size={13} /> Horas
            </button>
          </div>

          {/* precificação ao vivo */}
          <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-line bg-mist/50 p-4 lg:grid-cols-[auto_1fr]">
            <div className="flex flex-wrap gap-3">
              <Field label="Margem de lucro (%)" className="w-[130px]">
                <input className="field-input num" inputMode="decimal" value={markup} onChange={(e) => setMarkup(e.target.value)} />
              </Field>
              <Field label="Impostos (%)" className="w-[110px]">
                <input className="field-input num" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} />
              </Field>
            </div>
            <div className="min-w-[220px]">
              <p className="eyebrow mb-1.5">Preço = custo ÷ (1 − margem − impostos)</p>
              <dl className="space-y-1 text-[12.5px]">
                <div className="flex justify-between gap-4"><dt className="text-ink-soft">Materiais</dt><dd className="num font-semibold">{brl(pricing.materialsCost)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-soft">Mão de obra</dt><dd className="num font-semibold">{brl(pricing.laborCost)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-soft">Impostos</dt><dd className="num font-semibold">{brl(pricing.taxAmount)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-soft">Lucro</dt><dd className="num font-semibold text-leaf-700">{brl(pricing.profit)}</dd></div>
                <div className="flex items-baseline justify-between gap-4 border-t border-line pt-1.5">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Preço final</dt>
                  <dd className="num font-display text-[20px] font-bold text-leaf-700">{brl(pricing.finalPrice)}</dd>
                </div>
              </dl>
            </div>
          </div>

          {err && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-coral-600"><IcAlert size={13} /> {err}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={resetBuilder} className="btn-press flex-1 rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink-soft hover:text-ink">Cancelar</button>
            <button onClick={salvar} className="btn-big flex-1"><IcCheck size={18} /> Salvar orçamento</button>
          </div>
        </section>
      )}

      {/* lista por status */}
      {state.quotes.length === 0 && !editando ? (
        <EmptyState icon={<IcFileText size={20} />} title="Nenhum orçamento" hint="Crie um orçamento com insumos e horas — ao aprovar, o vira paciente com protocolo." action={
          <button onClick={() => setEditando(true)} className="btn-press rounded-lg bg-pine-900 px-3.5 py-2 text-[13px] font-bold text-white hover:bg-pine-800">Criar primeiro orçamento</button>
        } />
      ) : (
        grupos.filter((g) => g.items.length > 0).map((g) => (
          <section key={g.status} className="space-y-2">
            <h3 className="eyebrow flex items-center gap-2">{STATUS_META[g.status].label} <span className="num text-ink-faint">({g.items.length})</span></h3>
            {g.items.map((q) => {
              const p = calculateQuotePricing(q.materiais, q.maoObra, q.markupPct, q.taxPct);
              return (
                <div key={q.id} className="anim-rise card card-hover p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14.5px] font-bold">{q.clientName}</p>
                        <Badge tone={STATUS_META[q.status].tone}>{STATUS_META[q.status].label}</Badge>
                      </div>
                      <p className="num mt-0.5 text-[11.5px] text-ink-faint">
                        {q.materiais.length} insumo(s) · {q.maoObra.length} hora(s) · válido até {fmtMed(q.validUntil)} · criado {fmtMed(q.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="num font-display text-[19px] font-bold text-leaf-700">{brl(p.finalPrice)}</p>
                      <p className="num text-[10.5px] text-ink-faint">custo {brl(p.directCost)} · margem {p.finalPrice > 0 ? ((p.profit / p.finalPrice) * 100).toFixed(0) : 0}%</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line-soft pt-3">
                    {q.status === "DRAFT" && (
                      <>
                        <button onClick={() => setStatusOrcamento(q.id, "PENDING_APPROVAL")} className="btn-press rounded-lg bg-amber-500 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-amber-600">Enviar p/ aprovação</button>
                        <button onClick={() => editar(q)} className="btn-press inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-[12px] font-bold text-ink-soft hover:text-ink"><IcPencil size={12} /> Editar</button>
                      </>
                    )}
                    {q.status === "PENDING_APPROVAL" && (
                      <>
                        <button onClick={() => aprovar(q)} className="btn-press rounded-lg bg-leaf-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-leaf-700">Aprovar e criar paciente</button>
                        <button onClick={() => setStatusOrcamento(q.id, "REJECTED")} className="btn-press rounded-lg border border-coral-100 px-3 py-1.5 text-[12px] font-bold text-coral-600 hover:bg-coral-50">Rejeitar</button>
                        <button onClick={() => setStatusOrcamento(q.id, "DRAFT")} className="btn-press rounded-lg border border-line px-3 py-1.5 text-[12px] font-bold text-ink-soft">Voltar a rascunho</button>
                      </>
                    )}
                    {q.status === "APPROVED" && (
                      <>
                        <button onClick={() => editar(q)} className="btn-press inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-[12px] font-bold text-ink-soft hover:text-ink"><IcPencil size={12} /> Editar</button>
                        <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink-faint">A baixa acontece na aplicação</span>
                      </>
                    )}
                    {q.status === "REJECTED" && (
                      <button onClick={() => setStatusOrcamento(q.id, "DRAFT")} className="btn-press rounded-lg border border-line px-3 py-1.5 text-[12px] font-bold text-ink-soft">Reabrir como rascunho</button>
                    )}
                    <button onClick={() => pedirExclusao(q)} className="btn-press ml-auto inline-flex items-center gap-1 rounded-lg p-1.5 text-ink-faint hover:bg-coral-50 hover:text-coral-600" aria-label="Excluir"><IcTrash size={14} /></button>
                  </div>
                </div>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
