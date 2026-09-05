/* ============================================================
   Seed de demonstração — construído chamando as próprias engines
   (PMP, FEFO, kardex e saldos nascem consistentes).
   ============================================================ */
import type { AppState, Employee, FichaTecnica, PayMethod, PedidoCompra, Produto, Protocolo, Transaction } from "../types";
import { addDays, dOffset, todayISO, uid } from "./utils";
import { registrarEntrada, setQuarentena } from "./domain/engine";
import { executarKit } from "./domain/kits";
import { aplicarDose, gerarDoses } from "./domain/protocolos";

export const SEED_INSUMOS: Produto[] = [
  { id: "p-ser", sku: "INS-SER", nome: "Seringa 3 mL com agulha", unidade: "un", categoria: "Descartáveis", estoqueMinimo: 20, estoqueMaximo: 200, saldoAtual: 0, precoMedio: 0, tipo: "INSUMO", leadTimeDias: 5, estoqueSeguranca: 20, refrigerado: false },
  { id: "p-alc", sku: "INS-ALC", nome: "Swab de álcool 70%", unidade: "un", categoria: "Descartáveis", estoqueMinimo: 50, estoqueMaximo: 500, saldoAtual: 0, precoMedio: 0, tipo: "INSUMO", leadTimeDias: 5, estoqueSeguranca: 50, refrigerado: false },
  { id: "p-luv", sku: "INS-LUV", nome: "Luvas nitrílicas", unidade: "par", categoria: "EPI", estoqueMinimo: 30, estoqueMaximo: 300, saldoAtual: 0, precoMedio: 0, tipo: "INSUMO", leadTimeDias: 5, estoqueSeguranca: 30, refrigerado: false },
  { id: "p-agu", sku: "INS-AGU", nome: "Agulha 30G", unidade: "un", categoria: "Descartáveis", estoqueMinimo: 20, estoqueMaximo: 200, saldoAtual: 0, precoMedio: 0, tipo: "INSUMO", leadTimeDias: 5, estoqueSeguranca: 20, refrigerado: false },
];

export const SEED_FORNECEDORES = [
  { id: "f1", razaoSocial: "Distribuidora Vida Pharma LTDA", cnpj: "12345678000190" },
  { id: "f2", razaoSocial: "MedSupply Insumos Hospitalares", cnpj: "98765432000110" },
];

const PRODUTOS: Produto[] = [
  { id: "p-mj25", sku: "MJ-25", nome: "Mounjaro 2,5 mg (caneta)", unidade: "un", categoria: "GLP-1", estoqueMinimo: 2, estoqueMaximo: 12, saldoAtual: 0, precoMedio: 0, tipo: "FARMACO", leadTimeDias: 7, estoqueSeguranca: 2, refrigerado: true },
  { id: "p-mj5", sku: "MJ-5", nome: "Mounjaro 5 mg (caneta)", unidade: "un", categoria: "GLP-1", estoqueMinimo: 2, estoqueMaximo: 10, saldoAtual: 0, precoMedio: 0, tipo: "FARMACO", leadTimeDias: 7, estoqueSeguranca: 2, refrigerado: true },
  { id: "p-bpc", sku: "BPC-157", nome: "BPC-157 5 mg (pó)", unidade: "un", categoria: "Peptídeos", estoqueMinimo: 2, estoqueMaximo: 12, saldoAtual: 0, precoMedio: 0, tipo: "FARMACO", leadTimeDias: 10, estoqueSeguranca: 2, validadePosReconstituicaoDias: 28, refrigerado: true },
  { id: "p-tb", sku: "TB-500", nome: "TB-500 5 mg (pó)", unidade: "un", categoria: "Peptídeos", estoqueMinimo: 2, estoqueMaximo: 10, saldoAtual: 0, precoMedio: 0, tipo: "FARMACO", leadTimeDias: 10, estoqueSeguranca: 2, validadePosReconstituicaoDias: 28, refrigerado: true },
  { id: "p-b12", sku: "B12-25", nome: "Vitamina B12 2,5 mL", unidade: "un", categoria: "Vitaminas", estoqueMinimo: 3, estoqueMaximo: 20, saldoAtual: 0, precoMedio: 0, tipo: "FARMACO", leadTimeDias: 5, estoqueSeguranca: 3, refrigerado: true },
  ...SEED_INSUMOS,
];

const FICHAS: FichaTecnica[] = [
  { id: "ft-mj25", nome: "Aplicação — Mounjaro 2,5 mg", tipo: "GLP-1", precoVenda: 1350, ativo: true, itens: [
    { id: uid(), idProduto: "p-mj25", quantidadeNecessaria: 1, unidadeConsumo: "un", tipoConsumo: "INSUMO_PRINCIPAL" },
    { id: uid(), idProduto: "p-ser", quantidadeNecessaria: 1, unidadeConsumo: "un", tipoConsumo: "MATERIAL_APOIO" },
    { id: uid(), idProduto: "p-alc", quantidadeNecessaria: 2, unidadeConsumo: "un", tipoConsumo: "MATERIAL_APOIO" },
  ]},
  { id: "ft-mj5", nome: "Aplicação — Mounjaro 5 mg", tipo: "GLP-1", precoVenda: 1550, ativo: true, itens: [
    { id: uid(), idProduto: "p-mj5", quantidadeNecessaria: 1, unidadeConsumo: "un", tipoConsumo: "INSUMO_PRINCIPAL" },
    { id: uid(), idProduto: "p-ser", quantidadeNecessaria: 1, unidadeConsumo: "un", tipoConsumo: "MATERIAL_APOIO" },
    { id: uid(), idProduto: "p-alc", quantidadeNecessaria: 2, unidadeConsumo: "un", tipoConsumo: "MATERIAL_APOIO" },
  ]},
  { id: "ft-bpc", nome: "Aplicação — BPC-157", tipo: "Peptídeo", precoVenda: 480, ativo: true, itens: [
    { id: uid(), idProduto: "p-bpc", quantidadeNecessaria: 1, unidadeConsumo: "un", tipoConsumo: "INSUMO_PRINCIPAL" },
    { id: uid(), idProduto: "p-ser", quantidadeNecessaria: 1, unidadeConsumo: "un", tipoConsumo: "MATERIAL_APOIO" },
    { id: uid(), idProduto: "p-alc", quantidadeNecessaria: 2, unidadeConsumo: "un", tipoConsumo: "MATERIAL_APOIO" },
  ]},
  { id: "ft-tb", nome: "Aplicação — TB-500", tipo: "Peptídeo", precoVenda: 520, ativo: true, itens: [
    { id: uid(), idProduto: "p-tb", quantidadeNecessaria: 1, unidadeConsumo: "un", tipoConsumo: "INSUMO_PRINCIPAL" },
    { id: uid(), idProduto: "p-ser", quantidadeNecessaria: 1, unidadeConsumo: "un", tipoConsumo: "MATERIAL_APOIO" },
    { id: uid(), idProduto: "p-alc", quantidadeNecessaria: 2, unidadeConsumo: "un", tipoConsumo: "MATERIAL_APOIO" },
  ]},
  { id: "ft-b12", nome: "Aplicação — Vitamina B12", tipo: "Vitamina", precoVenda: 130, ativo: true, itens: [
    { id: uid(), idProduto: "p-b12", quantidadeNecessaria: 1, unidadeConsumo: "un", tipoConsumo: "INSUMO_PRINCIPAL" },
    { id: uid(), idProduto: "p-ser", quantidadeNecessaria: 1, unidadeConsumo: "un", tipoConsumo: "MATERIAL_APOIO" },
    { id: uid(), idProduto: "p-alc", quantidadeNecessaria: 2, unidadeConsumo: "un", tipoConsumo: "MATERIAL_APOIO" },
  ]},
];

const CLIENTES = [
  { id: "c1", name: "Marina Duarte", phone: "11988887777", cpf: "12345678901", fichaTecnicaId: "ft-mj25", productId: "p-mj25", frequencyDays: 7, lastApplication: dOffset(-21), notes: "Rodízio de local: abdômen, coxa, braço.\nBeber 2L de água/dia.\nRelatar náusea persistente.", active: true, since: dOffset(-90) },
  { id: "c2", name: "Paulo Siqueira", phone: "11977776666", cpf: "23456789012", fichaTecnicaId: "ft-mj5", productId: "p-mj5", frequencyDays: 7, lastApplication: dOffset(-14), notes: "Aplicar sempre à noite.\nEvitar álcool no dia da dose.", active: true, since: dOffset(-60) },
  { id: "c3", name: "Renata Lopes", phone: "11966665555", cpf: "34567890123", fichaTecnicaId: "ft-bpc", productId: "p-bpc", frequencyDays: 7, lastApplication: dOffset(-7), notes: "Protocolo pós-lesão no ombro.\nGelo 15 min após atividade.", active: true, since: dOffset(-45) },
  { id: "c4", name: "João Batista", phone: "11955554444", cpf: "45678901234", fichaTecnicaId: "ft-tb", productId: "p-tb", frequencyDays: 14, lastApplication: dOffset(-10), notes: "Dor lombar crônica.\nAvaliar evolução a cada 2 doses.", active: true, since: dOffset(-40) },
  { id: "c5", name: "Fernanda Reis", phone: "11944443333", cpf: "56789012345", fichaTecnicaId: "ft-b12", productId: "p-b12", frequencyDays: 30, lastApplication: dOffset(-20), notes: "Repor B12 mensalmente.\nDosagem semestral de homocisteína.", active: true, since: dOffset(-120) },
  { id: "c6", name: "Otávio Ramos", phone: "11933332222", cpf: "67890123456", fichaTecnicaId: "ft-mj25", productId: "p-mj25", frequencyDays: 7, lastApplication: dOffset(-35), notes: "Titulação inicial.\nAcompanhar peso semanal.", active: true, since: dOffset(-35) },
];

export const SEED_EMPLOYEES: Employee[] = [
  { id: "rh-1", name: "Carla Mendes", role: "Enfermeira aplicadora", contractType: "CLT", costCenter: "OPERACIONAL", admissionDate: addDays(todayISO(), -420), status: "ATIVO", baseSalary: 3800, monthlyHours: 200, vacationTakenMonths: 0, components: [
    { id: "rh1-c1", kind: "INSALUBRIDADE", type: "ADICIONAL", description: "Insalubridade 20%", value: 300 },
    { id: "rh1-c2", kind: "VT", type: "BENEFICIO", description: "Vale-transporte", value: 220 },
    { id: "rh1-c3", kind: "VR", type: "BENEFICIO", description: "Vale-refeição", value: 480 },
  ]},
  { id: "rh-2", name: "Rafael Torres", role: "Gestor administrativo", contractType: "CLT", costCenter: "ADMINISTRATIVO", admissionDate: addDays(todayISO(), -700), status: "ATIVO", baseSalary: 3200, monthlyHours: 220, vacationTakenMonths: 12, components: [
    { id: "rh2-c1", kind: "VR", type: "BENEFICIO", description: "Vale-refeição", value: 480 },
    { id: "rh2-c2", kind: "PLANO_SAUDE", type: "BENEFICIO", description: "Plano de saúde", value: 390 },
  ]},
  { id: "rh-3", name: "Dra. Paula Sanches", role: "Responsável técnica", contractType: "PJ", costCenter: "OPERACIONAL", admissionDate: addDays(todayISO(), -260), status: "ATIVO", baseSalary: 6500, monthlyHours: 160, vacationTakenMonths: 0, components: [] },
];

const vazio = (): AppState => ({
  v: 2,
  produtos: PRODUTOS.map((p) => ({ ...p })),
  lotes: [],
  fornecedores: SEED_FORNECEDORES.map((f) => ({ ...f })),
  pedidos: [],
  entradas: [],
  movimentacoes: [],
  fichas: FICHAS.map((f) => ({ ...f, itens: f.itens.map((i) => ({ ...i })) })),
  alocacoes: [],
  clients: CLIENTES.map((c) => ({ ...c })),
  transactions: [],
  employees: SEED_EMPLOYEES.map((e) => ({ ...e, components: e.components.map((c) => ({ ...c })) })),
  terminations: [],
  quotes: [],
  protocolos: [],
  servicos: [],
  anamneses: [],
  avaliacoesFisicas: [],
  termos: [],
  sessoes: [],
  historico: [],
});

export function buildEmpty(): AppState {
  return {
    v: 2,
    produtos: [], lotes: [],
    fornecedores: SEED_FORNECEDORES.map((f) => ({ ...f })),
    pedidos: [], entradas: [], movimentacoes: [],
    fichas: [], alocacoes: [], clients: [], transactions: [],
    employees: [], terminations: [], quotes: [], protocolos: [], servicos: [],
    anamneses: [], avaliacoesFisicas: [], termos: [], sessoes: [], historico: [],
  };
}

export function buildSeed(): AppState {
  let s = vazio();

  /* entradas (PMP + lotes + despesa) */
  s = registrarEntrada(s, {
    itens: [
      { idProduto: "p-mj25", qtd: 8, custoUnit: 980, numeroLote: "M25-2401", dataValidade: dOffset(180) },
      { idProduto: "p-mj5", qtd: 4, custoUnit: 1150, numeroLote: "M5-2401", dataValidade: dOffset(180) },
    ],
    idFornecedor: "f1", numeroNota: "NF-8842", dataEntrada: dOffset(-45), valorFrete: 120,
  }).state;

  s = registrarEntrada(s, {
    itens: [
      { idProduto: "p-bpc", qtd: 6, custoUnit: 320, numeroLote: "BPC-112", dataValidade: dOffset(90) },
      { idProduto: "p-tb", qtd: 4, custoUnit: 350, numeroLote: "TB-77", dataValidade: dOffset(90) },
    ],
    idFornecedor: "f1", numeroNota: "NF-8910", dataEntrada: dOffset(-30), valorFrete: 60,
  }).state;

  s = registrarEntrada(s, {
    itens: [
      { idProduto: "p-b12", qtd: 10, custoUnit: 45, numeroLote: "B12-90", dataValidade: dOffset(365) },
      { idProduto: "p-ser", qtd: 100, custoUnit: 1.2, numeroLote: "SR-55", dataValidade: dOffset(720) },
      { idProduto: "p-alc", qtd: 300, custoUnit: 0.35, numeroLote: "AL-21", dataValidade: dOffset(540) },
      { idProduto: "p-luv", qtd: 100, custoUnit: 0.9, numeroLote: "LV-08", dataValidade: dOffset(720) },
      { idProduto: "p-agu", qtd: 100, custoUnit: 0.8, numeroLote: "AG-31", dataValidade: dOffset(720) },
    ],
    idFornecedor: "f2", numeroNota: "NF-3371", dataEntrada: dOffset(-25), valorFrete: 40,
  }).state;

  /* protocolo comprado do João (TB-500 × 2 doses, 14/14 dias) — dose 1 já aplicada */
  const protoFarmacos = [{ idProduto: "p-tb", qtdDoses: 2, qtdPorDose: 1, unidadeConsumo: "un" }];
  const proto: Protocolo = {
    id: "proto-1", idCliente: "c4", nome: "Protocolo TB-500 · regeneração",
    farmacos: protoFarmacos.map((f) => ({ ...f, id: uid() })),
    materiais: [
      { id: uid(), idProduto: "p-ser", qtd: 1 },
      { id: uid(), idProduto: "p-alc", qtd: 2 },
      { id: uid(), idProduto: "p-luv", qtd: 1 },
    ],
    servicos: [
      { id: uid(), descricao: "Anamnese e plano terapêutico", valor: 150, frequencia: "UNICA" },
      { id: uid(), descricao: "Avaliação pós-dose", valor: 80, frequencia: "POR_DOSE" },
    ],
    valorPorDose: 600,
    dataInicio: dOffset(-10), intervaloDias: 14,
    doses: gerarDoses(protoFarmacos, dOffset(-10), 14),
    ativo: true, createdAt: dOffset(-10),
  };
  s = { ...s, protocolos: [proto] };
  const r1 = aplicarDose(s, {
    idProtocolo: proto.id, idDose: proto.doses[0].id, data: dOffset(-10),
    valor: 600 + 150, metodo: "pix", idProfissional: "rh-1",
    localAplicacao: "Região lombar", observacoes: "Anamnese realizada. Sem intercorrências.",
  });
  if (r1.faltas.length === 0) s = r1.state;

  /* quarentena demonstrativa no lote de BPC (falha de temperatura) */
  const loteBpc = s.lotes.find((l) => l.idProduto === "p-bpc");
  if (loteBpc) s = setQuarentena(s, { idLote: loteBpc.id, motivo: "Falha de temperatura no transporte — aguardando laudo" });

  /* aplicações via ficha (baixa + receita + CMV) */
  const app = (st: AppState, idCliente: string, idFicha: string, diasAtras: number, valor: number, metodo: PayMethod): AppState => {
    const r = executarKit(st, {
      idCliente, idFicha, data: dOffset(-diasAtras), valor, metodo,
      idProfissional: "rh-1",
    });
    return r.faltas.length === 0 ? r.state : st;
  };
  s = app(s, "c1", "ft-mj25", 21, 1350, "pix");
  s = app(s, "c1", "ft-mj25", 14, 1350, "pix");
  s = app(s, "c1", "ft-mj25", 7, 1350, "cartao");
  s = app(s, "c2", "ft-mj5", 14, 1550, "pix");
  s = app(s, "c2", "ft-mj5", 7, 1550, "pix");
  s = app(s, "c3", "ft-bpc", 7, 480, "pix");
  s = app(s, "c5", "ft-b12", 20, 130, "dinheiro");
  s = app(s, "c6", "ft-mj25", 35, 1350, "pix");

  /* alocações (estoque virtual = aplicações pendentes) */
  const aloca = (idCliente: string, idFicha: string, emDias: number) => ({
    id: uid(), idCliente, idFicha, dataPrevista: dOffset(emDias), criadaEm: dOffset(-1),
  });
  s = {
    ...s,
    alocacoes: [
      aloca("c6", "ft-mj25", -2),
      aloca("c2", "ft-mj5", -1),
      aloca("c3", "ft-bpc", 0),
      aloca("c5", "ft-b12", 2),
    ],
  };

  /* pedido de reposição aberto */
  const pedido: PedidoCompra = {
    id: uid(),
    idFornecedor: "f1",
    data: dOffset(-2),
    status: "ABERTO",
    itens: [
      { id: uid(), idProduto: "p-mj5", qtd: 4, qtdRecebida: 0, custoUnit: 1130 },
      { id: uid(), idProduto: "p-mj25", qtd: 4, qtdRecebida: 0, custoUnit: 985 },
    ],
  };
  s = { ...s, pedidos: [pedido] };

  /* despesas fixas recentes */
  const extra: Transaction[] = [
    { id: uid(), type: "despesa", description: "Aluguel do studio", category: "Aluguel do studio", amount: 950, date: dOffset(-33), method: "pix" },
    { id: uid(), type: "despesa", description: "DAS-MEI do período", category: "MEI (DAS)", amount: 75.9, date: dOffset(-20), method: "boleto" },
    { id: uid(), type: "despesa", description: "Tráfego pago — Instagram", category: "Marketing", amount: 150, date: dOffset(-11), method: "cartao" },
    { id: uid(), type: "despesa", description: "Deslocamento — aplicações em domicílio", category: "Transporte", amount: 84.9, date: dOffset(-6), method: "pix" },
  ];
  s = { ...s, transactions: [...s.transactions, ...extra] };

  return s;
}
