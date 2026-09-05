import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Client, PayMethod, Transaction } from "../types";
import { useStore } from "../lib/store";
import {
  EXPENSE_CATS, METHOD_LABEL, REVENUE_CATS, brl, fmtQtd, fmtShort, nextDate, onlyDigits, productName, todayISO, uid,
} from "../lib/utils";
import { fefoSort, loteSaldo, reconstituivel, round2 } from "../lib/domain/engine";
import { kitCheck } from "../lib/domain/kits";
import { Badge, ConfirmDialog, Field, Modal, useToast } from "./ui";
import { IcAlert, IcCheck } from "./icons";

/* ---------- provider de UI ---------- */
interface TxEdit extends Omit<Transaction, "id"> { id?: string }

interface UiApi {
  confirm(args: { title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; action: () => void }): void;
  openTransaction(tx?: TxEdit): void;
  openApplication(clientId?: string, idAlocacao?: string): void;
  openClientModal(c?: Client): void;
  openAgendar(clientId: string, alocId?: string): void;
  openQuarentena(idLote: string): void;
  openDescarte(idLote: string): void;
  openReconstituir(idLote: string): void;
  openAjuste(idLote: string): void;
  openAplicarDose(idProtocolo: string, idDose: string): void;
}

const UiCtx = createContext<UiApi | null>(null);
export const useUi = () => {
  const c = useContext(UiCtx);
  if (!c) throw new Error("useUi fora do UiProvider");
  return c;
};

export function UiProvider({ children }: { children: ReactNode }) {
  const [confirmArgs, setConfirmArgs] = useState<Parameters<UiApi["confirm"]>[0] | null>(null);
  const [tx, setTx] = useState<TxEdit | null>(null);
  const [app, setApp] = useState<{ open: boolean; clientId?: string; idAlocacao?: string }>({ open: false });
  const [client, setClient] = useState<Client | "new" | null>(null);
  const [agendar, setAgendar] = useState<{ clienteId: string; alocId?: string } | null>(null);
  const [quar, setQuar] = useState<string | null>(null);
  const [desc, setDesc] = useState<string | null>(null);
  const [reconst, setReconst] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState<string | null>(null);
  const [dose, setDose] = useState<{ idProtocolo: string; idDose: string } | null>(null);

  const { state, quarentena, descartar } = useStore();
  const { push } = useToast();

  const api: UiApi = {
    confirm: setConfirmArgs,
    openTransaction: (t) => setTx(t ?? ({ type: "receita" } as TxEdit)),
    openApplication: (clientId, idAlocacao) => setApp({ open: true, clientId, idAlocacao }),
    openClientModal: (c) => setClient(c ?? "new"),
    openAgendar: (clienteId, alocId) => setAgendar({ clienteId, alocId }),
    openQuarentena: setQuar,
    openDescarte: setDesc,
    openReconstituir: setReconst,
    openAjuste: setAjuste,
    openAplicarDose: (idProtocolo, idDose) => setDose({ idProtocolo, idDose }),
  };

  const lote = (id: string | null) => (id ? state.lotes.find((l) => l.id === id) : undefined);

  return (
    <UiCtx.Provider value={api}>
      {children}
      <ConfirmDialog
        open={!!confirmArgs}
        title={confirmArgs?.title ?? ""}
        message={confirmArgs?.message ?? ""}
        confirmLabel={confirmArgs?.confirmLabel}
        danger={confirmArgs?.danger}
        onClose={() => setConfirmArgs(null)}
        onConfirm={() => confirmArgs?.action()}
      />
      <TransactionModal tx={tx} onClose={() => setTx(null)} />
      <ApplicationModal open={app.open} clientId={app.clientId} idAlocacao={app.idAlocacao} onClose={() => setApp({ open: false })} />
      <ClientModal client={client} onClose={() => setClient(null)} />
      <AgendarModal alvo={agendar} onClose={() => setAgendar(null)} />
      <QuarentenaModal idLote={quar} onClose={() => setQuar(null)} />
      <ReconstituirModal idLote={reconst} onClose={() => setReconst(null)} />
      <AjusteModal idLote={ajuste} onClose={() => setAjuste(null)} />
      <AplicarDoseModal dose={dose} onClose={() => setDose(null)} />
      <ConfirmDialog
        open={!!desc}
        title="Descartar lote"
        message={
          <>
            Descartar o lote <strong className="text-ink">{lote(desc)?.numeroLote}</strong>? O saldo restante sai como PERDA no kardex — o PMP não é alterado.
          </>
        }
        confirmLabel="Descartar"
        danger
        onClose={() => setDesc(null)}
        onConfirm={() => {
          if (!desc) return;
          const r = descartar(desc, "Descarte manual via painel");
          push(r.ok ? "success" : "error", r.ok ? "Lote descartado e perda registrada." : r.error);
        }}
      />
    </UiCtx.Provider>
  );
}

/* ---------- Lançamento financeiro ---------- */
function TransactionModal({ tx, onClose }: { tx: TxEdit | null; onClose: () => void }) {
  const { addTransaction, updateTransaction } = useStore();
  const { push } = useToast();
  const [type, setType] = useState<"receita" | "despesa">("receita");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState(REVENUE_CATS[0]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PayMethod>("pix");
  const [err, setErr] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (tx && loadedFor !== (tx.id ?? "new")) {
    setType(tx.type ?? "receita");
    setDesc(tx.description ?? "");
    setCat(tx.category ?? (tx.type === "despesa" ? EXPENSE_CATS[0] : REVENUE_CATS[0]));
    setAmount(tx.amount ? String(tx.amount) : "");
    setDate(tx.date ?? todayISO());
    setMethod(tx.method ?? "pix");
    setLoadedFor(tx.id ?? "new");
    setErr("");
  }
  if (!tx && loadedFor !== null) setLoadedFor(null);

  const cats = type === "receita" ? REVENUE_CATS : EXPENSE_CATS;
  const valor = Math.round((parseFloat(amount.replace(",", ".")) || 0) * 100) / 100;

  const salvar = () => {
    if (!desc.trim()) return setErr("Descreva o lançamento.");
    if (valor <= 0) return setErr("Informe um valor maior que zero.");
    if (!date) return setErr("Informe a data.");
    const payload = { type, description: desc.trim(), category: cat, amount: valor, date, method };
    if (tx?.id) {
      updateTransaction(tx.id, payload);
      push("success", "Lançamento atualizado.");
    } else {
      addTransaction(payload);
      push("success", `${type === "receita" ? "Receita" : "Despesa"} de ${brl(valor)} registrada.`);
    }
    setLoadedFor(null);
    onClose();
  };

  return (
    <Modal open={!!tx} onClose={() => { setLoadedFor(null); onClose(); }} title={tx?.id ? "Editar lançamento" : "Novo lançamento"} subtitle="Alimenta o caixa, a DRE e o teto do MEI.">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-mist/70 p-1">
        {(["receita", "despesa"] as const).map((t) => (
          <button key={t} onClick={() => { setType(t); setCat(t === "receita" ? REVENUE_CATS[0] : EXPENSE_CATS[0]); }}
            className={`btn-press rounded-lg py-2 text-[13px] font-bold capitalize transition-colors ${type === t ? (t === "receita" ? "bg-leaf-600 text-white" : "bg-coral-600 text-white") : "text-ink-soft"}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        <Field label="Descrição">
          <input className="field-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: Aplicação Mounjaro — Marina" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria">
            <select className="field-input" value={cat} onChange={(e) => setCat(e.target.value)}>
              {cats.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Valor (R$)">
            <input className="field-input num" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="Data">
            <input className="field-input num" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Método">
            <select className="field-input" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
              {(Object.keys(METHOD_LABEL) as PayMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </select>
          </Field>
        </div>
        {err && <p className="flex items-center gap-1.5 text-xs font-semibold text-coral-600"><IcAlert size={13} /> {err}</p>}
        <button onClick={salvar} className={`btn-press w-full rounded-xl px-4 py-3 text-sm font-bold text-white ${type === "receita" ? "bg-leaf-600 hover:bg-leaf-700" : "bg-coral-600 hover:bg-coral-700"}`}>
          Salvar {type}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Aplicação (ficha) com FEFO + reconstituição ---------- */
function ApplicationModal({ open, clientId, idAlocacao, onClose }: { open: boolean; clientId?: string; idAlocacao?: string; onClose: () => void }) {
  const { state, concluirAplicacao } = useStore();
  const { push } = useToast();
  const [idCliente, setIdCliente] = useState("");
  const [valor, setValor] = useState("");
  const [method, setMethod] = useState<PayMethod>("pix");
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);

  const cliente = state.clients.find((c) => c.id === (idCliente || clientId));
  const ficha = cliente?.fichaTecnicaId ? state.fichas.find((f) => f.id === cliente.fichaTecnicaId) : undefined;
  const check = useMemo(
    () => (ficha && cliente ? kitCheck(state, ficha.id) : null),
    [state, ficha, cliente],
  );

  if (open && !loaded) {
    setIdCliente(clientId ?? "");
    const f = (clientId && state.clients.find((c) => c.id === clientId)?.fichaTecnicaId)
      ? state.fichas.find((x) => x.id === state.clients.find((c) => c.id === clientId)?.fichaTecnicaId)
      : undefined;
    setValor(f ? String(f.precoVenda) : "");
    setLoaded(true);
    setErr("");
  }
  if (!open && loaded) setLoaded(false);

  const concluir = () => {
    if (!cliente) return setErr("Selecione o paciente.");
    if (!ficha) return setErr("Este paciente não tem protocolo (ficha) vinculado. Vincule na tela Pacientes.");
    const v = parseFloat(valor.replace(",", ".")) || 0;
    if (v <= 0) return setErr("Informe o valor da aplicação.");
    const r = concluirAplicacao({ idCliente: cliente.id, idFicha: ficha.id, data: todayISO(), valor: v, metodo: method, idAlocacao });
    if (r.ok) {
      push("success", `Aplicação registrada — estoque baixado (FEFO), receita e CMV lançados.`);
      setLoaded(false);
      onClose();
    } else setErr(r.error);
  };

  return (
    <Modal open={open} onClose={() => { setLoaded(false); onClose(); }} title="Registrar aplicação" subtitle="Baixa automática do kit + receita + custo na entrega.">
      <div className="space-y-3">
        <Field label="Paciente">
          <select className="field-input" value={idCliente || clientId || ""} onChange={(e) => setIdCliente(e.target.value)} disabled={!!clientId}>
            <option value="">Selecione…</option>
            {state.clients.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {ficha && check && (
          <div className="rounded-xl border border-line bg-mist/50 p-3">
            <p className="eyebrow">Kit do protocolo · {ficha.nome}</p>
            <ul className="mt-2 space-y-1.5">
              {check.linhas.map((l) => (
                <li key={l.item.id} className="flex items-center gap-2 text-[12.5px]">
                  <span className={l.falta ? "text-coral-600" : "text-leaf-700"}>
                    {l.falta ? <IcAlert size={13} /> : <IcCheck size={13} />}
                  </span>
                  <span className="flex-1 font-semibold">{l.produto?.nome}</span>
                  <span className="num text-ink-soft">{fmtQtd(l.necessario, l.produto?.unidade)}</span>
                  {l.lote && <Badge tone={l.falta ? "coral" : "neutral"}>lote {l.lote.numeroLote}{l.seraReconstituido ? " · reconstituir" : ""}</Badge>}
                </li>
              ))}
            </ul>
            {check.faltas.length > 0 && (
              <p className="mt-2 rounded-lg bg-coral-50 px-2.5 py-1.5 text-[11.5px] font-semibold text-coral-700">{check.faltas[0]}</p>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)">
            <input className="field-input num" type="number" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
          </Field>
          <Field label="Método">
            <select className="field-input" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
              {(Object.keys(METHOD_LABEL) as PayMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </select>
          </Field>
        </div>
        {err && <p className="flex items-center gap-1.5 text-xs font-semibold text-coral-600"><IcAlert size={13} /> {err}</p>}
        <button onClick={concluir} className="btn-big">
          <IcCheck size={18} /> Concluir aplicação
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Paciente ---------- */
function ClientModal({ client, onClose }: { client: Client | "new" | null; onClose: () => void }) {
  const { state, saveClient } = useStore();
  const { push } = useToast();
  const editing = client && client !== "new" ? client : null;
  const [nome, setNome] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [emergencia, setEmergencia] = useState("");
  const [profissao, setProfissao] = useState("");
  const [fichaId, setFichaId] = useState("");
  const [freq, setFreq] = useState("7");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const key = client === "new" ? "new" : client?.id ?? null;
  if (client && loadedFor !== key) {
    setNome(editing?.name ?? "");
    setPhone(editing?.phone ?? "");
    setCpf(editing?.cpf ?? "");
    setNascimento(editing?.dataNascimento ?? "");
    setEmergencia(editing?.contatoEmergencia ?? "");
    setProfissao(editing?.profissao ?? "");
    setFichaId(editing?.fichaTecnicaId ?? state.fichas.find((f) => f.ativo)?.id ?? "");
    setFreq(String(editing?.frequencyDays ?? 7));
    setNotes(editing?.notes ?? "");
    setLoadedFor(key);
    setErr("");
  }
  if (!client && loadedFor !== null) setLoadedFor(null);

  const salvar = () => {
    if (!nome.trim()) return setErr("Informe o nome do paciente.");
    const f = state.fichas.find((x) => x.id === fichaId);
    saveClient({
      id: editing?.id ?? uid(),
      name: nome.trim(),
      phone: phone.trim(),
      cpf: onlyDigits(cpf),
      dataNascimento: nascimento || undefined,
      contatoEmergencia: emergencia.trim() || undefined,
      profissao: profissao.trim() || undefined,
      fichaTecnicaId: fichaId || undefined,
      productId: f?.itens.find((i) => i.tipoConsumo === "INSUMO_PRINCIPAL")?.idProduto ?? "",
      frequencyDays: Math.max(1, parseInt(freq) || 7),
      lastApplication: editing?.lastApplication ?? todayISO(),
      notes,
      active: editing?.active ?? true,
      since: editing?.since ?? todayISO(),
    });
    push("success", editing ? "Paciente atualizado." : "Paciente cadastrado.");
    setLoadedFor(null);
    onClose();
  };

  return (
    <Modal open={!!client} onClose={() => { setLoadedFor(null); onClose(); }} title={editing ? "Editar paciente" : "Novo paciente"} subtitle="O protocolo vinculado define a baixa automática.">
      <div className="space-y-3">
        <Field label="Nome completo">
          <input className="field-input" value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="WhatsApp">
            <input className="field-input num" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 9…" />
          </Field>
          <Field label="CPF (rastreabilidade)">
            <input className="field-input num" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
          </Field>
          <Field label="Data de nascimento">
            <input className="field-input num" type="date" value={nascimento} max={todayISO()} onChange={(e) => setNascimento(e.target.value)} />
          </Field>
          <Field label="Contato de emergência">
            <input className="field-input num" value={emergencia} onChange={(e) => setEmergencia(e.target.value)} placeholder="Nome · (11) 9…" />
          </Field>
          <Field label="Profissão">
            <input className="field-input" value={profissao} onChange={(e) => setProfissao(e.target.value)} placeholder="Ex.: Professora" />
          </Field>
          <Field label="Protocolo (ficha)">
            <select className="field-input" value={fichaId} onChange={(e) => setFichaId(e.target.value)}>
              <option value="">Sem protocolo</option>
              {state.fichas.filter((f) => f.ativo).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </Field>
          <Field label="Intervalo (dias)">
            <input className="field-input num" type="number" min="1" value={freq} onChange={(e) => setFreq(e.target.value)} />
          </Field>
        </div>
        <Field label="Orientações diárias (uma por linha)">
          <textarea className="field-input min-h-[84px] py-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {err && <p className="flex items-center gap-1.5 text-xs font-semibold text-coral-600"><IcAlert size={13} /> {err}</p>}
        <button onClick={salvar} className="btn-big"><IcCheck size={18} /> Salvar paciente</button>
      </div>
    </Modal>
  );
}

/* ---------- Agendar (criar ou editar data) ---------- */
function AgendarModal({ alvo, onClose }: { alvo: { clienteId: string; alocId?: string } | null; onClose: () => void }) {
  const { state, agendarAplicacao, editarAlocacao } = useStore();
  const { push } = useToast();
  const c = state.clients.find((x) => x.id === alvo?.clienteId);
  const aloc = alvo?.alocId ? state.alocacoes.find((a) => a.id === alvo.alocId) : undefined;
  const editando = !!aloc;
  const [prevista, setPrevista] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const chave = alvo ? `${alvo.clienteId}|${alvo.alocId ?? ""}` : null;
  if (alvo && loadedFor !== chave) {
    setPrevista(aloc?.dataPrevista ?? nextDate(c ?? { ...({} as Client), lastApplication: todayISO(), frequencyDays: 7 }));
    setLoadedFor(chave);
  }
  if (!alvo && loadedFor !== null) setLoadedFor(null);

  const fechar = () => {
    setPrevista("");
    setLoadedFor(null);
    onClose();
  };

  const salvar = () => {
    if (!alvo) return;
    const r = editando
      ? editarAlocacao(aloc!.id, prevista)
      : agendarAplicacao(alvo.clienteId, prevista);
    if (r.ok) {
      push("success", editando ? "Data do agendamento atualizada." : "Aplicação agendada — entra na fila do dia e aloca estoque virtual.");
      fechar();
    } else push("error", r.error);
  };

  return (
    <Modal open={!!alvo} onClose={fechar} title={editando ? "Editar agendamento" : "Novo agendamento"} subtitle={c?.name}>
      <div className="space-y-3">
        <Field label="Data prevista" hint={editando ? "Altere a data desta aplicação agendada." : "Você pode criar vários agendamentos para o mesmo paciente."}>
          <input className="field-input num" type="date" value={prevista} onChange={(e) => setPrevista(e.target.value)} />
        </Field>
        <button onClick={salvar} className="btn-big"><IcCheck size={18} /> {editando ? "Salvar alteração" : "Agendar"}</button>
      </div>
    </Modal>
  );
}

/* ---------- Lote: quarentena ---------- */
function QuarentenaModal({ idLote, onClose }: { idLote: string | null; onClose: () => void }) {
  const { state, quarentena, liberar } = useStore();
  const { push } = useToast();
  const [motivo, setMotivo] = useState("");
  const l = state.lotes.find((x) => x.id === idLote);

  const salvar = () => {
    if (!idLote) return;
    const r = quarentena(idLote, motivo);
    if (r.ok) {
      push("success", "Lote em quarentena — fora do FEFO e do PMP.");
      setMotivo("");
      onClose();
    } else push("error", r.error);
  };

  return (
    <Modal open={!!idLote} onClose={() => { setMotivo(""); onClose(); }} title="Bloquear lote (quarentena)" subtitle={l ? `${l.numeroLote} · validade ${fmtShort(l.dataValidade)}` : undefined}>
      <div className="space-y-3">
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
          O lote deixa de ser selecionado para aplicação e sai do cálculo do PMP até ser liberado.
        </p>
        <Field label="Motivo (obrigatório)">
          <textarea className="field-input min-h-[72px] py-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: falha de temperatura no transporte" />
        </Field>
        <div className="flex gap-2">
          <button onClick={() => { const r = liberar(idLote!); push(r.ok ? "success" : "error", r.ok ? "Lote liberado." : r.error); onClose(); }}
            className="btn-press flex-1 rounded-xl border border-leaf-200 bg-leaf-50 px-4 py-3 text-sm font-bold text-leaf-700 hover:bg-leaf-100">
            Liberar
          </button>
          <button onClick={salvar} className="btn-press flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white hover:bg-amber-600">
            Bloquear
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Lote: reconstituição ---------- */
function ReconstituirModal({ idLote, onClose }: { idLote: string | null; onClose: () => void }) {
  const { state, reconstituir } = useStore();
  const { push } = useToast();
  const l = state.lotes.find((x) => x.id === idLote);
  const p = l ? state.produtos.find((x) => x.id === l.idProduto) : undefined;
  const [dias, setDias] = useState("");

  if (idLote && !dias && p?.validadePosReconstituicaoDias) setDias(String(p.validadePosReconstituicaoDias));

  const salvar = () => {
    if (!idLote) return;
    const r = reconstituir(idLote, parseInt(dias) || 0);
    if (r.ok) {
      push("success", "Frasco reconstituído — validade dupla registrada, saldo movido para em uso.");
      setDias("");
      onClose();
    } else push("error", r.error);
  };

  return (
    <Modal open={!!idLote} onClose={() => { setDias(""); onClose(); }} title="Reconstituir frasco" subtitle={p ? `${p.nome} · lote ${l?.numeroLote} · fechado ${fmtQtd(l?.saldoFechado ?? 0, p.unidade)}` : undefined}>
      <div className="space-y-3">
        <p className="rounded-xl bg-leaf-50 px-3 py-2 text-[12px] font-semibold text-leaf-700">
          O saldo fechado vira saldo em uso e ganha validade própria (ex.: +{p?.validadePosReconstituicaoDias ?? 28} dias).
        </p>
        <Field label="Validade pós-reconstituição (dias)">
          <input className="field-input num" type="number" min="1" value={dias} onChange={(e) => setDias(e.target.value)} />
        </Field>
        <button onClick={salvar} className="btn-big"><IcCheck size={18} /> Reconstituir</button>
      </div>
    </Modal>
  );
}

/* ---------- Lote: ajuste / perda ---------- */
function AjusteModal({ idLote, onClose }: { idLote: string | null; onClose: () => void }) {
  const { state, ajustar } = useStore();
  const { push } = useToast();
  const l = state.lotes.find((x) => x.id === idLote);
  const p = l ? state.produtos.find((x) => x.id === l.idProduto) : undefined;
  const [campo, setCampo] = useState<"saldoFechado" | "saldoEmUso">("saldoFechado");
  const [novo, setNovo] = useState("");
  const [tipo, setTipo] = useState<"AJUSTE" | "PERDA">("AJUSTE");
  const [motivo, setMotivo] = useState("");
  const [err, setErr] = useState("");

  const atual = l ? (campo === "saldoFechado" ? l.saldoFechado : l.saldoEmUso) : 0;
  const lotesDoProduto = p ? fefoSort(state.lotes.filter((x) => x.idProduto === p.id && x.status !== "DESCARTADO")) : [];

  const salvar = () => {
    if (!idLote) return;
    const v = parseFloat(novo.replace(",", "."));
    if (isNaN(v) || v < 0) return setErr("Informe o novo saldo (≥ 0).");
    if (!motivo.trim()) return setErr("Informe o motivo — fica registrado no kardex.");
    const r = ajustar(idLote, campo, round2(v), tipo, motivo);
    if (r.ok) {
      push("success", `${tipo === "PERDA" ? "Perda" : "Ajuste"} registrado — PMP inalterado.`);
      setNovo(""); setMotivo(""); setErr("");
      onClose();
    } else setErr(r.error);
  };

  return (
    <Modal open={!!idLote} onClose={() => { setNovo(""); setMotivo(""); onClose(); }} title="Ajustar / perda de estoque" subtitle={p?.nome}>
      <div className="space-y-3">
        {lotesDoProduto.length > 1 && (
          <Field label="Lote">
            <select className="field-input" value={idLote ?? ""} onChange={() => { /* lote fixo pelo caller */ }}>
              {lotesDoProduto.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.numeroLote} · fechado {fmtQtd(x.saldoFechado)} · em uso {fmtQtd(x.saldoEmUso)} · val {fmtShort(x.dataValidade)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Saldo">
            <select className="field-input" value={campo} onChange={(e) => setCampo(e.target.value as "saldoFechado" | "saldoEmUso")}>
              <option value="saldoFechado">Fechado ({fmtQtd(l?.saldoFechado ?? 0)})</option>
              <option value="saldoEmUso">Em uso ({fmtQtd(l?.saldoEmUso ?? 0)})</option>
            </select>
          </Field>
          <Field label={`Novo saldo (${p?.unidade ?? ""})`} hint={`atual: ${fmtQtd(atual)}`}>
            <input className="field-input num" type="number" min="0" step="0.01" value={novo} onChange={(e) => setNovo(e.target.value)} />
          </Field>
        </div>
        <Field label="Natureza">
          <select className="field-input" value={tipo} onChange={(e) => setTipo(e.target.value as "AJUSTE" | "PERDA")}>
            <option value="AJUSTE">Ajuste de inventário (contagem)</option>
            <option value="PERDA">Perda / quebra</option>
          </select>
        </Field>
        <Field label="Motivo (obrigatório)">
          <input className="field-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: quebra de frasco, contagem divergente" />
        </Field>
        <p className="rounded-xl bg-mist/70 px-3 py-2 text-[11.5px] font-semibold text-ink-faint">
          Ajustes e perdas nunca alteram o preço médio (PMP) — apenas o saldo.
        </p>
        {err && <p className="flex items-center gap-1.5 text-xs font-semibold text-coral-600"><IcAlert size={13} /> {err}</p>}
        <button onClick={salvar} className="btn-big"><IcCheck size={18} /> Registrar</button>
      </div>
    </Modal>
  );
}

/* ---------- Aplicar dose de protocolo ---------- */
function AplicarDoseModal({ dose, onClose }: { dose: { idProtocolo: string; idDose: string } | null; onClose: () => void }) {
  const { state, aplicarDose } = useStore();
  const { push } = useToast();
  const proto = state.protocolos.find((p) => p.id === dose?.idProtocolo);
  const d = proto?.doses.find((x) => x.id === dose?.idDose);
  const cliente = proto ? state.clients.find((c) => c.id === proto.idCliente) : undefined;

  const unicos = proto ? [...proto.servicos.filter((s) => s.frequencia === "UNICA"), ...proto.servicos.filter((s) => s.frequencia === "POR_DOSE")] : [];
  const doseJaTeveUnica = proto ? proto.doses.some((x) => x.numero < (d?.numero ?? 0) && x.status === "APLICADA") : false;

  const [valor, setValor] = useState("");
  const [method, setMethod] = useState<PayMethod>("pix");
  const [local, setLocal] = useState("");
  const [obs, setObs] = useState("");
  const [err, setErr] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const defaultValor = proto
    ? proto.valorPorDose + (d && !doseJaTeveUnica ? proto.servicos.filter((s) => s.frequencia === "UNICA").reduce((a, s) => a + s.valor, 0) : 0)
    : 0;

  if (dose && loadedFor !== dose.idDose) {
    setValor(String(defaultValor));
    setLocal(""); setObs(""); setErr("");
    setLoadedFor(dose.idDose);
  }
  if (!dose && loadedFor !== null) setLoadedFor(null);

  const produto = d ? state.produtos.find((p) => p.id === d.idProduto) : undefined;

  const salvar = () => {
    if (!dose) return;
    const v = parseFloat(valor.replace(",", ".")) || 0;
    if (v <= 0) return setErr("Informe o valor cobrado.");
    const r = aplicarDose({
      idProtocolo: dose.idProtocolo, idDose: dose.idDose, data: todayISO(),
      valor: v, metodo: method, localAplicacao: local.trim() || "—", observacoes: obs.trim(),
    });
    if (r.ok) {
      push("success", `Dose aplicada — insumos baixados, receita e CMV lançados para ${cliente?.name ?? "o paciente"}.`);
      setLoadedFor(null);
      onClose();
    } else setErr(r.error);
  };

  return (
    <Modal open={!!dose} onClose={() => { setLoadedFor(null); onClose(); }} title={d ? `Aplicar dose ${d.numero} de ${proto?.doses.length}` : "Aplicar dose"} subtitle={`${cliente?.name ?? ""} · ${proto?.nome ?? ""}`}>
      <div className="space-y-3">
        <div className="rounded-xl border border-line bg-mist/50 p-3">
          <p className="eyebrow">Baixa automática nesta aplicação</p>
          <ul className="mt-2 space-y-1 text-[12.5px] font-semibold">
            {produto && d && <li className="flex justify-between"><span>{produto.nome}</span><span className="num">{fmtQtd(d.qtd, produto.unidade)}</span></li>}
            {proto?.materiais.map((m) => {
              const pm = state.produtos.find((p) => p.id === m.idProduto);
              return pm ? <li key={m.id} className="flex justify-between"><span>{pm.nome}</span><span className="num">{fmtQtd(m.qtd, pm.unidade)}</span></li> : null;
            })}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor cobrado (R$)">
            <input className="field-input num" type="number" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
          </Field>
          <Field label="Método">
            <select className="field-input" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
              {(Object.keys(METHOD_LABEL) as PayMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </select>
          </Field>
        </div>
        {unicos.length > 0 && (
          <p className="rounded-xl bg-leaf-50 px-3 py-2 text-[11.5px] font-semibold text-leaf-700">
            Serviços únicos ({unicos.map((s) => s.descricao).join(", ")}) {doseJaTeveUnica ? "já foram cobrados em dose anterior." : "estão incluídos no valor sugerido."}
          </p>
        )}
        <Field label="Local da aplicação">
          <input className="field-input" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: abdômen, braço esquerdo" />
        </Field>
        <Field label="Observações">
          <textarea className="field-input min-h-[64px] py-2" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Reações, orientações dadas…" />
        </Field>
        {err && <p className="flex items-center gap-1.5 text-xs font-semibold text-coral-600"><IcAlert size={13} /> {err}</p>}
        <button onClick={salvar} className="btn-big"><IcCheck size={18} /> Aplicar e baixar estoque</button>
      </div>
    </Modal>
  );
}
