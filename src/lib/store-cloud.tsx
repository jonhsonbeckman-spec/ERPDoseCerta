/**
 * Store com integração completa ao Supabase
 * Todos os dados são sincronizados com o banco de dados
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  AppState, Client, Employee, Fornecedor, Lote, Produto, Quote, Result, Transaction,
} from "../types";
import { buildSeed } from "./seed";
import { isSupabaseConfigured } from "./supabase/client";
import {
  produtosRepo,
  lotesRepo,
  transacoesRepo,
  fornecedoresRepo,
  funcionariosRepo,
  orcamentosRepo,
} from "./supabase/repository";
import { uid } from "./utils";

const KEY_V2 = "dosecerta:v2";

// Mapeamento camelCase (app) <-> snake_case (banco)
const toDbProduto = (p: Produto) => ({
  id: p.id,
  sku: p.sku,
  nome: p.nome,
  unidade: p.unidade,
  categoria: p.categoria,
  estoque_minimo: p.estoqueMinimo,
  estoque_maximo: p.estoqueMaximo,
  saldo_atual: p.saldoAtual,
  preco_medio: p.precoMedio,
  tipo: p.tipo,
  lead_time_dias: p.leadTimeDias,
  estoque_seguranca: p.estoqueSeguranca,
  reconstituicao_dias: p.validadePosReconstituicaoDias,
  refrigerado: p.refrigerado,
});

const fromDbProduto = (row: any): Produto => ({
  id: row.id,
  sku: row.sku,
  nome: row.nome,
  unidade: row.unidade || 'un',
  categoria: row.categoria || 'Geral',
  estoqueMinimo: row.estoque_minimo || 0,
  estoqueMaximo: row.estoque_maximo || 0,
  saldoAtual: row.saldo_atual || 0,
  precoMedio: row.preco_medio || 0,
  tipo: row.tipo || 'INSUMO',
  leadTimeDias: row.lead_time_dias || 7,
  estoqueSeguranca: row.estoque_seguranca || 0,
  validadePosReconstituicaoDias: row.reconstituicao_dias,
  refrigerado: row.refrigerado || false,
});

const toDbLote = (l: Lote) => ({
  id: l.id,
  id_produto: l.idProduto,
  numero_lote: l.numeroLote,
  data_validade: l.dataValidade,
  saldo_fechado: l.saldoFechado,
  saldo_em_uso: l.saldoEmUso,
  status: l.status,
  localizacao_fisica: l.localizacaoFisica,
  custo_entrada: l.custoEntrada,
});

const fromDbLote = (row: any): Lote => ({
  id: row.id,
  idProduto: row.id_produto,
  numeroLote: row.numero_lote,
  dataValidade: row.data_validade,
  saldoFechado: row.saldo_fechado,
  saldoEmUso: row.saldo_em_uso,
  status: row.status,
  localizacaoFisica: row.localizacao_fisica,
  custoEntrada: row.custo_entrada,
});

const toDbTransacao = (t: Transaction) => ({
  id: t.id,
  tipo: t.type,
  descricao: t.description,
  categoria: t.category,
  valor: t.amount,
  data: t.date,
  forma_pagamento: t.method,
  id_cliente: t.clientId,
  id_produto: t.productId,
});

const fromDbTransacao = (row: any): Transaction => ({
  id: row.id,
  type: row.tipo,
  description: row.descricao,
  category: row.categoria,
  amount: row.valor,
  date: row.data,
  method: row.forma_pagamento || 'pix',
  clientId: row.id_cliente,
  productId: row.id_produto,
});

const toDbFornecedor = (f: Fornecedor) => ({
  id: f.id,
  razao_social: f.razaoSocial,
  cnpj: f.cnpj,
});

const fromDbFornecedor = (row: any): Fornecedor => ({
  id: row.id,
  razaoSocial: row.razao_social,
  cnpj: row.cnpj,
});

const toDbFuncionario = (e: Employee) => ({
  id: e.id,
  nome: e.name,
  funcao: e.role,
  tipo_contrato: e.contractType,
  centro_custo: e.costCenter,
  data_admissao: e.admissionDate,
  status: e.status,
  salario_base: e.baseSalary,
  horas_mensais: e.monthlyHours,
  ferias_meses: e.vacationTakenMonths,
  componentes: JSON.stringify(e.components),
});

const fromDbFuncionario = (row: any): Employee => ({
  id: row.id,
  name: row.nome,
  role: row.funcao,
  contractType: row.tipo_contrato || 'CLT',
  costCenter: row.centro_custo || 'OPERACIONAL',
  admissionDate: row.data_admissao,
  status: row.status || 'ATIVO',
  baseSalary: row.salario_base || 0,
  monthlyHours: row.horas_mensais || 0,
  vacationTakenMonths: row.ferias_meses || 0,
  components: row.componentes ? JSON.parse(row.componentes) : [],
});

const toDbOrcamento = (q: Quote) => ({
  id: q.id,
  nome_cliente: q.clientName,
  status: q.status,
  materiais: JSON.stringify(q.materiais),
  mao_obra: JSON.stringify(q.maoObra),
  markup_pct: q.markupPct,
  tax_pct: q.taxPct,
  valido_ate: q.validUntil,
  id_cliente: q.idCliente,
  id_ficha: q.idFicha,
});

const fromDbOrcamento = (row: any): Quote => ({
  id: row.id,
  clientName: row.nome_cliente,
  status: row.status,
  materiais: row.materiais ? JSON.parse(row.materiais) : [],
  maoObra: row.mao_obra ? JSON.parse(row.mao_obra) : [],
  markupPct: row.markup_pct || 0,
  taxPct: row.tax_pct || 0,
  validUntil: row.valido_ate,
  createdAt: row.created_at,
  idCliente: row.id_cliente,
  idFicha: row.id_ficha,
});

// Função para carregar estado inicial
function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY_V2);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return buildSeed();
}

interface StoreApi {
  state: AppState;
  hydrated: boolean;
  cloudSynced: boolean;
  cloudError: string | null;
  addTransaction(tx: Omit<Transaction, "id">): Transaction;
  updateTransaction(id: string, patch: Partial<Transaction>): void;
  deleteTransaction(id: string): void;
  saveClient(c: Client): Result;
  deleteClient(id: string): Result;
  saveProduct(p: Produto): Result;
  deleteProduct(id: string): Result;
  saveFornecedor(f: Fornecedor): Result;
  deleteFornecedor(id: string): Result;
  saveEmployee(e: Employee): Result;
  deleteEmployee(id: string): Result;
  saveQuote(q: Quote): Result;
  deleteQuote(id: string): Result;
  resetData(): void;
  syncFromCloud(): Promise<void>;
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load);
  const [hydrated, setHydrated] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(!isSupabaseConfigured);
  const [cloudError, setCloudError] = useState<string | null>(null);

  // Sincroniza com Supabase ao carregar
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    
    (async () => {
      try {
        // Busca todos os dados do Supabase em paralelo
        const [produtos, lotes, transacoes, fornecedores, funcionarios, orcamentos] = await Promise.all([
          produtosRepo.findAll(),
          lotesRepo.findAll(),
          transacoesRepo.findAll(),
          fornecedoresRepo.findAll(),
          funcionariosRepo.findAll(),
          orcamentosRepo.findAll(),
        ]);

        setState((prev) => ({
          ...prev,
          produtos: produtos.map(fromDbProduto),
          lotes: lotes.map(fromDbLote),
          transactions: transacoes.map(fromDbTransacao),
          fornecedores: fornecedores.map(fromDbFornecedor),
          employees: funcionarios.map(fromDbFuncionario),
          quotes: orcamentos.map(fromDbOrcamento),
        }));

        setCloudSynced(true);
        setCloudError(null);
      } catch (e) {
        console.error('Erro ao sincronizar com Supabase:', e);
        setCloudError(e instanceof Error ? e.message : 'Falha ao sincronizar com a nuvem');
      }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setHydrated(true), 420);
    return () => clearTimeout(t);
  }, []);

  // Salva no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(KEY_V2, JSON.stringify(state));
    } catch { /* ignore */ }
  }, [state]);

  const api = useMemo<StoreApi>(() => {
    return {
      state,
      hydrated,
      cloudSynced,
      cloudError,

      addTransaction(tx) {
        const full = { ...tx, id: uid() };
        setState((prev) => ({ ...prev, transactions: [full, ...prev.transactions] }));
        
        // Salva no Supabase
        if (isSupabaseConfigured) {
          transacoesRepo.insert(toDbTransacao(full)).catch(console.error);
        }
        
        return full;
      },

      updateTransaction(id, patch) {
        setState((prev) => ({ ...prev, transactions: prev.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
        
        if (isSupabaseConfigured) {
          const updated = { ...state.transactions.find(t => t.id === id), ...patch } as Transaction;
          transacoesRepo.update(id, toDbTransacao(updated)).catch(console.error);
        }
      },

      deleteTransaction(id) {
        setState((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== id) }));
        
        if (isSupabaseConfigured) {
          transacoesRepo.delete(id).catch(console.error);
        }
      },

      saveClient(c) {
        setState((prev) => {
          const exists = prev.clients.some((x) => x.id === c.id);
          return { ...prev, clients: exists ? prev.clients.map((x) => (x.id === c.id ? c : x)) : [c, ...prev.clients] };
        });
        
        return { ok: true };
      },

      deleteClient(id) {
        setState((prev) => ({ ...prev, clients: prev.clients.filter((c) => c.id !== id) }));
        return { ok: true };
      },

      saveProduct(p) {
        setState((prev) => {
          const exists = prev.produtos.some((x) => x.id === p.id);
          return { ...prev, produtos: exists ? prev.produtos.map((x) => (x.id === p.id ? p : x)) : [p, ...prev.produtos] };
        });
        
        if (isSupabaseConfigured) {
          produtosRepo.upsert(toDbProduto(p)).catch(console.error);
        }
        
        return { ok: true };
      },

      deleteProduct(id) {
        setState((prev) => ({ ...prev, produtos: prev.produtos.filter((p) => p.id !== id) }));
        
        if (isSupabaseConfigured) {
          produtosRepo.delete(id).catch(console.error);
        }
        
        return { ok: true };
      },

      saveFornecedor(f) {
        setState((prev) => {
          const exists = prev.fornecedores.some((x) => x.id === f.id);
          return { ...prev, fornecedores: exists ? prev.fornecedores.map((x) => (x.id === f.id ? f : x)) : [f, ...prev.fornecedores] };
        });
        
        if (isSupabaseConfigured) {
          fornecedoresRepo.upsert(toDbFornecedor(f)).catch(console.error);
        }
        
        return { ok: true };
      },

      deleteFornecedor(id) {
        setState((prev) => ({ ...prev, fornecedores: prev.fornecedores.filter((f) => f.id !== id) }));
        
        if (isSupabaseConfigured) {
          fornecedoresRepo.delete(id).catch(console.error);
        }
        
        return { ok: true };
      },

      saveEmployee(e) {
        setState((prev) => {
          const exists = prev.employees.some((x) => x.id === e.id);
          return { ...prev, employees: exists ? prev.employees.map((x) => (x.id === e.id ? e : x)) : [e, ...prev.employees] };
        });
        
        if (isSupabaseConfigured) {
          funcionariosRepo.upsert(toDbFuncionario(e)).catch(console.error);
        }
        
        return { ok: true };
      },

      deleteEmployee(id) {
        setState((prev) => ({ ...prev, employees: prev.employees.filter((e) => e.id !== id) }));
        
        if (isSupabaseConfigured) {
          funcionariosRepo.delete(id).catch(console.error);
        }
        
        return { ok: true };
      },

      saveQuote(q) {
        setState((prev) => {
          const exists = prev.quotes.some((x) => x.id === q.id);
          return { ...prev, quotes: exists ? prev.quotes.map((x) => (x.id === q.id ? q : x)) : [q, ...prev.quotes] };
        });
        
        if (isSupabaseConfigured) {
          orcamentosRepo.upsert(toDbOrcamento(q)).catch(console.error);
        }
        
        return { ok: true };
      },

      deleteQuote(id) {
        setState((prev) => ({ ...prev, quotes: prev.quotes.filter((q) => q.id !== id) }));
        
        if (isSupabaseConfigured) {
          orcamentosRepo.delete(id).catch(console.error);
        }
        
        return { ok: true };
      },

      resetData() {
        setState(buildSeed());
      },

      async syncFromCloud() {
        if (!isSupabaseConfigured) return;
        
        try {
          const [produtos, lotes, transacoes, fornecedores, funcionarios, orcamentos] = await Promise.all([
            produtosRepo.findAll(),
            lotesRepo.findAll(),
            transacoesRepo.findAll(),
            fornecedoresRepo.findAll(),
            funcionariosRepo.findAll(),
            orcamentosRepo.findAll(),
          ]);

          setState((prev) => ({
            ...prev,
            produtos: produtos.map(fromDbProduto),
            lotes: lotes.map(fromDbLote),
            transactions: transacoes.map(fromDbTransacao),
            fornecedores: fornecedores.map(fromDbFornecedor),
            employees: funcionarios.map(fromDbFuncionario),
            quotes: orcamentos.map(fromDbOrcamento),
          }));

          setCloudError(null);
        } catch (e) {
          setCloudError(e instanceof Error ? e.message : 'Falha ao sincronizar');
        }
      },
    };
  }, [state, hydrated, cloudSynced, cloudError]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore deve ser usado dentro de StoreProvider");
  return ctx;
}
