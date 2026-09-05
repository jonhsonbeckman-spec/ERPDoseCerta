/* ============================================================
   Engine de estoque — PMP, FEFO, lotes, entradas e kardex.
   · Estoque NUNCA negativo (guard + rollback atômico)
   · PMP alterado SOMENTE por entradas (frete+seguro+tributos rateados)
   · Quarentena excluída do PMP e do FEFO
   · Reconstituição: validade dupla (fecha → em uso)
   ============================================================ */
import type { AppState, Lote, PedidoCompra } from "../../types";
import { addDays, fmtQtd, todayISO, uid } from "../utils";

export class DomainError extends Error {}

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const round4 = (n: number) => Math.round(n * 10000) / 10000;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/* ---------- lotes ---------- */
export const loteSaldo = (l: Lote) => round2(l.saldoFechado + l.saldoEmUso);

export const loteEfetiva = (l: Lote) =>
  l.validadePosReconstituicao && l.validadePosReconstituicao < l.dataValidade
    ? l.validadePosReconstituicao
    : l.dataValidade;

export const lotesAtivos = (s: AppState, idProduto: string) =>
  s.lotes.filter((l) => l.idProduto === idProduto && l.status === "ATIVO" && loteSaldo(l) > 0);

export const fefoSort = (ls: Lote[]) => [...ls].sort((a, b) => loteEfetiva(a).localeCompare(loteEfetiva(b)));

export const fefoLote = (s: AppState, idProduto: string): Lote | null =>
  fefoSort(lotesAtivos(s, idProduto))[0] ?? null;

export const saldoAtivo = (s: AppState, idProduto: string) =>
  round2(lotesAtivos(s, idProduto).reduce((a, l) => a + loteSaldo(l), 0));

export const reconstituivel = (p: { validadePosReconstituicaoDias?: number }) =>
  p.validadePosReconstituicaoDias != null;

/* ---------- PMP ---------- */
export const calcPMP = (saldoAnt: number, pmpAnt: number, qtd: number, custo: number, extrasRateados = 0) =>
  saldoAnt + qtd <= 0 ? custo : (saldoAnt * pmpAnt + qtd * custo + extrasRateados) / (saldoAnt + qtd);

/* ---------- entrada (compra / NF) ---------- */
export interface EntradaItemInput {
  idProduto: string;
  qtd: number;
  custoUnit: number;
  numeroLote: string;
  dataValidade: string;
  localizacao?: string;
}

export function registrarEntrada(
  s: AppState,
  args: {
    itens: EntradaItemInput[];
    idFornecedor: string;
    idPedido?: string;
    numeroNota: string;
    dataEntrada: string;
    valorFrete: number;
    valorSeguro?: number;
    valorOutros?: number;
    rotulo?: string;
  },
): { state: AppState; lotesPorProduto: Record<string, string> } {
  const { itens, idFornecedor, idPedido, numeroNota, dataEntrada, valorFrete } = args;
  const custosExtras = (args.valorFrete || 0) + (args.valorSeguro || 0) + (args.valorOutros || 0);
  const rotulo = args.rotulo ?? "NF";
  if (!itens.length) throw new DomainError("Adicione ao menos um item à entrada.");

  const n = clone(s);
  const forn = n.fornecedores.find((f) => f.id === idFornecedor);
  if (!forn) throw new DomainError("Fornecedor não encontrado.");

  let pedido: PedidoCompra | undefined;
  if (idPedido) {
    pedido = n.pedidos.find((p) => p.id === idPedido);
    if (!pedido) throw new DomainError("Pedido não encontrado.");
    if (pedido.status === "ENCERRADO") throw new DomainError("Pedido já encerrado.");
  }

  const baseTotal = itens.reduce((a, it) => a + it.qtd * it.custoUnit, 0);
  const lotesPorProduto: Record<string, string> = {};

  for (const it of itens) {
    const p = n.produtos.find((x) => x.id === it.idProduto);
    if (!p) throw new DomainError("Produto não encontrado na entrada.");
    if (it.qtd <= 0) throw new DomainError(`Quantidade inválida para ${p.nome}.`);
    if (it.custoUnit < 0) throw new DomainError(`Custo inválido para ${p.nome}.`);
    if (!it.dataValidade) throw new DomainError(`Informe a validade do lote de ${p.nome}.`);

    if (pedido) {
      const pi = pedido.itens.find((x) => x.idProduto === it.idProduto);
      if (!pi) throw new DomainError(`${p.nome} não faz parte do pedido.`);
      const restante = round2(pi.qtd - pi.qtdRecebida);
      if (it.qtd > restante + 1e-9)
        throw new DomainError(`Recebimento acima do pedido para ${p.nome} — restam ${fmtQtd(restante, p.unidade)}.`);
      pi.qtdRecebida = round2(pi.qtdRecebida + it.qtd);
    }

    // rateio proporcional de frete+seguro+tributos → custo landed do lote
    const rateio = baseTotal > 0 ? (custosExtras * (it.qtd * it.custoUnit)) / baseTotal : 0;
    const landed = round4(it.custoUnit + rateio / it.qtd);

    const saldoAntes = saldoAtivo(n, p.id);
    p.precoMedio = round4(calcPMP(saldoAntes, p.precoMedio, it.qtd, it.custoUnit, rateio));
    p.saldoAtual = round2(p.saldoAtual + it.qtd);
    p.ultimaCompra = dataEntrada;

    const lote: Lote = {
      id: uid(),
      idProduto: p.id,
      numeroLote: it.numeroLote.trim() || `SN-${p.sku}`,
      dataValidade: it.dataValidade,
      saldoFechado: it.qtd,
      saldoEmUso: 0,
      status: "ATIVO",
      localizacaoFisica: it.localizacao?.trim() || (p.refrigerado ? "Geladeira 2–8 °C" : "Armário"),
      custoEntrada: landed,
    };
    n.lotes.push(lote);
    lotesPorProduto[p.id] = lote.id;

    n.movimentacoes.unshift({
      id: uid(),
      idProduto: p.id,
      idLote: lote.id,
      tipo: "E",
      quantidade: it.qtd,
      valorUnitario: landed,
      saldoAposMov: p.saldoAtual,
      documentoRef: `${rotulo} ${numeroNota}`,
      criadoEm: `${dataEntrada}T12:00:00`,
    });
  }

  if (pedido) {
    pedido.status = pedido.itens.every((i) => i.qtdRecebida >= i.qtd - 1e-9) ? "ENCERRADO" : "PARCIAL";
  }

  n.entradas.unshift({
    id: uid(),
    idPedido: idPedido ?? "",
    idFornecedor,
    numeroNota,
    dataEntrada,
    valorFrete,
    valorSeguro: args.valorSeguro,
    valorOutros: args.valorOutros,
  });

  // separação contábil: só materiais → Insumos (custo indireto); com fármaco → Reposição
  const todosIns = itens.every((it) => n.produtos.find((p) => p.id === it.idProduto)?.tipo !== "FARMACO");
  n.transactions.unshift({
    id: uid(),
    type: "despesa",
    description: `Entrada ${rotulo} ${numeroNota} — ${forn.razaoSocial}`,
    category: todosIns ? "Insumos" : "Reposição de estoque",
    amount: round2(baseTotal + custosExtras),
    date: dataEntrada,
    method: "pix",
  });

  return { state: n, lotesPorProduto };
}

/* ---------- saída FEFO (atômica, nunca negativa) ---------- */
export function darBaixa(
  s: AppState,
  args: {
    idProduto: string;
    qtd: number;
    idLote?: string;
    idPaciente?: string;
    idProfissional?: string;
    documentoRef?: string;
    data?: string;
  },
): AppState {
  const { idProduto, qtd, idLote, idPaciente, idProfissional, documentoRef, data } = args;
  const p0 = s.produtos.find((x) => x.id === idProduto);
  if (!p0) throw new DomainError("Produto não encontrado.");
  if (qtd <= 0) throw new DomainError("Quantidade de baixa inválida.");

  const n = clone(s);
  const p = n.produtos.find((x) => x.id === idProduto)!;
  const ehReconst = reconstituivel(p);

  let pool: Lote[];
  if (idLote) {
    const l = n.lotes.find((x) => x.id === idLote);
    if (!l || l.idProduto !== idProduto) throw new DomainError(`Lote inválido para ${p.nome}.`);
    if (l.status !== "ATIVO")
      throw new DomainError(`Lote ${l.numeroLote} está em ${l.status.toLowerCase()} — baixa bloqueada.`);
    pool = [l];
  } else {
    pool = fefoSort(lotesAtivos(n, idProduto));
    if (ehReconst) pool = pool.filter((l) => l.saldoEmUso > 0);
  }

  type Seg = { l: Lote; campo: "saldoFechado" | "saldoEmUso"; disp: number };
  const segs: Seg[] = [];
  for (const l of pool) {
    if (ehReconst) {
      if (l.saldoEmUso > 0) segs.push({ l, campo: "saldoEmUso", disp: l.saldoEmUso });
    } else {
      if (l.saldoFechado > 0) segs.push({ l, campo: "saldoFechado", disp: l.saldoFechado });
      if (l.saldoEmUso > 0) segs.push({ l, campo: "saldoEmUso", disp: l.saldoEmUso });
    }
  }

  const total = segs.reduce((a, x) => a + x.disp, 0);
  if (total + 1e-9 < qtd)
    throw new DomainError(
      `Saldo insuficiente de ${p.nome}: necessário ${fmtQtd(qtd, p.unidade)}, disponível ${fmtQtd(total, p.unidade)}.`,
    );

  const date = data ?? todayISO();
  let rest = qtd;
  for (const seg of segs) {
    if (rest <= 1e-9) break;
    const take = round2(Math.min(seg.disp, rest));
    seg.l[seg.campo] = round2(seg.l[seg.campo] - take);
    p.saldoAtual = round2(p.saldoAtual - take);
    n.movimentacoes.unshift({
      id: uid(),
      idProduto: p.id,
      idLote: seg.l.id,
      tipo: "S",
      quantidade: take,
      valorUnitario: p.precoMedio,
      saldoAposMov: p.saldoAtual,
      idPaciente,
      idProfissional,
      documentoRef,
      criadoEm: `${date}T12:00:00`,
    });
    rest = round2(rest - take);
  }
  return n;
}

/* ---------- reconstituição (validade dupla) ---------- */
export function reconstituirLote(s: AppState, args: { idLote: string; dias: number; dataRef?: string }): AppState {
  const n = clone(s);
  const l = n.lotes.find((x) => x.id === args.idLote);
  if (!l) throw new DomainError("Lote não encontrado.");
  if (l.status !== "ATIVO") throw new DomainError("Somente lotes ativos podem ser reconstituídos.");
  if (l.saldoFechado <= 0) throw new DomainError("Lote sem saldo fechado para reconstituir.");
  const p = n.produtos.find((x) => x.id === l.idProduto);
  if (!p || !reconstituivel(p)) throw new DomainError("Produto não reconstituível.");
  if (args.dias <= 0) throw new DomainError("Validade pós-reconstituição inválida.");
  const ref = args.dataRef ?? todayISO();
  l.dataReconstituicao = ref;
  l.validadePosReconstituicao = addDays(ref, args.dias);
  l.saldoEmUso = round2(l.saldoEmUso + l.saldoFechado);
  l.saldoFechado = 0;
  return n;
}

/* ---------- status de lote ---------- */
export function setQuarentena(s: AppState, args: { idLote: string; motivo: string }): AppState {
  if (!args.motivo.trim()) throw new DomainError("Informe o motivo da quarentena.");
  const n = clone(s);
  const l = n.lotes.find((x) => x.id === args.idLote);
  if (!l) throw new DomainError("Lote não encontrado.");
  if (l.status === "DESCARTADO") throw new DomainError("Lote descartado não pode entrar em quarentena.");
  l.status = "QUARENTENA";
  l.motivoQuarentena = args.motivo.trim();
  return n;
}

export function liberarLote(s: AppState, args: { idLote: string }): AppState {
  const n = clone(s);
  const l = n.lotes.find((x) => x.id === args.idLote);
  if (!l) throw new DomainError("Lote não encontrado.");
  if (l.status !== "QUARENTENA") throw new DomainError("Lote não está em quarentena.");
  l.status = "ATIVO";
  l.motivoQuarentena = undefined;
  return n;
}

export function descartarLote(s: AppState, args: { idLote: string; motivo: string; data?: string }): AppState {
  if (!args.motivo.trim()) throw new DomainError("Informe o motivo do descarte.");
  const n = clone(s);
  const l = n.lotes.find((x) => x.id === args.idLote);
  if (!l) throw new DomainError("Lote não encontrado.");
  if (l.status === "DESCARTADO") throw new DomainError("Lote já descartado.");
  const p = n.produtos.find((x) => x.id === l.idProduto)!;
  const resto = loteSaldo(l);
  if (resto > 0) {
    p.saldoAtual = round2(p.saldoAtual - resto);
    n.movimentacoes.unshift({
      id: uid(), idProduto: p.id, idLote: l.id, tipo: "PERDA", quantidade: resto,
      valorUnitario: p.precoMedio, saldoAposMov: p.saldoAtual,
      documentoRef: `Descarte: ${args.motivo.trim()}`, criadoEm: `${args.data ?? todayISO()}T12:00:00`,
    });
  }
  l.saldoFechado = 0;
  l.saldoEmUso = 0;
  l.status = "DESCARTADO";
  l.motivoQuarentena = undefined;
  return n;
}

export function ajustarLote(
  s: AppState,
  args: { idLote: string; campo: "saldoFechado" | "saldoEmUso"; novoSaldo: number; tipo: "AJUSTE" | "PERDA"; motivo: string; data?: string },
): AppState {
  if (!args.motivo.trim()) throw new DomainError("Informe o motivo do ajuste.");
  if (args.novoSaldo < 0) throw new DomainError("Saldo não pode ser negativo.");
  const n = clone(s);
  const l = n.lotes.find((x) => x.id === args.idLote);
  if (!l) throw new DomainError("Lote não encontrado.");
  if (l.status === "DESCARTADO") throw new DomainError("Lote descartado não pode ser ajustado.");
  const p = n.produtos.find((x) => x.id === l.idProduto)!;
  const atual = args.campo === "saldoFechado" ? l.saldoFechado : l.saldoEmUso;
  const delta = round2(args.novoSaldo - atual);
  if (Math.abs(delta) < 1e-9) throw new DomainError("O novo saldo é igual ao atual.");
  l[args.campo] = round2(atual + delta);
  p.saldoAtual = round2(p.saldoAtual + delta);
  n.movimentacoes.unshift({
    id: uid(), idProduto: p.id, idLote: l.id, tipo: args.tipo, quantidade: Math.abs(delta),
    valorUnitario: p.precoMedio, saldoAposMov: p.saldoAtual,
    documentoRef: `${args.tipo === "PERDA" ? "Perda" : "Ajuste"}: ${args.motivo.trim()}`,
    criadoEm: `${args.data ?? todayISO()}T12:00:00`,
  });
  return n;
}
