/* ============================================================
   Analítica: ponto de pedido, estoque virtual, curva ABC,
   valoração, alertas e CMV.
   ============================================================ */
import type { AppState, Lote, Produto, ProdutoTipo } from "../../types";
import { dOffset, diffDays, monthKey, monthShort, shiftMonth, todayISO } from "../utils";
import { loteEfetiva, loteSaldo, round2 } from "./engine";

const dataMov = (criadoEm: string) => criadoEm.slice(0, 10);

export const consumoMedioDiario = (s: AppState, idProduto: string, dias = 30) => {
  const corte = dOffset(-dias);
  const q = s.movimentacoes
    .filter((m) => m.idProduto === idProduto && m.tipo === "S" && dataMov(m.criadoEm) >= corte)
    .reduce((a, m) => a + m.quantidade, 0);
  return q / dias;
};

export const pontoPedido = (p: Produto, cmd: number) => round2(cmd * p.leadTimeDias + p.estoqueSeguranca);

export const alocadoProduto = (s: AppState, idProduto: string) => {
  let total = 0;
  for (const a of s.alocacoes) {
    const ficha = s.fichas.find((f) => f.id === a.idFicha);
    if (!ficha) continue;
    for (const it of ficha.itens) if (it.idProduto === idProduto) total += it.quantidadeNecessaria;
  }
  return round2(total);
};

export interface Disponibilidade {
  produto: Produto;
  fisico: number;
  alocado: number;
  disponivel: number;
  cmd: number;
  pp: number;
  status: "ok" | "repor" | "critico";
}

export const disponibilidade = (s: AppState): Disponibilidade[] =>
  s.produtos
    .filter((p) => p.tipo !== "SERVICO")
    .map((p) => {
      const fisico = p.saldoAtual;
      const alocado = alocadoProduto(s, p.id);
      const disponivel = round2(fisico - alocado);
      const cmd = consumoMedioDiario(s, p.id);
      const pp = pontoPedido(p, cmd);
      const status: Disponibilidade["status"] =
        disponivel <= 0 || disponivel < p.estoqueMinimo ? "critico" : disponivel < pp ? "repor" : "ok";
      return { produto: p, fisico, alocado, disponivel, cmd, pp, status };
    })
    .sort((a, b) => (a.status === b.status ? a.produto.nome.localeCompare(b.produto.nome) : a.status === "critico" ? -1 : b.status === "critico" ? 1 : a.status === "repor" ? -1 : 1));

export interface AlertaLote {
  lote: Lote;
  produto: Produto;
  tipo: "vencido" | "vence30" | "quarentena";
  dias: number;
}

export const alertasLotes = (s: AppState): AlertaLote[] => {
  const hoje = dOffset(0);
  const out: AlertaLote[] = [];
  for (const l of s.lotes) {
    const p = s.produtos.find((x) => x.id === l.idProduto);
    if (!p) continue;
    if (l.status === "QUARENTENA") {
      out.push({ lote: l, produto: p, tipo: "quarentena", dias: diffDays(hoje, loteEfetiva(l)) });
      continue;
    }
    if (l.status !== "ATIVO" || loteSaldo(l) <= 0) continue;
    const d = diffDays(hoje, loteEfetiva(l));
    if (d < 0) out.push({ lote: l, produto: p, tipo: "vencido", dias: d });
    else if (d <= 30) out.push({ lote: l, produto: p, tipo: "vence30", dias: d });
  }
  const peso = { vencido: 0, quarentena: 1, vence30: 2 } as const;
  return out.sort((a, b) => peso[a.tipo] - peso[b.tipo] || a.dias - b.dias);
};

export interface ABCRow {
  produto: Produto;
  qtd30: number;
  valor30: number;
  pct: number;
  acum: number;
  classe: "A" | "B" | "C";
}

export const curvaABC = (s: AppState): ABCRow[] => {
  const corte = dOffset(-30);
  const rows = s.produtos
    .map((p) => {
      const qtd30 = s.movimentacoes
        .filter((m) => m.tipo === "S" && m.idProduto === p.id && dataMov(m.criadoEm) >= corte)
        .reduce((a, m) => a + m.quantidade, 0);
      return { produto: p, qtd30, valor30: round2(qtd30 * p.precoMedio) };
    })
    .filter((r) => r.valor30 > 0)
    .sort((a, b) => b.valor30 - a.valor30);
  const total = rows.reduce((a, r) => a + r.valor30, 0) || 1;
  let acum = 0;
  return rows.map((r) => {
    const pct = (r.valor30 / total) * 100;
    acum += pct;
    return { ...r, pct, acum, classe: (acum <= 70 ? "A" : acum <= 90 ? "B" : "C") as "A" | "B" | "C" };
  });
};

export interface ValoracaoLinha {
  produto: Produto;
  saldo: number;
  pmp: number;
  total: number;
}

export const valoracao = (s: AppState) => {
  const linhas: ValoracaoLinha[] = s.produtos
    .filter((p) => p.tipo !== "SERVICO")
    .map((p) => ({ produto: p, saldo: p.saldoAtual, pmp: p.precoMedio, total: round2(p.saldoAtual * p.precoMedio) }))
    .sort((a, b) => b.total - a.total);
  const total = round2(linhas.reduce((a, l) => a + l.total, 0));
  const porTipo: Record<ProdutoTipo, number> = { FARMACO: 0, INSUMO: 0, SERVICO: 0 };
  for (const l of linhas) porTipo[l.produto.tipo] = round2(porTipo[l.produto.tipo] + l.total);
  return { linhas, total, porTipo };
};

export const resumoEstoque = (s: AppState) => {
  const alertas = alertasLotes(s);
  const disp = disponibilidade(s);
  return {
    valorTotal: valoracao(s).total,
    quarentena: alertas.filter((a) => a.tipo === "quarentena").length,
    vencendo: alertas.filter((a) => a.tipo !== "quarentena").length,
    abaixoPP: disp.filter((d) => d.status !== "ok").length,
    alertas,
    disp,
  };
};

/** CMV do mês = saídas × custo médio na baixa */
export const cmvDoMes = (s: AppState, month: string) =>
  round2(
    s.movimentacoes
      .filter((m) => m.tipo === "S" && m.criadoEm.slice(0, 7) === month)
      .reduce((a, m) => a + m.quantidade * (m.valorUnitario ?? 0), 0),
  );

export interface CMVRow {
  key: string;
  label: string;
  receita: number;
  cmv: number;
  lucro: number;
  margemPct: number;
}

export const cmvMensal = (s: AppState, months = 6): CMVRow[] => {
  const now = monthKey(todayISO());
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) keys.push(shiftMonth(now, -i));
  return keys.map((key) => {
    const cmv = cmvDoMes(s, key);
    const receita = s.transactions
      .filter((t) => t.type === "receita" && monthKey(t.date) === key)
      .reduce((a, t) => a + t.amount, 0);
    const lucro = receita - cmv;
    return { key, label: monthShort(key), receita: round2(receita), cmv, lucro: round2(lucro), margemPct: receita > 0 ? (lucro / receita) * 100 : 0 };
  });
};
