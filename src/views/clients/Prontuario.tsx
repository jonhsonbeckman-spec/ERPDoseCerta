import { useMemo, useState } from "react";
import type { Anamnese, Client } from "../../types";
import { useStore } from "../../lib/store";
import { useUi } from "../../components/modals";
import { Badge, Field, useToast } from "../../components/ui";
import { IcAlert, IcCheck, IcClipboard, IcFlask, IcPencil, IcShieldAlert, IcSyringe, IcTrash } from "../../components/icons";
import { fmtMed, fmtShort, todayISO, uid } from "../../lib/utils";
import { Tcle } from "./Tcle";
import { RegistroAplicacao, Timeline } from "./RegistroAplicacao";

type Secao = "anamnese" | "fisica" | "tcle" | "aplicacao" | "timeline";

const SECOES: { key: Secao; label: string; icon: typeof IcClipboard }[] = [
  { key: "anamnese", label: "Anamnese", icon: IcClipboard },
  { key: "fisica", label: "Avaliação física", icon: IcFlask },
  { key: "tcle", label: "TCLE", icon: IcShieldAlert },
  { key: "aplicacao", label: "Registrar aplicação", icon: IcSyringe },
  { key: "timeline", label: "Linha do tempo", icon: IcClipboard },
];

const ALERGIAS_COMUNS = ["Penicilina", "Dipirona", "AAS", "Látex", "Conservantes", "Anestésicos"];
const CONDICOES_METABOLICAS = ["Diabetes", "Hipertensão", "Dislipidemia", "Hipotireoidismo", "Hipertireoidismo", "SOP"];

export const glp1Alertas = (a: Anamnese | undefined) => {
  if (!a) return [];
  const alertas: string[] = [];
  if (a.pancreatite) alertas.push("Histórico de pancreatite");
  if (a.gastroparesia) alertas.push("Gastroparesia");
  if (a.historicoTireoide) alertas.push("Histórico de doença tireoidiana / CMT");
  if (a.gestanteLactante) alertas.push("Gestante ou lactante");
  return alertas;
};

const imcClass = (imc: number) =>
  imc < 18.5 ? { label: "Abaixo do peso", tone: "amber" as const }
  : imc < 25 ? { label: "Normal", tone: "leaf" as const }
  : imc < 30 ? { label: "Sobrepeso", tone: "amber" as const }
  : imc < 35 ? { label: "Obesidade I", tone: "coral" as const }
  : imc < 40 ? { label: "Obesidade II", tone: "coral" as const }
  : { label: "Obesidade III", tone: "coral" as const };

export function Prontuario({ cliente }: { cliente: Client }) {
  const [secao, setSecao] = useState<Secao>("anamnese");
  const { state } = useStore();

  const anamnese = useMemo(
    () => state.anamneses.filter((a) => a.pacienteId === cliente.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
    [state.anamneses, cliente.id],
  );
  const alertas = glp1Alertas(anamnese);

  return (
    <div className="space-y-4">
      {/* alerta crítico GLP-1 */}
      {alertas.length > 0 && (
        <div className="anim-rise flex items-start gap-3 rounded-xl border border-coral-100 bg-coral-50 px-4 py-3">
          <IcAlert size={18} className="mt-0.5 shrink-0 text-coral-600" />
          <div>
            <p className="text-[13px] font-bold text-coral-700">Alerta crítico para GLP-1 / Tirzepatida</p>
            <p className="mt-0.5 text-[12px] leading-snug text-coral-600">{alertas.join(" · ")}. Reavalie a prescrição antes de qualquer aplicação.</p>
          </div>
        </div>
      )}

      {/* navegação do prontuário */}
      <div className="anim-rise flex gap-1 overflow-x-auto rounded-xl border border-line bg-paper p-1" style={{ animationDelay: "40ms" }}>
        {SECOES.map((s) => {
          const Icon = s.icon;
          const ativo = secao === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSecao(s.key)}
              className={`btn-press flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-bold transition-colors ${
                ativo ? "bg-pine-900 text-white shadow-sm" : "text-ink-soft hover:bg-mist hover:text-ink"
              }`}
            >
              <Icon size={14} className={ativo ? "text-lime-400" : ""} />
              {s.label}
            </button>
          );
        })}
      </div>

      <div key={secao} className="anim-rise" style={{ animationDelay: "80ms" }}>
        {secao === "anamnese" && <AnamneseForm cliente={cliente} existente={anamnese} />}
        {secao === "fisica" && <AvaliacaoFisica cliente={cliente} />}
        {secao === "tcle" && <Tcle cliente={cliente} />}
        {secao === "aplicacao" && <RegistroAplicacao cliente={cliente} />}
        {secao === "timeline" && <Timeline cliente={cliente} />}
      </div>
    </div>
  );
}

/* ---------- Switch ---------- */
function Switch({ on, onChange, danger }: { on: boolean; onChange: (v: boolean) => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`btn-press relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? (danger ? "bg-coral-600" : "bg-leaf-600") : "bg-line"}`}
      aria-pressed={on}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function CheckGroup({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={`btn-press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
              on ? "border-leaf-200 bg-leaf-100 text-leaf-700" : "border-line bg-paper text-ink-soft hover:border-leaf-200"
            }`}
          >
            {on && <IcCheck size={11} />} {o}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Resumo da anamnese (modo leitura) ---------- */
function AnamneseResumo({ a, alertas, onEditar, onExcluir }: { a: Anamnese; alertas: boolean; onEditar: () => void; onExcluir: () => void }) {
  const gastroAtivos = [
    a.historicoGastrointestinal.refluxo && "Refluxo",
    a.historicoGastrointestinal.nauseaFrequente && "Náusea frequente",
    a.historicoGastrointestinal.cirurgiaBariatrica && "Cirurgia bariátrica",
    a.historicoGastrointestinal.constipacao && "Constipação",
    a.historicoGastrointestinal.outra || null,
  ].filter(Boolean) as string[];

  const Linha = ({ rotulo, children }: { rotulo: string; children: React.ReactNode }) => (
    <div className="flex flex-wrap items-start justify-between gap-2 py-2.5">
      <span className="eyebrow mt-0.5 shrink-0">{rotulo}</span>
      <span className="min-w-0 flex-1 text-right text-[13px] font-semibold text-ink">{children}</span>
    </div>
  );
  const SimNao = ({ v, danger }: { v: boolean; danger?: boolean }) =>
    v ? <Badge tone={danger ? "coral" : "amber"}>sim</Badge> : <Badge tone="leaf">não</Badge>;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3 sm:px-5">
        <div>
          <h3 className="font-display text-[16px] font-bold tracking-tight">Anamnese para injetáveis</h3>
          <p className="text-[11.5px] text-ink-faint">Registrada em {fmtMed(a.createdAt)} · revise antes de gerar o termo</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={onEditar} className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-bold text-ink-soft hover:border-leaf-200 hover:text-leaf-700">
            <IcPencil size={13} /> Editar
          </button>
          <button onClick={onExcluir} className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-coral-100 bg-coral-50 px-3.5 py-2 text-[12.5px] font-bold text-coral-600 hover:bg-coral-100">
            <IcTrash size={13} /> Excluir
          </button>
        </div>
      </div>

      {alertas && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-xl border border-coral-100 bg-coral-50 px-3.5 py-2.5 sm:mx-5">
          <IcAlert size={15} className="shrink-0 text-coral-600" />
          <p className="text-[12px] font-semibold text-coral-700">Há respostas que contraindicam ou exigem cautela com GLP-1. Confira antes de aplicar.</p>
        </div>
      )}

      <div className="divide-y divide-line-soft px-4 sm:px-5">
        <Linha rotulo="Alergias">
          {a.alergias.length > 0 || a.alergiasOutras ? (
            <span className="flex flex-wrap justify-end gap-1.5">
              {a.alergias.map((x) => <Badge key={x} tone="coral">{x}</Badge>)}
              {a.alergiasOutras && <Badge tone="coral">{a.alergiasOutras}</Badge>}
            </span>
          ) : (
            <span className="text-ink-faint">Nenhuma informada</span>
          )}
        </Linha>
        <Linha rotulo="Condições metabólicas">
          {a.condicoesMetabolicas.length > 0 ? (
            <span className="flex flex-wrap justify-end gap-1.5">{a.condicoesMetabolicas.map((x) => <Badge key={x} tone="amber">{x}</Badge>)}</span>
          ) : (
            <span className="text-ink-faint">Nenhuma</span>
          )}
        </Linha>
        <Linha rotulo="Pancreatite"><SimNao v={a.pancreatite} danger /></Linha>
        <Linha rotulo="Gastroparesia"><SimNao v={a.gastroparesia} danger /></Linha>
        <Linha rotulo="Doença tireoidiana / CMT"><SimNao v={a.historicoTireoide} danger /></Linha>
        <Linha rotulo="Histórico gastrointestinal">
          {gastroAtivos.length > 0 ? gastroAtivos.join(" · ") : <span className="text-ink-faint">Nada a relatar</span>}
        </Linha>
        <Linha rotulo="Medicamentos em uso">
          {a.medicamentosEmUso ? <span className="whitespace-pre-line">{a.medicamentosEmUso}</span> : <span className="text-ink-faint">Nenhum</span>}
        </Linha>
        <Linha rotulo="Gestante / lactante"><SimNao v={a.gestanteLactante} danger /></Linha>
        {a.outrasCondicoes && <Linha rotulo="Outras condições"><span className="whitespace-pre-line">{a.outrasCondicoes}</span></Linha>}
      </div>
    </div>
  );
}

/* ---------- Anamnese ---------- */
function AnamneseForm({ cliente, existente }: { cliente: Client; existente?: Anamnese }) {
  const { salvarAnamnese, excluirAnamnese } = useStore();
  const ui = useUi();
  const { push } = useToast();
  const [editando, setEditando] = useState(!existente);

  const [alergias, setAlergias] = useState<string[]>(existente?.alergias ?? []);
  const [alergiasOutras, setAlergiasOutras] = useState(existente?.alergiasOutras ?? "");
  const [metabolicas, setMetabolicas] = useState<string[]>(existente?.condicoesMetabolicas ?? []);
  const [pancreatite, setPancreatite] = useState(existente?.pancreatite ?? false);
  const [gastroparesia, setGastroparesia] = useState(existente?.gastroparesia ?? false);
  const [tireoide, setTireoide] = useState(existente?.historicoTireoide ?? false);
  const [gastro, setGastro] = useState(existente?.historicoGastrointestinal ?? { refluxo: false, nauseaFrequente: false, cirurgiaBariatrica: false, constipacao: false, outra: "" });
  const [medicamentos, setMedicamentos] = useState(existente?.medicamentosEmUso ?? "");
  const [gestante, setGestante] = useState(existente?.gestanteLactante ?? false);
  const [outras, setOutras] = useState(existente?.outrasCondicoes ?? "");

  const salvar = () => {
    salvarAnamnese({
      id: existente?.id,
      pacienteId: cliente.id,
      alergias, alergiasOutras, condicoesMetabolicas: metabolicas,
      pancreatite, gastroparesia, historicoTireoide: tireoide,
      historicoGastrointestinal: gastro, medicamentosEmUso: medicamentos,
      gestanteLactante: gestante, outrasCondicoes: outras,
    });
    push("success", "Anamnese salva no prontuário.");
  };

  const alerta = pancreatite || gastroparesia || tireoide || gestante;

  /* modo leitura: resumo com Editar / Excluir antes de gerar o termo */
  if (existente && !editando) {
    const pedirExclusao = () =>
      ui.confirm({
        title: "Excluir anamnese",
        message: <>Excluir a anamnese de <strong className="text-ink">{cliente.name}</strong>? O registro será removido do prontuário.</>,
        confirmLabel: "Excluir",
        danger: true,
        action: () => {
          excluirAnamnese(existente.id);
          push("success", "Anamnese excluída.");
        },
      });
    return <AnamneseResumo a={existente} alertas={alerta} onEditar={() => setEditando(true)} onExcluir={pedirExclusao} />;
  }

  return (
    <div className="card space-y-5 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-[16px] font-bold tracking-tight">Anamnese para injetáveis</h3>
          <p className="text-[11.5px] text-ink-faint">
            {existente ? <>Editando — registrada em {fmtMed(existente.createdAt)}</> : "Ainda não preenchida"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {existente && (
            <button onClick={() => setEditando(false)} className="btn-press rounded-xl border border-line px-3.5 py-2.5 text-[13px] font-bold text-ink-soft hover:text-ink">
              Cancelar
            </button>
          )}
          <button onClick={salvar} className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-leaf-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-leaf-700">
            <IcCheck size={15} /> {existente ? "Salvar alterações" : "Salvar anamnese"}
          </button>
        </div>
      </div>

      {alerta && (
        <div className="flex items-center gap-2 rounded-xl border border-coral-100 bg-coral-50 px-3.5 py-2.5">
          <IcAlert size={15} className="shrink-0 text-coral-600" />
          <p className="text-[12px] font-semibold text-coral-700">Há respostas que contraindicam ou exigem cautela com GLP-1. Confira antes de aplicar.</p>
        </div>
      )}

      <Field label="Alergias medicamentosas / conservantes">
        <CheckGroup options={ALERGIAS_COMUNS} value={alergias} onChange={setAlergias} />
        <input className="field-input mt-2" placeholder="Outras alergias…" value={alergiasOutras} onChange={(e) => setAlergiasOutras(e.target.value)} />
      </Field>

      <Field label="Condições metabólicas">
        <CheckGroup options={CONDICOES_METABOLICAS} value={metabolicas} onChange={setMetabolicas} />
      </Field>

      <div className="rounded-xl border border-line bg-mist/40 p-3.5">
        <p className="eyebrow mb-3 flex items-center gap-1.5 text-coral-600"><IcShieldAlert size={13} /> Triagem crítica GLP-1 / Tirzepatida</p>
        <div className="space-y-2.5">
          {[
            { label: "Histórico de pancreatite", v: pancreatite, set: setPancreatite },
            { label: "Gastroparesia / esvaziamento gástrico lento", v: gastroparesia, set: setGastroparesia },
            { label: "Histórico de doença tireoidiana ou CMT", v: tireoide, set: setTireoide },
          ].map((t) => (
            <div key={t.label} className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-ink-soft">{t.label}</span>
              <Switch on={t.v} onChange={t.set} danger />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-mist/40 p-3.5">
        <p className="eyebrow mb-3">Histórico gastrointestinal</p>
        <div className="space-y-2.5">
          {[
            { label: "Refluxo", k: "refluxo" as const },
            { label: "Náusea frequente", k: "nauseaFrequente" as const },
            { label: "Cirurgia bariátrica", k: "cirurgiaBariatrica" as const },
            { label: "Constipação", k: "constipacao" as const },
          ].map((t) => (
            <div key={t.k} className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-ink-soft">{t.label}</span>
              <Switch on={gastro[t.k]} onChange={(v) => setGastro((g) => ({ ...g, [t.k]: v }))} />
            </div>
          ))}
          <input className="field-input" placeholder="Outro histórico gastrointestinal…" value={gastro.outra} onChange={(e) => setGastro((g) => ({ ...g, outra: e.target.value }))} />
        </div>
      </div>

      <Field label="Medicamentos em uso">
        <textarea className="field-input min-h-[70px] resize-y" placeholder="Liste os medicamentos em uso…" value={medicamentos} onChange={(e) => setMedicamentos(e.target.value)} />
      </Field>

      <div className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 ${gestante ? "border-coral-100 bg-coral-50" : "border-line bg-mist/40"}`}>
        <div>
          <p className={`text-[13px] font-bold ${gestante ? "text-coral-700" : "text-ink"}`}>Gestante ou lactante</p>
          <p className="text-[11px] text-ink-faint">Contraindicação absoluta para a maioria dos injetáveis estéticos.</p>
        </div>
        <Switch on={gestante} onChange={setGestante} danger />
      </div>

      <Field label="Outras condições / observações">
        <textarea className="field-input min-h-[60px] resize-y" value={outras} onChange={(e) => setOutras(e.target.value)} />
      </Field>
    </div>
  );
}

/* ---------- Avaliação física ---------- */
function AvaliacaoFisica({ cliente }: { cliente: Client }) {
  const { state, addAvaliacao, excluirAvaliacao } = useStore();
  const ui = useUi();
  const { push } = useToast();

  const pedirExclusaoAvaliacao = (id: string, quando: string) =>
    ui.confirm({
      title: "Excluir avaliação física",
      message: <>Remover a avaliação de <strong className="text-ink">{fmtMed(quando)}</strong> do histórico antropométrico?</>,
      confirmLabel: "Excluir",
      danger: true,
      action: () => {
        excluirAvaliacao(id);
        push("success", "Avaliação excluída.");
      },
    });

  const avaliacoes = useMemo(
    () => state.avaliacoesFisicas.filter((a) => a.pacienteId === cliente.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.avaliacoesFisicas, cliente.id],
  );
  const ultima = avaliacoes[0];

  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [circ, setCirc] = useState("");
  const [prega, setPrega] = useState("");

  const pesoNum = parseFloat(peso.replace(",", "."));
  const alturaNum = parseFloat(altura.replace(",", "."));
  const imcPreview = pesoNum > 0 && alturaNum > 0 ? pesoNum / (alturaNum * alturaNum) : null;

  const salvar = () => {
    if (!pesoNum || !alturaNum) return push("error", "Informe peso e altura para calcular o IMC.");
    addAvaliacao({
      pacienteId: cliente.id,
      peso: pesoNum,
      alturaM: alturaNum,
      circAbdominalCm: circ ? parseFloat(circ.replace(",", ".")) : undefined,
      pregaCutaneaMm: prega ? parseFloat(prega.replace(",", ".")) : undefined,
    });
    push("success", "Avaliação física registrada.");
    setPeso(""); setAltura(""); setCirc(""); setPrega("");
  };

  const delta = avaliacoes.length > 1 ? avaliacoes[0].peso - avaliacoes[avaliacoes.length - 1].peso : null;

  return (
    <div className="space-y-4">
      <div className="card space-y-4 p-4 sm:p-5">
        <h3 className="font-display text-[16px] font-bold tracking-tight">Nova avaliação física</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Peso (kg)"><input className="field-input num" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="72,5" /></Field>
          <Field label="Altura (m)"><input className="field-input num" inputMode="decimal" value={altura} onChange={(e) => setAltura(e.target.value)} placeholder="1,68" /></Field>
          <Field label="Circ. abdominal (cm)"><input className="field-input num" inputMode="decimal" value={circ} onChange={(e) => setCirc(e.target.value)} placeholder="88" /></Field>
          <Field label="Prega cutânea (mm)"><input className="field-input num" inputMode="decimal" value={prega} onChange={(e) => setPrega(e.target.value)} placeholder="24" /></Field>
        </div>

        {imcPreview != null && (
          <div className="flex items-center gap-4 rounded-xl border border-leaf-200 bg-leaf-50 px-4 py-3">
            <div>
              <p className="eyebrow">IMC calculado</p>
              <p className="num font-display text-[26px] font-bold text-ink">{imcPreview.toFixed(1)}</p>
            </div>
            <Badge tone={imcClass(imcPreview).tone}>{imcClass(imcPreview).label}</Badge>
            <div className="ml-auto hidden flex-1 sm:block">
              <div className="relative h-2 overflow-hidden rounded-full bg-gradient-to-r from-amber-400 via-leaf-500 via-40% to-coral-600" />
              <div className="relative mt-1 h-3">
                <span
                  className="absolute top-0 h-3 w-[3px] -translate-x-1/2 rounded bg-pine-900 transition-all duration-500"
                  style={{ left: `${Math.min(100, Math.max(0, ((imcPreview - 15) / 25) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        )}

        <button onClick={salvar} className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-leaf-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-leaf-700">
          <IcCheck size={15} /> Salvar avaliação
        </button>
      </div>

      {/* histórico antropométrico */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <h3 className="font-display text-[14px] font-bold tracking-tight">Evolução antropométrica</h3>
          {delta != null && (
            <Badge tone={delta <= 0 ? "leaf" : "amber"}>{delta > 0 ? "+" : ""}{delta.toFixed(1)} kg desde o início</Badge>
          )}
        </div>
        {avaliacoes.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12.5px] text-ink-faint">Nenhuma avaliação registrada.</p>
        ) : (
          <ul>
            {avaliacoes.map((a) => {
              const c = imcClass(a.imc);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line-soft px-4 py-2.5 text-[12.5px] last:border-0 hover:bg-leaf-50/40">
                  <span className="num w-14 shrink-0 font-semibold text-ink-faint">{fmtShort(a.createdAt)}</span>
                  <span className="num font-bold">{a.peso.toFixed(1)} kg</span>
                  <span className="num text-ink-soft">{a.alturaM.toFixed(2)} m</span>
                  <span className="num text-ink-soft">IMC <strong className="text-ink">{a.imc.toFixed(1)}</strong></span>
                  <Badge tone={c.tone}>{c.label}</Badge>
                  {a.circAbdominalCm != null && <span className="num text-ink-soft">abd {a.circAbdominalCm} cm</span>}
                  {a.pregaCutaneaMm != null && <span className="num text-ink-soft">prega {a.pregaCutaneaMm} mm</span>}
                  <button
                    onClick={() => pedirExclusaoAvaliacao(a.id, a.createdAt)}
                    className="btn-press ml-auto rounded-lg p-1.5 text-ink-faint hover:bg-coral-50 hover:text-coral-600"
                    aria-label="Excluir avaliação"
                    title="Excluir avaliação"
                  >
                    <IcTrash size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
