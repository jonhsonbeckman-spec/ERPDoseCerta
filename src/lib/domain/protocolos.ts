/* ============================================================
   Protocolos comprados: sequência de doses + baixa automática
   por dose (fármaco + materiais) + contabilização na entrega.
   ============================================================ */
import type { AppState, Dose, PayMethod, Protocolo, ProtocoloFarma, ServicoAplicacao } from "../../types";
import { addDays, fmtQtd, uid } from "../utils";
import { darBaixa, fefoLote, reconstituivel, reconstituirLote, round2 } from "./engine";

export const gerarDoses = (farmacos: Pick<ProtocoloFarma, "idProduto" | "qtdDoses" | "qtdPorDose">[], dataInicio: string, intervaloDias: number): Dose[] => {
  const total = farmacos.reduce((a, f) => a + f.qtdDoses, 0);
  const seq: { idProduto: string; qtd: number }[] = [];
  for (const f of farmacos) for (let i = 0; i < f.qtdDoses; i++) seq.push({ idProduto: f.idProduto, qtd: f.qtdPorDose });
  return seq.map((d, i) => ({
    id: uid(),
    numero: i + 1,
    idProduto: d.idProduto,
    qtd: d.qtd,
    data: addDays(dataInicio, i * intervaloDias),
    status: "AGENDADA" as const,
  })).slice(0, total);
};

export interface AplicarDoseArgs {
  idProtocolo: string;
  idDose: string;
  data: string;
  valor: number;
  metodo: PayMethod;
  idProfissional?: string;
  localAplicacao: string;
  observacoes: string;
}

export function aplicarDose(
  s: AppState,
  args: AplicarDoseArgs,
): { state: AppState; faltas: string[]; servico?: ServicoAplicacao } {
  const proto = s.protocolos.find((p) => p.id === args.idProtocolo);
  if (!proto) return { state: s, faltas: ["Protocolo não encontrado."] };
  const dose = proto.doses.find((d) => d.id === args.idDose);
  if (!dose) return { state: s, faltas: ["Dose não encontrada."] };
  if (dose.status === "APLICADA") return { state: s, faltas: ["Esta dose já foi aplicada."] };
  const cliente = s.clients.find((c) => c.id === proto.idCliente);
  if (!cliente) return { state: s, faltas: ["Paciente não encontrado."] };
  if (args.valor <= 0) return { state: s, faltas: ["Valor da aplicação inválido."] };

  const faltas: string[] = [];
  const produto = s.produtos.find((p) => p.id === dose.idProduto);
  if (!produto) faltas.push("Fármaco da dose não encontrado.");
  else {
    const lote = fefoLote(s, dose.idProduto);
    if (!lote) faltas.push(`${produto.nome}: nenhum lote ativo com saldo.`);
  }
  for (const m of proto.materiais) {
    const pm = s.produtos.find((p) => p.id === m.idProduto);
    if (!pm) continue;
    if (!fefoLote(s, m.idProduto)) faltas.push(`${pm.nome}: sem saldo em estoque.`);
  }
  if (faltas.length) return { state: s, faltas };

  let n: AppState = JSON.parse(JSON.stringify(s));
  const insumos: string[] = [];
  try {
    // fármaco: reconstitui se precisar e der baixa do frasco em uso
    if (produto && reconstituivel(produto)) {
      const lote = fefoLote(n, produto.id)!;
      if (lote.saldoEmUso + 1e-9 < dose.qtd && lote.saldoFechado > 0)
        n = reconstituirLote(n, { idLote: lote.id, dias: produto.validadePosReconstituicaoDias ?? 28, dataRef: args.data });
    }
    if (produto) {
      n = darBaixa(n, { idProduto: produto.id, qtd: dose.qtd, idPaciente: cliente.id, idProfissional: args.idProfissional, documentoRef: `PROTOCOLO ${proto.nome} · dose ${dose.numero}/${proto.doses.length}`, data: args.data });
      insumos.push(`${produto.nome} ${fmtQtd(dose.qtd, produto.unidade)}`);
    }
    for (const m of proto.materiais) {
      const pm = n.produtos.find((p) => p.id === m.idProduto);
      if (!pm) continue;
      n = darBaixa(n, { idProduto: pm.id, qtd: m.qtd, idPaciente: cliente.id, idProfissional: args.idProfissional, documentoRef: `PROTOCOLO ${proto.nome} · dose ${dose.numero}/${proto.doses.length}`, data: args.data });
      insumos.push(`${pm.nome} ${fmtQtd(m.qtd, pm.unidade)}`);
    }
  } catch (e) {
    return { state: s, faltas: [e instanceof Error ? e.message : "Falha na baixa dos insumos."] };
  }

  // contabilização na entrega: receita do serviço + custo dos insumos
  n.transactions.unshift({
    id: uid(), type: "receita", description: `Aplicação dose ${dose.numero} — ${cliente.name}`, category: "Aplicação",
    amount: round2(args.valor), date: args.data, method: args.metodo, clientId: cliente.id, productId: dose.idProduto,
  });
  const custoInsumos = round2(
    (produto ? dose.qtd * produto.precoMedio : 0) +
      proto.materiais.reduce((a, m) => {
        const pm = n.produtos.find((p) => p.id === m.idProduto);
        return a + (pm ? m.qtd * pm.precoMedio : 0);
      }, 0),
  );
  if (custoInsumos > 0)
    n.transactions.unshift({
      id: uid(), type: "despesa", description: `CMV dose ${dose.numero} — ${cliente.name}`, category: "Custo do serviço prestado",
      amount: custoInsumos, date: args.data, method: "pix", clientId: cliente.id,
    });

  const protoN = n.protocolos.find((p) => p.id === proto.id)!;
  protoN.doses = protoN.doses.map((d) => (d.id === dose.id ? { ...d, status: "APLICADA" as const, data: args.data } : d));
  n.clients = n.clients.map((c) => (c.id === cliente.id ? { ...c, lastApplication: args.data } : c));

  const servico: ServicoAplicacao = {
    id: uid(), idProtocolo: proto.id, idCliente: cliente.id, data: args.data,
    valor: round2(args.valor), metodo: args.metodo, localAplicacao: args.localAplicacao,
    observacoes: args.observacoes, insumosBaixados: insumos.join(", "),
  };
  n.servicos = [servico, ...n.servicos];

  return { state: n, faltas: [], servico };
}

export const proximaDose = (p: Protocolo) => p.doses.find((d) => d.status === "AGENDADA");

export const dosesPendentes = (s: AppState) =>
  s.protocolos.filter((p) => p.ativo).flatMap((p) => p.doses.filter((d) => d.status === "AGENDADA").map((d) => ({ p, d })));

export const resumoProtocolo = (p: Protocolo) => {
  const aplicadas = p.doses.filter((d) => d.status === "APLICADA").length;
  return { aplicadas, total: p.doses.length, pct: p.doses.length ? Math.round((aplicadas / p.doses.length) * 100) : 0 };
};

export type { AppState, Dose };
