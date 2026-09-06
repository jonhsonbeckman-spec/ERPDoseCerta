import { useEffect, useRef, useState } from "react";
import type { Client, TermoConsentimento } from "../../types";
import { useStore } from "../../lib/store";
import { Badge, Field, useToast } from "../../components/ui";
import { useUi } from "../../components/modals";
import { IcCheck, IcDownload, IcFileText, IcPlus, IcShieldAlert, IcTrash } from "../../components/icons";
import { fmtLong, fmtMed, todayISO } from "../../lib/utils";

const TIPOS_PROTOCOLO = [
  "Tirzepatida (Mounjaro)",
  "Soroterapia",
  "Peptídeos",
  "Vitaminas injetáveis",
  "Enzimas redutoras",
  "Avaliação inicial",
];

const STATUS_META: Record<TermoConsentimento["status"], { label: string; tone: "neutral" | "leaf" | "amber" }> = {
  pendente_assinatura: { label: "pendente de assinatura", tone: "amber" },
  assinado_local: { label: "assinado no app", tone: "leaf" },
  assinado_govbr: { label: "assinado Gov.br", tone: "leaf" },
};

export function Tcle({ cliente }: { cliente: Client }) {
  const { state, criarTermo, excluirTermo } = useStore();
  const { push } = useToast();
  const ui = useUi();
  const [tipo, setTipo] = useState(TIPOS_PROTOCOLO[0]);
  const [imprimir, setImprimir] = useState<TermoConsentimento | null>(null);

  const termos = state.termos.filter((t) => t.pacienteId === cliente.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const novo = () => {
    criarTermo(cliente.id, tipo);
    push("success", `TCLE de "${tipo}" gerado. Imprima, colete a assinatura ou envie ao Gov.br.`);
  };

  useEffect(() => {
    if (!imprimir) return;
    const t = setTimeout(() => {
      window.print();
      setImprimir(null);
    }, 250);
    return () => clearTimeout(t);
  }, [imprimir]);

  return (
    <div className="space-y-4">
      {/* gerar novo termo */}
      <div className="card flex flex-wrap items-end gap-3 p-4 sm:p-5">
        <Field label="Tipo de protocolo" className="min-w-[220px] flex-1">
          <select className="field-input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_PROTOCOLO.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <button onClick={novo} className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-pine-900 px-4 py-3 text-[13px] font-bold text-white hover:bg-pine-800">
          <IcPlus size={15} /> Gerar TCLE
        </button>
      </div>

      {/* área de impressão (oculta na tela, visível no papel) */}
      {imprimir && <TermoPrint termo={imprimir} cliente={cliente} />}

      {/* lista de termos */}
      {termos.length === 0 ? (
        <div className="card p-6 text-center">
          <IcFileText size={22} className="mx-auto text-ink-faint" />
          <p className="mt-2 text-[13.5px] font-bold">Nenhum termo de consentimento</p>
          <p className="mt-1 text-[12px] text-ink-faint">Gere um TCLE antes da primeira aplicação do protocolo.</p>
        </div>
      ) : (
        termos.map((t) => (
          <TermoCard key={t.id} termo={t} cliente={cliente} onImprimir={() => setImprimir(t)} onExcluir={() =>
            ui.confirm({
              title: "Excluir TCLE",
              message: <>Excluir o termo de <strong className="text-ink">{t.tipoProtocolo}</strong>? Essa ação não pode ser desfeita.</>,
              confirmLabel: "Excluir", danger: true,
              action: () => { excluirTermo(t.id); push("success", "TCLE excluído."); },
            })
          } />
        ))
      )}
    </div>
  );
}

/* ---------- card de termo com ações ---------- */
function TermoCard({ termo, cliente, onImprimir, onExcluir }: {
  termo: TermoConsentimento;
  cliente: Client;
  onImprimir: () => void;
  onExcluir: () => void;
}) {
  const { assinarLocal, anexarTermoGovBr } = useStore();
  const { push } = useToast();
  const [assinando, setAssinando] = useState(false);
  const [govbr, setGovbr] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const meta = STATUS_META[termo.status];

  const onFile = (f: File) => {
    if (f.type !== "application/pdf") return push("error", "Envie um arquivo PDF assinado.");
    if (f.size > 4 * 1024 * 1024) return push("error", "Arquivo muito grande (máx. 4 MB).");
    const reader = new FileReader();
    reader.onload = () => {
      anexarTermoGovBr(termo.id, { nome: f.name, tipo: f.type, tamanho: f.size, dataUrl: String(reader.result) });
      push("success", "Termo assinado Gov.br anexado e status atualizado.");
      setGovbr(false);
    };
    reader.readAsDataURL(f);
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pine-900 text-lime-400"><IcShieldAlert size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-bold">{termo.tipoProtocolo}</p>
          <p className="num text-[11px] text-ink-faint">gerado em {fmtMed(termo.createdAt)}{termo.assinadoEm ? ` · assinado em ${fmtMed(termo.assinadoEm)}` : ""}</p>
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <button onClick={onExcluir} className="btn-press rounded-lg p-1.5 text-ink-faint hover:bg-coral-50 hover:text-coral-600" aria-label="Excluir termo"><IcTrash size={14} /></button>
      </div>

      {/* assinatura coletada */}
      {termo.assinaturaLocal && (
        <div className="border-b border-line-soft bg-mist/40 px-4 py-3">
          <p className="eyebrow mb-1.5">Assinatura coletada no app</p>
          <img src={termo.assinaturaLocal} alt="Assinatura do paciente" className="h-16 rounded-lg border border-line bg-white object-contain px-2" />
        </div>
      )}

      {/* arquivo Gov.br anexado */}
      {termo.arquivoAssinadoGovBr && (
        <div className="flex items-center gap-3 border-b border-line-soft bg-leaf-50/60 px-4 py-3">
          <IcFileText size={16} className="shrink-0 text-leaf-700" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-bold text-leaf-700">{termo.arquivoAssinadoGovBr.nome}</p>
            <p className="num text-[10.5px] text-ink-faint">{(termo.arquivoAssinadoGovBr.tamanho / 1024).toFixed(0)} KB</p>
          </div>
          <a href={termo.arquivoAssinadoGovBr.dataUrl} download={termo.arquivoAssinadoGovBr.nome} className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-leaf-200 bg-paper px-3 py-1.5 text-[11.5px] font-bold text-leaf-700 hover:bg-leaf-100">
            <IcDownload size={12} /> Baixar
          </a>
        </div>
      )}

      {/* ações */}
      <div className="flex flex-wrap gap-2 px-4 py-3">
        <button onClick={onImprimir} className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12px] font-bold text-ink-soft hover:border-leaf-200 hover:text-leaf-700">
          <IcDownload size={13} /> Baixar minuta (PDF)
        </button>
        {termo.status === "pendente_assinatura" && (
          <>
            <button onClick={() => setAssinando((v) => !v)} className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12px] font-bold text-ink-soft hover:border-leaf-200 hover:text-leaf-700">
              <IcCheck size={13} /> Assinar no app
            </button>
            <button onClick={() => setGovbr((v) => !v)} className="btn-press inline-flex items-center gap-1.5 rounded-lg bg-pine-900 px-3 py-2 text-[12px] font-bold text-white hover:bg-pine-800">
              <IcShieldAlert size={13} /> Assinar via Gov.br
            </button>
          </>
        )}
      </div>

      {/* assinatura local (canvas) */}
      {assinando && (
        <AssinaturaPad
          onSalvar={(dataUrl) => { assinarLocal(termo.id, dataUrl); setAssinando(false); push("success", "Assinatura coletada — termo marcado como assinado no app."); }}
          onCancelar={() => setAssinando(false)}
        />
      )}

      {/* fluxo Gov.br */}
      {govbr && (
        <div className="space-y-3 border-t border-line-soft bg-amber-50/50 px-4 py-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
            <p className="text-[12.5px] font-bold text-amber-800">Como assinar pelo Gov.br</p>
            <ol className="mt-1.5 list-inside list-decimal space-y-1 text-[11.5px] leading-snug text-amber-800/90">
              <li>Baixe a minuta (PDF) acima.</li>
              <li>Acesse o assinador oficial do governo e envie o PDF.</li>
              <li>Baixe o PDF assinado e anexe abaixo.</li>
            </ol>
            <a href="https://assinador.iti.br" target="_blank" rel="noreferrer" className="btn-press mt-2 inline-flex items-center gap-1.5 rounded-lg bg-pine-900 px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-pine-800">
              Abrir assinador.iti.br
            </a>
          </div>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-dashed border-amber-300 bg-paper px-4 py-3 text-[12.5px] font-bold text-amber-800 hover:bg-amber-100">
            <IcDownload size={14} /> Anexar PDF assinado Gov.br…
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- canvas de assinatura ---------- */
function AssinaturaPad({ onSalvar, onCancelar }: { onSalvar: (dataUrl: string) => void; onCancelar: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [vazio, setVazio] = useState(true);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#14251c";
    }
  }, []);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    setVazio(false);
    canvasRef.current!.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const end = () => { drawing.current = false; };

  const limpar = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    setVazio(true);
  };

  return (
    <div className="space-y-2.5 border-t border-line-soft px-4 py-4">
      <p className="eyebrow">Assine no espaço abaixo (dedo ou caneta)</p>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="h-32 w-full touch-none rounded-xl border border-dashed border-line bg-white"
      />
      <div className="flex gap-2">
        <button onClick={limpar} className="btn-press rounded-lg border border-line px-3.5 py-2 text-[12.5px] font-bold text-ink-soft hover:text-ink">Limpar</button>
        <button onClick={onCancelar} className="btn-press rounded-lg border border-line px-3.5 py-2 text-[12.5px] font-bold text-ink-soft hover:text-ink">Cancelar</button>
        <button
          onClick={() => onSalvar(canvasRef.current!.toDataURL("image/png"))}
          disabled={vazio}
          className="btn-press ml-auto inline-flex items-center gap-1.5 rounded-lg bg-leaf-600 px-4 py-2 text-[12.5px] font-bold text-white hover:bg-leaf-700 disabled:opacity-50"
        >
          <IcCheck size={14} /> Confirmar assinatura
        </button>
      </div>
    </div>
  );
}

/* ---------- minuta imprimível ---------- */
function TermoPrint({ termo, cliente }: { termo: TermoConsentimento; cliente: Client }) {
  return (
    <div className="print-area hidden">
      <div style={{ fontFamily: "Georgia, serif", color: "#14251c", padding: "8px", lineHeight: 1.55, fontSize: "13px" }}>
        <h1 style={{ fontSize: "18px", textAlign: "center", letterSpacing: "0.04em", margin: "0 0 2px" }}>TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO</h1>
        <p style={{ textAlign: "center", fontSize: "12px", margin: "0 0 18px" }}>{termo.tipoProtocolo}</p>

        <p><strong>Paciente:</strong> {cliente.name}{cliente.cpf ? ` — CPF ${cliente.cpf}` : ""}{cliente.dataNascimento ? ` — nascido(a) em ${fmtLong(cliente.dataNascimento)}` : ""}</p>
        <p style={{ marginTop: 4 }}><strong>Protocolo:</strong> {termo.tipoProtocolo}</p>
        <p style={{ marginTop: 4 }}><strong>Data de emissão:</strong> {fmtLong(termo.createdAt)}</p>

        <p style={{ marginTop: 16 }}>
          Declaro que fui informado(a), em linguagem clara, sobre o procedimento proposto, seus objetivos, benefícios
          esperados, riscos, efeitos adversos possíveis e alternativas de tratamento. Tive a oportunidade de fazer
          perguntas, que foram respondidas de forma satisfatória.
        </p>
        <p style={{ marginTop: 10 }}>
          Estou ciente de que resultados podem variar de pessoa para pessoa e de que a presença de condições como
          gestação, lactação, pancreatite, gastroparesia ou doença tireoidiana deve ser comunicada imediatamente ao
          profissional, podendo contraindicar o procedimento.
        </p>
        <p style={{ marginTop: 10 }}>
          Autorizo o armazenamento dos meus dados de saúde para fins de prontuário, nos termos da LGPD (Lei 13.709/2018),
          garantindo-se a confidencialidade das informações.
        </p>
        <p style={{ marginTop: 10 }}>
          Declaro, por fim, que meu consentimento é livre, voluntário e que posso revogá-lo a qualquer momento.
        </p>

        <div style={{ display: "flex", gap: "32px", marginTop: "56px" }}>
          <div style={{ flex: 1, borderTop: "1px solid #14251c", paddingTop: "6px", fontSize: "11px" }}>Assinatura do(a) paciente</div>
          <div style={{ flex: 1, borderTop: "1px solid #14251c", paddingTop: "6px", fontSize: "11px" }}>Profissional responsável</div>
        </div>
      </div>
    </div>
  );
}
