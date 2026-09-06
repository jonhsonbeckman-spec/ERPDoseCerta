import { useMemo, useState } from "react";
import { useStore } from "../../lib/store";
import { useUi } from "../../components/modals";
import { Badge, EmptyState, Field, useToast } from "../../components/ui";
import { IcAlert, IcCalendar, IcCheck, IcClipboard, IcPlus, IcSyringe, IcTrash, IcX } from "../../components/icons";
import { brl, diffDays, fmtMed, fmtQtd, fmtShort, productName, todayISO } from "../../lib/utils";
import { resumoProtocolo } from "../../lib/domain/protocolos";

interface FarmaRow { id: string; idProduto: string; doses: string; porDose: string }
interface MatRow { id: string; idProduto: string; qtd: string }
interface SvcRow { id: string; descricao: string; valor: string; freq: "UNICA" | "POR_DOSE" }

export function Protocolos() {
  const { state, criarProtocolo, excluirProtocolo, toggleProtocolo, atualizarDataDose } = useStore();
  const ui = useUi();
  const { push } = useToast();

  const [builder, setBuilder] = useState(false);
  const [idCliente, setIdCliente] = useState("");
  const [nome, setNome] = useState("");
  const [farmacos, setFarmacos] = useState<FarmaRow[]>([{ id: "f1", idProduto: "", doses: "4", porDose: "1" }]);
  const [materiais, setMateriais] = useState<MatRow[]>([
    { id: "m1", idProduto: "p-ser", qtd: "1" },
    { id: "m2", idProduto: "p-alc", qtd: "2" },
  ]);
  const [servicos, setServicos] = useState<SvcRow[]>([{ id: "s1", descricao: "Anamnese e plano terapêutico", valor: "150", freq: "UNICA" }]);
  const [valorDose, setValorDose] = useState("");
  const [inicio, setInicio] = useState(todayISO());
  const [intervalo, setIntervalo] = useState("7");
  const [err, setErr] = useState("");

  const insumos = state.produtos.filter((p) => p.tipo !== "SERVICO");

  const salvar = () => {
    if (!idCliente) return setErr("Selecione o paciente.");
    if (!nome.trim()) return setErr("Dê um nome ao protocolo (ex.: Mounjaro 2,5 ×4 + 5 ×2).");
    const f = farmacos
      .map((x) => ({ idProduto: x.idProduto, qtdDoses: parseInt(x.doses) || 0, qtdPorDose: parseFloat(x.porDose.replace(",", ".")) || 1, unidadeConsumo: state.produtos.find((p) => p.id === x.idProduto)?.unidade ?? "un" }))
      .filter((x) => x.idProduto && x.qtdDoses > 0);
    if (!f.length) return setErr("Adicione ao menos um fármaco com doses.");
    const r = criarProtocolo({
      idCliente, nome,
      farmacos: f,
      materiais: materiais.map((m) => ({ idProduto: m.idProduto, qtd: parseFloat(m.qtd.replace(",", ".")) || 0 })).filter((m) => m.idProduto && m.qtd > 0),
      servicos: servicos.map((s) => ({ descricao: s.descricao.trim(), valor: parseFloat(s.valor.replace(",", ".")) || 0, frequencia: s.freq })).filter((s) => s.descricao),
      valorPorDose: parseFloat(valorDose.replace(",", ".")) || 0,
      dataInicio: inicio,
      intervaloDias: Math.max(1, parseInt(intervalo) || 7),
    });
    if (r.ok) {
      push("success", "Protocolo criado — doses agendadas na ficha do paciente.");
      setBuilder(false); setErr(""); setNome(""); setValorDose("");
    } else setErr(r.error);
  };

  return (
    <div className="space-y-5">
      {!builder && (
        <button onClick={() => setBuilder(true)} className="btn-press inline-flex items-center gap-2 rounded-lg bg-pine-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-pine-800">
          <IcPlus size={15} /> Novo protocolo
        </button>
      )}

      {builder && (
        <section className="anim-rise card p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Paciente">
              <select className="field-input" value={idCliente} onChange={(e) => setIdCliente(e.target.value)}>
                <option value="">Selecione…</option>
                {state.clients.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Nome do protocolo" className="sm:col-span-2">
              <input className="field-input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Mounjaro · titulação 6 semanas" />
            </Field>
          </div>

          <div className="mt-4">
            <p className="eyebrow mb-2">Fármacos (sequência de doses)</p>
            {farmacos.map((f, i) => (
              <div key={f.id} className="mb-2 grid grid-cols-[1fr_70px_90px_auto] items-center gap-2">
                <select className="field-input" value={f.idProduto} onChange={(e) => setFarmacos((prev) => prev.map((x) => (x.id === f.id ? { ...x, idProduto: e.target.value } : x)))}>
                  <option value="">Fármaco…</option>
                  {insumos.filter((p) => p.tipo === "FARMACO").map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <input className="field-input num" placeholder="doses" type="number" min="1" value={f.doses} onChange={(e) => setFarmacos((prev) => prev.map((x) => (x.id === f.id ? { ...x, doses: e.target.value } : x)))} />
                <input className="field-input num" placeholder="qtd/dose" inputMode="decimal" value={f.porDose} onChange={(e) => setFarmacos((prev) => prev.map((x) => (x.id === f.id ? { ...x, porDose: e.target.value } : x)))} />
                <button onClick={() => setFarmacos((prev) => prev.filter((x) => x.id !== f.id))} disabled={farmacos.length === 1} className="btn-press rounded-md p-1.5 text-ink-faint hover:bg-coral-50 hover:text-coral-600 disabled:opacity-30" aria-label="Remover"><IcX size={13} /></button>
              </div>
            ))}
            <button onClick={() => setFarmacos((p) => [...p, { id: `f${p.length + 1}`, idProduto: "", doses: "2", porDose: "1" }])} className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-[12px] font-bold text-ink-soft hover:text-leaf-700">
              <IcPlus size={13} /> Fármaco
            </button>
          </div>

          <div className="mt-4">
            <p className="eyebrow mb-2">Insumos baixados por dose (seringa, swab, luvas…)</p>
            {materiais.map((m) => (
              <div key={m.id} className="mb-2 grid grid-cols-[1fr_90px_auto] items-center gap-2">
                <select className="field-input" value={m.idProduto} onChange={(e) => setMateriais((prev) => prev.map((x) => (x.id === m.id ? { ...x, idProduto: e.target.value } : x)))}>
                  <option value="">Insumo…</option>
                  {insumos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <input className="field-input num" placeholder="qtd/dose" inputMode="decimal" value={m.qtd} onChange={(e) => setMateriais((prev) => prev.map((x) => (x.id === m.id ? { ...x, qtd: e.target.value } : x)))} />
                <button onClick={() => setMateriais((prev) => prev.filter((x) => x.id !== m.id))} className="btn-press rounded-md p-1.5 text-ink-faint hover:bg-coral-50 hover:text-coral-600" aria-label="Remover"><IcX size={13} /></button>
              </div>
            ))}
            <button onClick={() => setMateriais((p) => [...p, { id: `m${p.length + 1}`, idProduto: "", qtd: "1" }])} className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-[12px] font-bold text-ink-soft hover:text-leaf-700">
              <IcPlus size={13} /> Insumo
            </button>
          </div>

          <div className="mt-4">
            <p className="eyebrow mb-2">Serviços cobrados (anamnese, avaliação…)</p>
            {servicos.map((s) => (
              <div key={s.id} className="mb-2 grid grid-cols-[1fr_90px_110px_auto] items-center gap-2">
                <input className="field-input" placeholder="Descrição" value={s.descricao} onChange={(e) => setServicos((prev) => prev.map((x) => (x.id === s.id ? { ...x, descricao: e.target.value } : x)))} />
                <input className="field-input num" placeholder="R$" inputMode="decimal" value={s.valor} onChange={(e) => setServicos((prev) => prev.map((x) => (x.id === s.id ? { ...x, valor: e.target.value } : x)))} />
                <select className="field-input" value={s.freq} onChange={(e) => setServicos((prev) => prev.map((x) => (x.id === s.id ? { ...x, freq: e.target.value as SvcRow["freq"] } : x)))}>
                  <option value="UNICA">uma vez</option>
                  <option value="POR_DOSE">por dose</option>
                </select>
                <button onClick={() => setServicos((prev) => prev.filter((x) => x.id !== s.id))} className="btn-press rounded-md p-1.5 text-ink-faint hover:bg-coral-50 hover:text-coral-600" aria-label="Remover"><IcX size={13} /></button>
              </div>
            ))}
            <button onClick={() => setServicos((p) => [...p, { id: `s${p.length + 1}`, descricao: "", valor: "", freq: "POR_DOSE" }])} className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-[12px] font-bold text-ink-soft hover:text-leaf-700">
              <IcPlus size={13} /> Serviço
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Valor por dose (R$)">
              <input className="field-input num" inputMode="decimal" value={valorDose} onChange={(e) => setValorDose(e.target.value)} placeholder="0,00" />
            </Field>
            <Field label="Início">
              <input className="field-input num" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </Field>
            <Field label="Intervalo (dias)">
              <input className="field-input num" type="number" min="1" value={intervalo} onChange={(e) => setIntervalo(e.target.value)} />
            </Field>
          </div>

          {err && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-coral-600"><IcAlert size={13} /> {err}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={() => { setBuilder(false); setErr(""); }} className="btn-press flex-1 rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink-soft hover:text-ink">Cancelar</button>
            <button onClick={salvar} className="btn-big flex-1"><IcCheck size={18} /> Criar protocolo</button>
          </div>
        </section>
      )}

      {state.protocolos.length === 0 && !builder ? (
        <EmptyState icon={<IcClipboard size={20} />} title="Nenhum protocolo comprado" hint="Ex.: Mounjaro 2,5 mg ×4 doses + 5 mg ×2, uma aplicação a cada 7 dias — com insumos e serviços cobrados." />
      ) : (
        state.protocolos.map((p) => {
          const c = state.clients.find((x) => x.id === p.idCliente);
          const res = resumoProtocolo(p);
          return (
            <section key={p.id} className="anim-rise card overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-mist/50 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold">{p.nome}</p>
                  <p className="text-[11.5px] text-ink-faint">{c?.name ?? "—"} · início {fmtMed(p.dataInicio)} · a cada {p.intervaloDias} dias · {brl(p.valorPorDose, 0)}/dose</p>
                </div>
                <Badge tone={res.pct === 100 ? "leaf" : "neutral"}>{res.aplicadas}/{res.total} doses</Badge>
                {!p.ativo && <Badge tone="coral">pausado</Badge>}
                <button onClick={() => toggleProtocolo(p.id)} className="btn-press rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] font-bold text-ink-soft hover:text-amber-700">
                  {p.ativo ? "Pausar" : "Retomar"}
                </button>
                <button
                  onClick={() => ui.confirm({
                    title: "Excluir protocolo",
                    message: <>Excluir <strong className="text-ink">{p.nome}</strong>? O histórico de serviços aplicados permanece.</>,
                    confirmLabel: "Excluir", danger: true,
                    action: () => { excluirProtocolo(p.id); push("success", "Protocolo excluído."); },
                  })}
                  className="btn-press rounded-lg p-1.5 text-ink-faint hover:bg-coral-50 hover:text-coral-600" aria-label="Excluir">
                  <IcTrash size={14} />
                </button>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-mist mx-4" style={{ width: "calc(100% - 2rem)" }}>
                <div className="h-full rounded-full bg-leaf-500 transition-[width] duration-700" style={{ width: `${res.pct}%` }} />
              </div>
              <ul className="mt-2">
                {p.doses.map((d) => {
                  const dd = diffDays(todayISO(), d.data);
                  return (
                    <li key={d.id} className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-2.5 last:border-0 hover:bg-leaf-50/40">
                      <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-mist text-[11.5px] font-bold text-ink-soft">{d.numero}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{productName(state.produtos, d.idProduto)} <span className="num text-ink-faint">· {fmtQtd(d.qtd)}</span></span>
                      {d.status === "APLICADA" ? (
                        <Badge tone="leaf"><IcCheck size={11} /> aplicada {fmtShort(d.data)}</Badge>
                      ) : (
                        <>
                          <input
                            type="date"
                            className="num rounded-lg border border-line bg-paper px-2 py-1 text-[11.5px] font-semibold text-ink-soft"
                            value={d.data}
                            onChange={(e) => e.target.value && atualizarDataDose(p.id, d.id, e.target.value)}
                            aria-label="Data da dose"
                          />
                          {dd < 0 ? <Badge tone="coral">atrasada {-dd}d</Badge> : dd === 0 ? <Badge tone="leaf">hoje</Badge> : <Badge tone="neutral">em {dd}d</Badge>}
                          <button onClick={() => ui.openAplicarDose(p.id, d.id)} className="btn-press inline-flex items-center gap-1 rounded-lg bg-leaf-600 px-2.5 py-1.5 text-[11.5px] font-bold text-white hover:bg-leaf-700">
                            <IcSyringe size={12} /> Aplicar
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
              {p.servicos.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-line-soft bg-mist/40 px-4 py-2.5">
                  {p.servicos.map((s) => (
                    <Badge key={s.id} tone="neutral">
                      <IcCalendar size={10} /> {s.descricao} · {brl(s.valor, 0)} {s.frequencia === "UNICA" ? "(1×)" : "/dose"}
                    </Badge>
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
