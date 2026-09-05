import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  Anamnese, AppState, AvaliacaoFisica, Client, Employee, Fornecedor, ItemFichaTecnica, PayMethod,
  PedidoCompra, Produto, Quote, Result, ServicoAplicacao, SessaoAplicacao, TermoConsentimento,
  Termination, Transaction, ViaAplicacao,
} from "../types";
import { buildEmpty, buildSeed, SEED_FORNECEDORES, SEED_INSUMOS } from "./seed";
import { todayISO, uid } from "./utils";
import {
  ajustarLote, descartarLote, DomainError, liberarLote, reconstituirLote, registrarEntrada, round2, setQuarentena,
} from "./domain/engine";
import { executarKit } from "./domain/kits";
import { approveQuote } from "./domain/orcamentos";
import { aplicarDose as aplicarDoseEngine, gerarDoses, type AplicarDoseArgs } from "./domain/protocolos";

const KEY_V2 = "dosecerta:v2";
const KEY_V1 = "dosecerta:v1";

/* ---------- migration v1 → v2 ---------- */
interface V1State {
  products?: { id: string; name: string; kind: string; unit: string; stock: number; minStock: number; cost: number; price: number }[];
  clients?: Client[];
  transactions?: Transaction[];
}

function migrateV1(old: V1State): AppState {
  const produtos: Produto[] = (old.products ?? []).map((p) => ({
    id: p.id,
    sku: p.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 12) || `LEG-${p.id.slice(0, 4)}`,
    nome: p.name,
    unidade: p.unit?.trim() || "un",
    categoria: p.kind === "medicamento" ? "Medicamentos" : "Insumos",
    estoqueMinimo: p.minStock,
    estoqueMaximo: Math.max(p.minStock * 3, 10),
    saldoAtual: p.stock,
    precoMedio: p.cost,
    tipo: p.kind === "medicamento" ? "FARMACO" : "INSUMO",
    leadTimeDias: 7,
    estoqueSeguranca: p.minStock,
    refrigerado: p.kind === "medicamento",
  }));
  for (const ins of SEED_INSUMOS) if (!produtos.some((p) => p.id === ins.id)) produtos.push({ ...ins });

  const lotes = produtos.filter((p) => p.saldoAtual > 0).map((p) => ({
    id: uid(), idProduto: p.id, numeroLote: `MIG-${p.sku}`, dataValidade: todayISO().slice(0, 8) + "28",
    saldoFechado: p.saldoAtual, saldoEmUso: 0, status: "ATIVO" as const, localizacaoFisica: "Migração v1", custoEntrada: p.precoMedio,
  }));

  const fichas = produtos.filter((p) => p.tipo === "FARMACO").map((p) => ({
    id: `ft-${p.id}`, nome: `Aplicação — ${p.nome}`, tipo: "Aplicação",
    precoVenda: round2(p.precoMedio * 1.35), ativo: true,
    itens: [
      { id: uid(), idProduto: p.id, quantidadeNecessaria: 1, unidadeConsumo: "un", tipoConsumo: "INSUMO_PRINCIPAL" as const },
      { id: uid(), idProduto: "p-ser", quantidadeNecessaria: 1, unidadeConsumo: "un", tipoConsumo: "MATERIAL_APOIO" as const },
      { id: uid(), idProduto: "p-alc", quantidadeNecessaria: 2, unidadeConsumo: "un", tipoConsumo: "MATERIAL_APOIO" as const },
    ] as ItemFichaTecnica[],
  }));

  const clients = (old.clients ?? []).map((c) => ({
    ...c,
    cpf: c.cpf ?? "",
    fichaTecnicaId: fichas.find((f) => f.itens[0].idProduto === c.productId)?.id ?? fichas[0]?.id ?? "",
  }));

  return {
    v: 2, produtos, lotes,
    fornecedores: SEED_FORNECEDORES.map((f) => ({ ...f })),
    pedidos: [], entradas: [],
    movimentacoes: produtos.map((p) => ({
      id: uid(), idProduto: p.id, idLote: lotes.find((l) => l.idProduto === p.id)?.id, tipo: "E" as const,
      quantidade: p.saldoAtual, valorUnitario: p.precoMedio, saldoAposMov: p.saldoAtual,
      documentoRef: "Migração v1", criadoEm: `${todayISO()}T12:00:00`,
    })),
    fichas, alocacoes: [], clients,
    transactions: old.transactions ?? [],
    employees: [], terminations: [], quotes: [], protocolos: [], servicos: [],
    anamneses: [], avaliacoesFisicas: [], termos: [], sessoes: [], historico: [],
  };
}

function load(): AppState {
  try {
    const raw2 = localStorage.getItem(KEY_V2);
    if (raw2) {
      const s = JSON.parse(raw2) as AppState;
      if (s && s.v === 2 && Array.isArray(s.produtos) && Array.isArray(s.lotes) && Array.isArray(s.fichas)) {
        return {
          ...s,
          employees: s.employees ?? [],
          terminations: s.terminations ?? [],
          quotes: s.quotes ?? [],
          protocolos: s.protocolos ?? [],
          servicos: s.servicos ?? [],
          anamneses: s.anamneses ?? [],
          avaliacoesFisicas: s.avaliacoesFisicas ?? [],
          termos: s.termos ?? [],
          sessoes: s.sessoes ?? [],
          historico: s.historico ?? [],
        };
      }
    }
    const raw1 = localStorage.getItem(KEY_V1);
    if (raw1) {
      const old = JSON.parse(raw1) as V1State;
      if (old && Array.isArray(old.products)) return migrateV1(old);
    }
  } catch {
    /* corrompido → seed */
  }
  return buildSeed();
}

/* ---------- API ---------- */
export interface ConcluirArgs {
  idCliente: string;
  idFicha: string;
  valor: number;
  metodo: PayMethod;
  lotesEscolhidos?: Record<string, string>;
  reconst?: Record<string, boolean>;
  idAlocacao?: string;
}

export type DataDaAplicacao = string;
export interface ConcluirComData extends ConcluirArgs {
  data: DataDaAplicacao;
}

export interface StoreApi {
  state: AppState;
  hydrated: boolean;
  addTransaction(tx: Omit<Transaction, "id">): Transaction;
  updateTransaction(id: string, patch: Omit<Transaction, "id">): void;
  deleteTransaction(id: string): void;
  saveClient(c: Client): void;
  deleteClient(id: string): void;
  criarProduto(input: {
    nome: string; sku?: string; unidade: string; categoria: string; tipo: "FARMACO" | "INSUMO";
    refrigerado: boolean; validadePosReconstituicaoDias?: number;
    estoqueMinimo: number; estoqueMaximo: number; estoqueSeguranca: number; leadTimeDias: number;
  }): { ok: true; id: string } | { ok: false; error: string };
  addFornecedor(f: { razaoSocial: string; cnpj: string }): Fornecedor;
  criarPedido(p: { idFornecedor: string; data: string; itens: { idProduto: string; qtd: number; custoUnit: number }[] }): PedidoCompra;
  registrarCompra(args: {
    idFornecedor: string; dataCompra: string; valorFrete: number; valorSeguro?: number; valorOutros?: number;
    numeroDocumento?: string;
    itens: { idProduto: string; qtd: number; custoUnit: number; numeroLote: string; dataValidade: string; localizacao?: string }[];
  }): Result;
  reconstituir(idLote: string, dias: number): Result;
  quarentena(idLote: string, motivo: string): Result;
  liberar(idLote: string): Result;
  descartar(idLote: string, motivo: string): Result;
  ajustar(idLote: string, campo: "saldoFechado" | "saldoEmUso", novoSaldo: number, tipo: "AJUSTE" | "PERDA", motivo: string): Result;
  salvarFicha(f: { id?: string; nome: string; tipo: string; precoVenda: number; ativo: boolean; itens: ItemFichaTecnica[] }): void;
  agendarAplicacao(idCliente: string, data: string): Result;
  cancelarAlocacao(id: string): void;
  concluirAplicacao(args: ConcluirComData): Result;
  saveEmployee(e: Employee): void;
  deleteEmployee(id: string): void;
  recordTermination(t: Termination): Result;
  launchPayroll(args: { month: string; mod: number; moi: number }): Result;
  salvarOrcamento(q: Quote): void;
  excluirOrcamento(id: string): void;
  setStatusOrcamento(id: string, status: Quote["status"]): void;
  aprovarOrcamento(quoteId: string): Result & { clientName?: string };
  criarProtocolo(input: {
    idCliente: string; nome: string;
    farmacos: { idProduto: string; qtdDoses: number; qtdPorDose: number; unidadeConsumo: string }[];
    materiais: { idProduto: string; qtd: number }[];
    servicos: { descricao: string; valor: number; frequencia: "UNICA" | "POR_DOSE" }[];
    valorPorDose: number; dataInicio: string; intervaloDias: number;
  }): { ok: true; id: string } | { ok: false; error: string };
  excluirProtocolo(id: string): void;
  toggleProtocolo(id: string): void;
  atualizarDataDose(idProtocolo: string, idDose: string, novaData: string): void;
  aplicarDose(args: AplicarDoseArgs): Result & { servico?: ServicoAplicacao };
  /* prontuário clínico */
  salvarAnamnese(a: Omit<Anamnese, "id" | "createdAt"> & { id?: string }): void;
  addAvaliacao(a: Omit<AvaliacaoFisica, "id" | "createdAt" | "imc">): void;
  criarTermo(pacienteId: string, tipoProtocolo: string): TermoConsentimento;
  assinarLocal(termoId: string, assinaturaDataUrl: string): void;
  anexarTermoGovBr(termoId: string, arquivo: { nome: string; tipo: string; tamanho: number; dataUrl: string }): void;
  excluirTermo(termoId: string): void;
  registrarAplicacao(args: {
    pacienteId: string;
    dataHora: string;
    procedimento: string;
    protocolo: string;
    via: ViaAplicacao;
    local: string;
    substancias: { nome: string; dose: string; lote: string }[];
    material: string;
    evolucao: string;
    idDose?: string;
  }): Result;
  importState(s: AppState): Result;
  wipeAll(): void;
  resetData(): void;
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHydrated(true), 420);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY_V2, JSON.stringify(state));
    } catch { /* indisponível */ }
  }, [state]);

  const api = useMemo<StoreApi>(() => {
    const guard = (fn: (s: AppState) => AppState): Result => {
      try {
        setState(fn(state));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof DomainError ? e.message : "Operação inválida." };
      }
    };

    return {
      state,
      hydrated,
      addTransaction(tx) {
        const full = { ...tx, id: uid() };
        setState((prev) => ({ ...prev, transactions: [full, ...prev.transactions] }));
        return full;
      },
      updateTransaction(id, patch) {
        setState((prev) => ({ ...prev, transactions: prev.transactions.map((t) => (t.id === id ? { ...patch, id } : t)) }));
      },
      deleteTransaction(id) {
        setState((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== id) }));
      },
      saveClient(c) {
        setState((prev) => {
          const exists = prev.clients.some((x) => x.id === c.id);
          return { ...prev, clients: exists ? prev.clients.map((x) => (x.id === c.id ? c : x)) : [c, ...prev.clients] };
        });
      },
      deleteClient(id) {
        setState((prev) => ({
          ...prev,
          clients: prev.clients.filter((c) => c.id !== id),
          alocacoes: prev.alocacoes.filter((a) => a.idCliente !== id),
          protocolos: prev.protocolos.filter((p) => p.idCliente !== id),
        }));
      },
      criarProduto(input) {
        const nome = input.nome.trim();
        if (!nome) return { ok: false, error: "Informe o nome do produto." };
        const sku =
          (input.sku?.trim() || nome).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 14) || `PRD-${uid().slice(0, 5).toUpperCase()}`;
        if (state.produtos.some((p) => p.sku === sku))
          return { ok: false, error: `SKU ${sku} já existe — ajuste o nome ou informe outro código.` };
        const full: Produto = {
          id: uid(), sku, nome,
          unidade: input.unidade.trim() || "un",
          categoria: input.categoria.trim() || (input.tipo === "FARMACO" ? "Medicamentos" : "Insumos"),
          estoqueMinimo: Math.max(0, input.estoqueMinimo),
          estoqueMaximo: Math.max(Math.max(0, input.estoqueMinimo), input.estoqueMaximo),
          saldoAtual: 0, precoMedio: 0, tipo: input.tipo,
          leadTimeDias: Math.max(1, input.leadTimeDias),
          estoqueSeguranca: Math.max(0, input.estoqueSeguranca),
          validadePosReconstituicaoDias: input.validadePosReconstituicaoDias,
          refrigerado: input.refrigerado,
        };
        setState((prev) => ({ ...prev, produtos: [...prev.produtos, full] }));
        return { ok: true, id: full.id };
      },
      addFornecedor(f) {
        const full: Fornecedor = { id: uid(), razaoSocial: f.razaoSocial.trim(), cnpj: f.cnpj };
        setState((prev) => ({ ...prev, fornecedores: [...prev.fornecedores, full] }));
        return full;
      },
      criarPedido(p) {
        const full: PedidoCompra = {
          id: uid(), idFornecedor: p.idFornecedor, data: p.data, status: "ABERTO",
          itens: p.itens.map((i) => ({ id: uid(), idProduto: i.idProduto, qtd: i.qtd, qtdRecebida: 0, custoUnit: i.custoUnit })),
        };
        setState((prev) => ({ ...prev, pedidos: [full, ...prev.pedidos] }));
        return full;
      },
      registrarCompra({ idFornecedor, dataCompra, valorFrete, valorSeguro, valorOutros, numeroDocumento, itens }) {
        try {
          if (!itens.length) return { ok: false, error: "Adicione ao menos um insumo à compra." };
          const numero = numeroDocumento?.trim() || `CP-${dataCompra.replace(/-/g, "").slice(2)}`;
          return guard(
            (s) =>
              registrarEntrada(s, {
                itens, idFornecedor, numeroNota: numero, dataEntrada: dataCompra,
                valorFrete, valorSeguro, valorOutros, rotulo: "Compra",
              }).state,
          );
        } catch (e) {
          return { ok: false, error: e instanceof DomainError ? e.message : "Não foi possível registrar a compra." };
        }
      },
      reconstituir: (idLote, dias) => guard((s) => reconstituirLote(s, { idLote, dias })),
      quarentena: (idLote, motivo) => guard((s) => setQuarentena(s, { idLote, motivo })),
      liberar: (idLote) => guard((s) => liberarLote(s, { idLote })),
      descartar: (idLote, motivo) => guard((s) => descartarLote(s, { idLote, motivo })),
      ajustar: (idLote, campo, novoSaldo, tipo, motivo) => guard((s) => ajustarLote(s, { idLote, campo, novoSaldo, tipo, motivo })),
      salvarFicha(f) {
        setState((prev) => {
          const ficha = { ...f, id: f.id ?? uid() };
          const exists = prev.fichas.some((x) => x.id === ficha.id);
          return { ...prev, fichas: exists ? prev.fichas.map((x) => (x.id === ficha.id ? ficha : x)) : [ficha, ...prev.fichas] };
        });
      },
      agendarAplicacao(idCliente, data) {
        const c = state.clients.find((x) => x.id === idCliente);
        if (!c) return { ok: false, error: "Paciente não encontrado." };
        if (!c.fichaTecnicaId) return { ok: false, error: "Este paciente ainda não tem protocolo vinculado." };
        if (state.alocacoes.some((a) => a.idCliente === idCliente))
          return { ok: false, error: "Já existe um agendamento pendente para este paciente." };
        if (!data) return { ok: false, error: "Informe a data prevista." };
        setState((prev) => ({
          ...prev,
          alocacoes: [...prev.alocacoes, { id: uid(), idCliente, idFicha: c.fichaTecnicaId!, dataPrevista: data, criadaEm: todayISO() }],
        }));
        return { ok: true };
      },
      cancelarAlocacao(id) {
        setState((prev) => ({ ...prev, alocacoes: prev.alocacoes.filter((a) => a.id !== id) }));
      },
      concluirAplicacao(args) {
        try {
          const r = executarKit(state, args);
          if (r.faltas.length) return { ok: false, error: r.faltas.join(" • ") };
          setState(r.state);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : "Falha ao concluir aplicação." };
        }
      },
      saveEmployee(e) {
        setState((prev) => {
          const exists = prev.employees.some((x) => x.id === e.id);
          return { ...prev, employees: exists ? prev.employees.map((x) => (x.id === e.id ? e : x)) : [...prev.employees, e] };
        });
      },
      deleteEmployee(id) {
        setState((prev) => ({ ...prev, employees: prev.employees.filter((e) => e.id !== id) }));
      },
      recordTermination(t) {
        const emp = state.employees.find((e) => e.id === t.employeeId);
        if (!emp) return { ok: false, error: "Colaborador não encontrado." };
        setState((prev) => ({
          ...prev,
          employees: prev.employees.map((e) => (e.id === t.employeeId ? { ...e, status: "DESLIGADO" as const } : e)),
          terminations: [t, ...prev.terminations],
        }));
        return { ok: true };
      },
      launchPayroll({ month, mod, moi }) {
        if (mod <= 0 && moi <= 0) return { ok: false, error: "Não há custos de pessoal no mês selecionado." };
        const existing = state.transactions.some((t) => t.category === "Folha de pagamento" && t.date.startsWith(month));
        if (existing) return { ok: false, error: "A folha deste mês já foi lançada no financeiro." };
        const txs: Transaction[] = [];
        if (mod > 0)
          txs.push({ id: uid(), type: "despesa", description: `Folha ${month} — Mão de Obra Direta`, category: "Folha de pagamento", amount: mod, date: `${month}-28`, method: "pix" });
        if (moi > 0)
          txs.push({ id: uid(), type: "despesa", description: `Folha ${month} — Despesas administrativas`, category: "Folha de pagamento", amount: moi, date: `${month}-28`, method: "pix" });
        setState((prev) => ({ ...prev, transactions: [...txs, ...prev.transactions] }));
        return { ok: true };
      },
      salvarOrcamento(q) {
        setState((prev) => {
          const exists = prev.quotes.some((x) => x.id === q.id);
          return { ...prev, quotes: exists ? prev.quotes.map((x) => (x.id === q.id ? q : x)) : [q, ...prev.quotes] };
        });
      },
      excluirOrcamento(id) {
        setState((prev) => {
          const q = prev.quotes.find((x) => x.id === id);
          if (!q) return prev;
          const fichaId = q.idFicha;
          return {
            ...prev,
            quotes: prev.quotes.filter((x) => x.id !== id),
            fichas: fichaId ? prev.fichas.filter((f) => f.id !== fichaId) : prev.fichas,
            alocacoes: fichaId ? prev.alocacoes.filter((a) => a.idFicha !== fichaId) : prev.alocacoes,
            clients: fichaId ? prev.clients.map((c) => (c.fichaTecnicaId === fichaId ? { ...c, fichaTecnicaId: undefined } : c)) : prev.clients,
          };
        });
      },
      setStatusOrcamento(id, status) {
        setState((prev) => ({ ...prev, quotes: prev.quotes.map((q) => (q.id === id ? { ...q, status } : q)) }));
      },
      aprovarOrcamento(quoteId) {
        const r = approveQuote(state, quoteId);
        if (!r.ok || !r.state) return { ok: false, error: r.faltas.join(" • ") };
        setState(r.state);
        return { ok: true, clientName: r.clientName };
      },
      criarProtocolo(input) {
        if (!input.idCliente) return { ok: false, error: "Selecione o paciente." };
        if (!input.nome.trim()) return { ok: false, error: "Dê um nome ao protocolo." };
        if (!input.farmacos.length) return { ok: false, error: "Adicione ao menos um fármaco." };
        if (input.valorPorDose <= 0) return { ok: false, error: "Informe o valor por dose." };
        const farmacos = input.farmacos.map((f) => ({ ...f, id: uid() }));
        const proto = {
          id: uid(), idCliente: input.idCliente, nome: input.nome.trim(),
          farmacos,
          materiais: input.materiais.map((m) => ({ ...m, id: uid() })),
          servicos: input.servicos.map((sv) => ({ ...sv, id: uid() })),
          valorPorDose: input.valorPorDose,
          dataInicio: input.dataInicio,
          intervaloDias: input.intervaloDias,
          doses: gerarDoses(farmacos, input.dataInicio, input.intervaloDias),
          ativo: true,
          createdAt: todayISO(),
        };
        setState((prev) => ({ ...prev, protocolos: [proto, ...prev.protocolos] }));
        return { ok: true, id: proto.id };
      },
      excluirProtocolo(id) {
        setState((prev) => ({ ...prev, protocolos: prev.protocolos.filter((p) => p.id !== id) }));
      },
      toggleProtocolo(id) {
        setState((prev) => ({ ...prev, protocolos: prev.protocolos.map((p) => (p.id === id ? { ...p, ativo: !p.ativo } : p)) }));
      },
      atualizarDataDose(idProtocolo, idDose, novaData) {
        setState((prev) => ({
          ...prev,
          protocolos: prev.protocolos.map((p) =>
            p.id === idProtocolo
              ? { ...p, doses: p.doses.map((d) => (d.id === idDose && d.status === "AGENDADA" ? { ...d, data: novaData } : d)) }
              : p,
          ),
        }));
      },
      aplicarDose(args) {
        const r = aplicarDoseEngine(state, args);
        if (r.faltas.length) return { ok: false, error: r.faltas.join(" • ") };
        setState(r.state);
        return { ok: true, servico: r.servico };
      },

      /* ---------- prontuário clínico ---------- */
      salvarAnamnese(a) {
        setState((prev) => {
          const agora = `${todayISO()}T12:00:00`;
          if (a.id) {
            return { ...prev, anamneses: prev.anamneses.map((x) => (x.id === a.id ? { ...a, id: a.id, createdAt: x.createdAt } : x)) };
          }
          return { ...prev, anamneses: [{ ...a, id: uid(), createdAt: agora }, ...prev.anamneses] };
        });
      },
      addAvaliacao(a) {
        setState((prev) => {
          const imc = a.alturaM > 0 ? Math.round((a.peso / (a.alturaM * a.alturaM)) * 100) / 100 : 0;
          const full: AvaliacaoFisica = { ...a, imc, id: uid(), createdAt: `${todayISO()}T12:00:00` };
          return { ...prev, avaliacoesFisicas: [full, ...prev.avaliacoesFisicas] };
        });
      },
      criarTermo(pacienteId, tipoProtocolo) {
        const full: TermoConsentimento = {
          id: uid(), pacienteId, createdAt: `${todayISO()}T12:00:00`, tipoProtocolo,
          metodoAssinatura: "local", status: "pendente_assinatura",
        };
        setState((prev) => ({ ...prev, termos: [full, ...prev.termos] }));
        return full;
      },
      assinarLocal(termoId, assinaturaDataUrl) {
        setState((prev) => ({
          ...prev,
          termos: prev.termos.map((t) =>
            t.id === termoId
              ? { ...t, assinaturaLocal: assinaturaDataUrl, assinadoEm: `${todayISO()}T12:00:00`, status: "assinado_local" as const, metodoAssinatura: "local" as const }
              : t,
          ),
        }));
      },
      anexarTermoGovBr(termoId, arquivo) {
        setState((prev) => ({
          ...prev,
          termos: prev.termos.map((t) =>
            t.id === termoId
              ? { ...t, arquivoAssinadoGovBr: arquivo, assinadoEm: `${todayISO()}T12:00:00`, status: "assinado_govbr" as const, metodoAssinatura: "govbr" as const }
              : t,
          ),
        }));
      },
      excluirTermo(termoId) {
        setState((prev) => ({ ...prev, termos: prev.termos.filter((t) => t.id !== termoId) }));
      },
      registrarAplicacao(args) {
        const cliente = state.clients.find((c) => c.id === args.pacienteId);
        if (!cliente) return { ok: false, error: "Paciente não encontrado." };
        if (!args.procedimento.trim()) return { ok: false, error: "Informe o procedimento realizado." };
        if (!args.substancias.length) return { ok: false, error: "Adicione ao menos uma substância com lote." };
        if (args.substancias.some((s) => !s.lote.trim())) return { ok: false, error: "Informe o lote de todas as substâncias (rastreabilidade)." };

        // se vinculado a uma dose de protocolo, aplica a baixa de estoque + financeiro primeiro (atômico)
        let base = state;
        if (args.idDose) {
          const proto = state.protocolos.find((p) => p.idCliente === args.pacienteId && p.doses.some((d) => d.id === args.idDose));
          if (!proto) return { ok: false, error: "Dose de protocolo não encontrada." };
          const diaDaAplicacao = args.dataHora.slice(0, 10);
          const r = aplicarDoseEngine(state, {
            idProtocolo: proto.id, idDose: args.idDose, data: diaDaAplicacao,
            valor: proto.valorPorDose, metodo: "pix", localAplicacao: args.local, observacoes: args.evolucao,
          });
          if (r.faltas.length) return { ok: false, error: r.faltas.join(" • ") };
          base = r.state;
        }

        const sessao: SessaoAplicacao = {
          id: uid(), pacienteId: args.pacienteId, dataHora: args.dataHora, protocoloAplicado: args.protocolo,
          substanciasUtilizadas: args.substancias.map((s) => ({ ...s, id: uid() })),
          localAplicacao: args.local, lote: args.substancias[0].lote, observacoes: args.evolucao,
        };
        const hist = {
          id: uid(), pacienteId: args.pacienteId, dataHora: args.dataHora, procedimentoRealizado: args.procedimento,
          protocoloAplicacao: args.protocolo,
          medicamentoAplicado: args.substancias.map((s) => `${s.nome} ${s.dose}`.trim()).join(", "),
          materialUtilizado: args.material, localAplicacao: args.local, tipoAplicacao: args.via, evolucaoTratamento: args.evolucao,
        };
        setState({ ...base, sessoes: [sessao, ...base.sessoes], historico: [hist, ...base.historico] });
        return { ok: true };
      },

      importState(s) {
        if (!s || s.v !== 2 || !Array.isArray(s.transactions) || !Array.isArray(s.produtos))
          return { ok: false, error: "Arquivo de backup inválido ou incompatível." };
        setState({
          ...s,
          employees: s.employees ?? [], terminations: s.terminations ?? [],
          quotes: s.quotes ?? [], protocolos: s.protocolos ?? [], servicos: s.servicos ?? [],
          anamneses: s.anamneses ?? [], avaliacoesFisicas: s.avaliacoesFisicas ?? [], termos: s.termos ?? [],
          sessoes: s.sessoes ?? [], historico: s.historico ?? [],
        });
        return { ok: true };
      },
      wipeAll() {
        setState(buildEmpty());
      },
      resetData() {
        setState(buildSeed());
      },
    };
  }, [state, hydrated]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore fora do StoreProvider");
  return v;
}
