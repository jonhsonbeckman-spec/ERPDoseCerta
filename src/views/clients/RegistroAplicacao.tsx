import { useMemo, useState } from "react";
import type { Client, ViaAplicacao } from "../../types";
import { useStore } from "../../lib/store";
import { Badge, EmptyState, Field, useToast } from "../../components/ui";
import { IcAlert, IcCheck, IcClock, IcPlus, IcSyringe, IcX } from "../../components/icons";
import { fmtLong, todayISO, uid } from "../../lib/utils";
import { glp1Alertas } from "./Prontuario";

export const VIA_LABEL: Record<ViaAplicacao, string> = {
  subcutanea: "Subcutânea",
  intravenosa: "Intravenosa",
  intramuscular: "Intramuscular",
  cutanea: "Cutânea",
  intradermica: "Intradérmica",
};

export const VIA_TONE: Record<ViaAplicacao, "leaf" | "pine" | "amber" | "neutral" | "coral"> = {
  subcutanea: "leaf",
  intravenosa: "pine",
  intramuscular: "amber",
  cutanea: "neutral",
  intradermica: "coral",
};

const LOCAIS = [
  "Quadrante superior abdominal",
  "Região periumbilical",
  "Deltoide",
  "Glúteo QSE",
  "Face anterior da coxa",
];

const pad = (x: number) => String(x).padStart(2, "0");
const agoraIso = () => {
  const n = new Date();
  return `${todayISO()}T${pad(n.getHours())}:${pad(n.getMinutes())}`;
};

export const fmtDataHora = (dt: string) => {
  const [d, h] = dt.split("T");
  return `${fmtLong(d)}${h ? ` · ${h}` : ""}`;
};

/* ---------- Registro de aplicação ---------- */
export function RegistroAplicacao({ cliente }: { cliente: Client }) {
  const { state, registrarAplicacao } = useStore();
  const { push } = useToast();

  const anamnese = useMemo(
    () => state.anamneses.filter((a) => a.pacienteId === cliente.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
    [state.anamneses, cliente.id],
  );
  const alertas = glp1Alertas(anamnese);

  const protocolos = state.protocolos.filter((p) => p.idCliente === cliente.id && p.ativo);
  const dosesPendentes = protocolos.flatMap((p) => p.doses.filter((d) => d.status === "AGENDADA").map((d) => ({ p, d })));
  const fichas = state.fichas.filter((f) => f.ativo);

  const [dataHora, setDataHora] = useState(agoraIso());
  const [procedimento, setProcedimento] = useState("");
  const [protocolo, setProtocolo] = useState("");
  const [via, setVia] = useState<ViaAplicacao>("subcutanea");
  const [local, setLocal] = useState("");
  const [material, setMaterial] = useState("");
  const [evolucao, setEvolucao] = useState("");
  const [idDose, setIdDose] = useState("");
  const [substancias, setSubstancias] = useState([{ id: uid(), nome: "", dose: "", lote: "" }]);
  const [err, setErr] = useState("");

  const setSub = (id: string, patch: Partial<{ nome: string; dose: string; lote: string }>) =>
    setSubstancias((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const salvar = () => {
    if (!procedimento.trim()) return setErr("Informe o procedimento realizado.");
    if (!local.trim()) return setErr("Informe o local de aplicação.");
    const validas = substancias.filter((s) => s.nome.trim());
    if (!validas.length) return setErr("Adicione ao menos uma substância com nome.");
    if (validas.some((s) => !s.lote.trim())) return setErr("Informe o lote de todas as substâncias (rastreabilidade ANVISA).");

    const r = registrarAplicacao({
      pacienteId: cliente.id,
      dataHora,
      procedimento: procedimento.trim(),
      protocolo: protocolo.trim(),
      via,
      local: local.trim(),
      substancias: validas.map((s) => ({ nome: s.nome.trim(), dose: s.dose.trim(), lote: s.lote.trim() })),
      material: material.trim(),
      evolucao: evolucao.trim(),
      idDose: idDose || undefined,
    });
    if (r.ok) {
      push("success", "Aplicação registrada no prontuário e na linha do tempo.");
      setProcedimento(""); setProtocolo(""); setLocal(""); setMaterial(""); setEvolucao("");
      setIdDose(""); setSubstancias([{ id: uid(), nome: "", dose: "", lote: "" }]); setErr("");
    } else setErr(r.error);
  };

  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[16px] font-bold tracking-tight">Registrar aplicação</h3>
        <Badge tone="neutral">{VIA_LABEL[via]}</Badge>
      </div>

      {alertas.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-coral-100 bg-coral-50 px-3.5 py-2.5">
          <IcAlert size={15} className="shrink-0 text-coral-600" />
          <p className="text-[12px] font-semibold text-coral-700">{alertas.join(" · ")} — confirme a prescrição antes de prosseguir.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Data e horário">
          <input className="field-input num" type="datetime-local" value={dataHora} max={agoraIso()} onChange={(e) => setDataHora(e.target.value)} />
        </Field>
        <Field label="Via de aplicação">
          <select className="field-input" value={via} onChange={(e) => setVia(e.target.value as ViaAplicacao)}>
            {(Object.keys(VIA_LABEL) as ViaAplicacao[]).map((v) => <option key={v} value={v}>{VIA_LABEL[v]}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Procedimento realizado">
        <input className="field-input" value={procedimento} onChange={(e) => setProcedimento(e.target.value)} placeholder="Ex.: Tirzepatida 2,5 mg — 3ª semana" />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Protocolo de aplicação">
          <select className="field-input" value={protocolo} onChange={(e) => setProtocolo(e.target.value)}>
            <option value="">Selecione…</option>
            {protocolos.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
            {fichas.filter((f) => !protocolos.some((p) => p.nome === f.nome)).map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
          </select>
        </Field>
        <Field label="Local de aplicação">
          <input className="field-input" list="locais-aplicacao" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Quadrante superior abdominal" />
          <datalist id="locais-aplicacao">
            {LOCAIS.map((l) => <option key={l} value={l} />)}
          </datalist>
        </Field>
      </div>

      {/* substâncias com lote */}
      <div>
        <p className="eyebrow mb-2">Substâncias utilizadas (nome · dose · lote)</p>
        <div className="space-y-2">
          {substancias.map((s) => (
            <div key={s.id} className="grid grid-cols-[1fr_80px_110px_auto] items-center gap-2">
              <input className="field-input" placeholder="Medicamento" value={s.nome} onChange={(e) => setSub(s.id, { nome: e.target.value })} />
              <input className="field-input num" placeholder="Dose" value={s.dose} onChange={(e) => setSub(s.id, { dose: e.target.value })} />
              <input className="field-input num" placeholder="Lote" value={s.lote} onChange={(e) => setSub(s.id, { lote: e.target.value })} />
              <button
                onClick={() => setSubstancias((prev) => (prev.length > 1 ? prev.filter((x) => x.id !== s.id) : prev))}
                className="btn-press rounded-lg p-2 text-ink-faint hover:bg-coral-50 hover:text-coral-600"
                aria-label="Remover substância"
              >
                <IcX size={13} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => setSubstancias((p) => [...p, { id: uid(), nome: "", dose: "", lote: "" }])} className="btn-press mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-[12px] font-bold text-ink-soft hover:text-leaf-700">
          <IcPlus size={13} /> Substância
        </button>
      </div>

      <Field label="Material utilizado">
        <input className="field-input" value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Seringa 1ml, agulha 30G 4mm, swab álcool 70%, luva nitrílica" />
      </Field>

      <Field label="Evolução do tratamento / observações">
        <textarea className="field-input min-h-[70px] resize-y" value={evolucao} onChange={(e) => setEvolucao(e.target.value)} placeholder="Reação imediata, tolerância, orientações dadas…" />
      </Field>

      {dosesPendentes.length > 0 && (
        <Field label="Vincular a uma dose do protocolo (baixa estoque + finanças)">
          <select className="field-input" value={idDose} onChange={(e) => setIdDose(e.target.value)}>
            <option value="">Não vincular (só prontuário)</option>
            {dosesPendentes.map(({ p, d }) => (
              <option key={d.id} value={d.id}>
                Dose {d.numero}/{p.doses.length} — {state.produtos.find((x) => x.id === d.idProduto)?.nome ?? "fármaco"} ({d.data})
              </option>
            ))}
          </select>
        </Field>
      )}

      {err && <p className="flex items-center gap-1.5 text-xs font-semibold text-coral-600"><IcAlert size={13} /> {err}</p>}
      <button onClick={salvar} className="btn-big">
        <IcSyringe size={19} /> Registrar no prontuário
      </button>
    </div>
  );
}

/* ---------- Linha do tempo ---------- */
export function Timeline({ cliente }: { cliente: Client }) {
  const { state } = useStore();
  const entradas = state.historico
    .filter((h) => h.pacienteId === cliente.id)
    .sort((a, b) => b.dataHora.localeCompare(a.dataHora));

  if (entradas.length === 0)
    return (
      <div className="card p-6">
        <EmptyState icon={<IcClock size={20} />} title="Linha do tempo vazia" hint="As aplicações registradas aparecem aqui em ordem cronológica." />
      </div>
    );

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <h3 className="font-display text-[14px] font-bold tracking-tight">Linha do tempo do paciente</h3>
        <Badge tone="neutral">{entradas.length} registro{entradas.length !== 1 ? "s" : ""}</Badge>
      </div>
      <ol className="relative">
        {entradas.map((h, i) => (
          <li key={h.id} className="anim-rise relative border-b border-line-soft px-4 py-3.5 pl-9 last:border-0 hover:bg-leaf-50/40" style={{ animationDelay: `${i * 40}ms` }}>
            {/* linha vertical + ponto */}
            <span className="absolute left-[15px] top-0 h-full w-px bg-line-soft" />
            <span className={`absolute left-[11px] top-[18px] h-2.5 w-2.5 rounded-full ring-4 ring-paper ${i === 0 ? "bg-leaf-600 dot-live" : "bg-leaf-500"}`} />
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={VIA_TONE[h.tipoAplicacao]}>{VIA_LABEL[h.tipoAplicacao]}</Badge>
              <span className="num text-[11px] font-semibold text-ink-faint">{fmtDataHora(h.dataHora)}</span>
            </div>
            <p className="mt-1.5 text-[13.5px] font-bold">{h.procedimentoRealizado}</p>
            {h.protocoloAplicacao && <p className="text-[12px] text-ink-soft">Protocolo: {h.protocoloAplicacao}</p>}
            {h.medicamentoAplicado && <p className="text-[12px] text-ink-soft">Medicamento: {h.medicamentoAplicado}</p>}
            {h.localAplicacao && <p className="text-[12px] text-ink-soft">Local: {h.localAplicacao}</p>}
            {h.materialUtilizado && <p className="text-[12px] text-ink-soft">Material: {h.materialUtilizado}</p>}
            {h.evolucaoTratamento && (
              <p className="mt-1.5 rounded-lg bg-mist/70 px-3 py-2 text-[12px] leading-snug text-ink-soft">
                <strong className="text-ink">Evolução:</strong> {h.evolucaoTratamento}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
