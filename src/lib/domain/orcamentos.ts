/* ============================================================
   Orçamentos: precificação (markup por dentro) e aprovação
   que gera paciente + protocolo. Baixa e contabilização
   acontecem somente na aplicação (entrega do serviço).
   ============================================================ */
import type { AppState, QuoteLabor, QuoteMaterial } from "../../types";
import { round2, todayISO, uid } from "../utils";

export interface QuotePricing {
  materialsCost: number;
  laborCost: number;
  directCost: number;
  taxAmount: number;
  profit: number;
  finalPrice: number;
}

/** Preço Final = Custo Direto ÷ (1 − (margem% + impostos%)) */
export function calculateQuotePricing(
  materiais: QuoteMaterial[],
  maoObra: QuoteLabor[],
  markupPct: number,
  taxPct: number,
): QuotePricing {
  const materialsCost = round2(materiais.reduce((a, m) => a + m.totalMaterialCost, 0));
  const laborCost = round2(maoObra.reduce((a, l) => a + l.totalLaborCost, 0));
  const directCost = round2(materialsCost + laborCost);
  const divisor = 1 - (markupPct + taxPct) / 100;
  const finalPrice = divisor <= 0 ? 0 : round2(directCost / divisor);
  const taxAmount = round2((finalPrice * taxPct) / 100);
  const profit = round2(finalPrice - directCost - taxAmount);
  return { materialsCost, laborCost, directCost, taxAmount, profit, finalPrice };
}

export function approveQuote(
  s: AppState,
  quoteId: string,
): { ok: boolean; state?: AppState; faltas: string[]; clientName?: string } {
  const quote = s.quotes.find((q) => q.id === quoteId);
  if (!quote) return { ok: false, faltas: ["Orçamento não encontrado."] };
  if (quote.status === "APPROVED") return { ok: false, faltas: ["Este orçamento já foi aprovado."] };
  if (quote.status !== "PENDING_APPROVAL")
    return { ok: false, faltas: ["Somente orçamentos aguardando aprovação podem ser aprovados."] };
  if (!quote.clientName.trim()) return { ok: false, faltas: ["Informe o nome do cliente."] };

  const pricing = calculateQuotePricing(quote.materiais, quote.maoObra, quote.markupPct, quote.taxPct);

  const n: AppState = JSON.parse(JSON.stringify(s));

  // 1. protocolo (ficha técnica) a partir dos insumos do orçamento
  const fichaId = uid();
  n.fichas.unshift({
    id: fichaId,
    nome: `Protocolo — ${quote.clientName.trim()}`,
    tipo: "Orçamento aprovado",
    precoVenda: pricing.finalPrice,
    ativo: true,
    itens: quote.materiais.map((m) => ({
      id: uid(),
      idProduto: m.idProduto,
      quantidadeNecessaria: m.quantity,
      unidadeConsumo: n.produtos.find((p) => p.id === m.idProduto)?.unidade ?? "un",
      tipoConsumo: "INSUMO_PRINCIPAL" as const,
    })),
  });

  // 2. novo paciente vinculado ao protocolo
  const clienteId = uid();
  const principal = quote.materiais[0];
  n.clients.push({
    id: clienteId,
    name: quote.clientName.trim(),
    phone: "",
    cpf: "",
    fichaTecnicaId: fichaId,
    productId: principal?.idProduto ?? "",
    frequencyDays: 7,
    lastApplication: todayISO(),
    notes: "",
    active: true,
    since: todayISO(),
  });

  // 3. orçamento aprovado + vínculos
  n.quotes = n.quotes.map((q) =>
    q.id === quoteId ? { ...q, status: "APPROVED" as const, idCliente: clienteId, idFicha: fichaId } : q,
  );

  return { ok: true, state: n, faltas: [], clientName: quote.clientName.trim() };
}
