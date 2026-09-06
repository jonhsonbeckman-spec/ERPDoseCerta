/* ============================================================
   Baixa automática por ficha técnica (kit de aplicação):
   · MATERIAL_APOIO  → FEFO automática
   · INSUMO_PRINCIPAL → lote rastreável por paciente (Lote+Validade+CPF)
   · Atômico: qualquer falta aborta tudo
   · Na entrega: receita + custo do serviço (regime de competência)
   ============================================================ */
import type { AppState, FichaTecnica, ItemFichaTecnica, Lote, PayMethod, Produto } from "../../types";
import { fmtQtd, uid } from "../utils";
import { darBaixa, fefoLote, fefoSort, loteSaldo, lotesAtivos, reconstituivel, reconstituirLote, round2 } from "./engine";

export interface KitLinha {
  item: ItemFichaTecnica;
  produto: Produto;
  lote: Lote | null;
  seraReconstituido: boolean;
  disponivel: number;
  necessario: number;
  falta: boolean;
  motivo?: string;
}

export const getFicha = (s: AppState, idFicha: string): FichaTecnica | undefined =>
  s.fichas.find((f) => f.id === idFicha);

export function kitCheck(s: AppState, idFicha: string, lotesEscolhidos: Record<string, string> = {}, reconst: Record<string, boolean> = {}) {
  const ficha = getFicha(s, idFicha);
  if (!ficha) return { linhas: [] as KitLinha[], faltas: ["Ficha técnica não encontrada."] };

  const linhas: KitLinha[] = ficha.itens.map((item) => {
    const produto = s.produtos.find((p) => p.id === item.idProduto);
    if (!produto)
      return { item, produto: null as unknown as Produto, lote: null, seraReconstituido: false, disponivel: 0, necessario: item.quantidadeNecessaria, falta: true, motivo: "Produto removido do cadastro." };
    const qtd = item.quantidadeNecessaria;

    if (item.tipoConsumo === "MATERIAL_APOIO") {
      const lote = fefoLote(s, produto.id);
      const disponivel = round2(lotesAtivos(s, produto.id).reduce((a, l) => a + loteSaldo(l), 0));
      return { item, produto, lote, seraReconstituido: false, disponivel, necessario: qtd, falta: disponivel + 1e-9 < qtd, motivo: disponivel + 1e-9 < qtd ? "Estoque insuficiente para o material de apoio." : undefined };
    }

    const ativos = fefoSort(lotesAtivos(s, produto.id));
    let lote: Lote | null = lotesEscolhidos[produto.id] ? ativos.find((l) => l.id === lotesEscolhidos[produto.id]) ?? null : null;
    let seraReconstituido = false;
    let disponivel = 0;

    if (reconstituivel(produto)) {
      if (!lote) lote = ativos.find((l) => l.saldoEmUso + 1e-9 >= qtd) ?? ativos.find((l) => l.saldoEmUso > 0) ?? ativos[0] ?? null;
      if (lote) {
        const vaiReconst = lote.saldoEmUso + 1e-9 < qtd && (reconst[produto.id] ?? true);
        seraReconstituido = vaiReconst && lote.saldoFechado > 0;
        disponivel = seraReconstituido ? round2(lote.saldoEmUso + lote.saldoFechado) : lote.saldoEmUso;
      }
    } else {
      if (!lote) lote = fefoLote(s, produto.id);
      if (lote) disponivel = loteSaldo(lote);
    }

    const falta = !lote || disponivel + 1e-9 < qtd;
    const motivo = !lote
      ? `Nenhum lote ativo de ${produto.nome}.`
      : falta
        ? `Saldo do lote insuficiente (${fmtQtd(disponivel, produto.unidade)} < ${fmtQtd(qtd, produto.unidade)}).`
        : undefined;
    return { item, produto, lote, seraReconstituido, disponivel, necessario: qtd, falta, motivo };
  });

  return { linhas, faltas: linhas.filter((l) => l.falta).map((l) => l.motivo ?? "Item indisponível.") };
}

export function executarKit(
  s: AppState,
  args: {
    idCliente: string;
    idFicha: string;
    data: string;
    valor: number;
    metodo: PayMethod;
    lotesEscolhidos?: Record<string, string>;
    reconst?: Record<string, boolean>;
    idAlocacao?: string;
    idProfissional?: string;
  },
): { state: AppState; faltas: string[] } {
  const ficha = getFicha(s, args.idFicha);
  const cliente = s.clients.find((c) => c.id === args.idCliente);
  if (!ficha) return { state: s, faltas: ["Ficha técnica não encontrada."] };
  if (!cliente) return { state: s, faltas: ["Paciente não encontrado."] };
  if (args.valor <= 0) return { state: s, faltas: ["Valor da aplicação inválido."] };

  const check = kitCheck(s, args.idFicha, args.lotesEscolhidos, args.reconst);
  if (check.faltas.length) return { state: s, faltas: check.faltas };

  let n: AppState = JSON.parse(JSON.stringify(s));
  try {
    for (const linha of check.linhas) {
      if (linha.seraReconstituido && linha.lote)
        n = reconstituirLote(n, { idLote: linha.lote.id, dias: linha.produto.validadePosReconstituicaoDias ?? 28, dataRef: args.data });
    }
    for (const linha of check.linhas) {
      n = darBaixa(n, {
        idProduto: linha.produto.id,
        qtd: linha.necessario,
        idLote: linha.lote?.id,
        idPaciente: args.idCliente,
        idProfissional: args.idProfissional,
        documentoRef: `KIT: ${ficha.nome}`,
        data: args.data,
      });
    }
  } catch (e) {
    return { state: s, faltas: [e instanceof Error ? e.message : "Falha na baixa do kit."] };
  }

  // na entrega: receita do serviço + custo dos insumos baixados (CMV)
  const principal = check.linhas.find((l) => l.item.tipoConsumo === "INSUMO_PRINCIPAL");
  n.transactions.unshift({
    id: uid(), type: "receita", description: `Aplicação — ${cliente.name}`, category: "Aplicação",
    amount: round2(args.valor), date: args.data, method: args.metodo, clientId: cliente.id, productId: principal?.produto.id,
  });
  const custoInsumos = round2(check.linhas.reduce((a, l) => a + l.necessario * l.produto.precoMedio, 0));
  if (custoInsumos > 0) {
    n.transactions.unshift({
      id: uid(), type: "despesa", description: `CMV aplicação — ${cliente.name}`, category: "Custo do serviço prestado",
      amount: custoInsumos, date: args.data, method: "pix", clientId: cliente.id,
    });
  }
  n.clients = n.clients.map((c) => (c.id === cliente.id ? { ...c, lastApplication: args.data } : c));
  if (args.idAlocacao) n.alocacoes = n.alocacoes.filter((a) => a.id !== args.idAlocacao);

  return { state: n, faltas: [] };
}
