/* ============================================================
   DoseCerta — Schema do domínio (financeiro, estoque, pacientes,
   RH, orçamentos e protocolos)
   ============================================================ */

export type ViewKey =
  | "dashboard"
  | "finance"
  | "estoque"
  | "compras"
  | "relatorios"
  | "rh"
  | "orcamentos"
  | "clients";

/* ---------- Produtos & Lotes ---------- */
export type ProdutoTipo = "FARMACO" | "INSUMO" | "SERVICO";

export interface Produto {
  id: string;
  sku: string;
  nome: string;
  unidade: string; // livre: un, mL, mg, cx, frasco…
  categoria: string; // livre: GLP-1, Descartáveis, Limpeza…
  estoqueMinimo: number;
  estoqueMaximo: number;
  saldoAtual: number; // Σ lotes ATIVO
  precoMedio: number; // PMP — só entradas alteram
  ultimaCompra?: string;
  tipo: ProdutoTipo;
  leadTimeDias: number;
  estoqueSeguranca: number;
  validadePosReconstituicaoDias?: number; // peptídeos fracionados
  refrigerado: boolean;
}

export type LoteStatus = "ATIVO" | "QUARENTENA" | "DESCARTADO";

export interface Lote {
  id: string;
  idProduto: string;
  numeroLote: string;
  dataValidade: string;
  dataReconstituicao?: string;
  validadePosReconstituicao?: string;
  saldoFechado: number;
  saldoEmUso: number;
  status: LoteStatus;
  localizacaoFisica: string;
  motivoQuarentena?: string;
  custoEntrada: number; // custo landed (c/ frete, seguro, tributos)
}

/* ---------- Compras ---------- */
export interface Fornecedor {
  id: string;
  razaoSocial: string;
  cnpj: string;
}

export type PedidoStatus = "ABERTO" | "PARCIAL" | "ENCERRADO";

export interface ItemPedido {
  id: string;
  idProduto: string;
  qtd: number;
  qtdRecebida: number;
  custoUnit: number;
}

export interface PedidoCompra {
  id: string;
  idFornecedor: string;
  data: string;
  status: PedidoStatus;
  itens: ItemPedido[];
}

export interface Entrada {
  id: string;
  idPedido: string;
  idFornecedor: string;
  numeroNota: string;
  dataEntrada: string;
  valorFrete: number;
  valorSeguro?: number;
  valorOutros?: number;
}

/* ---------- Kardex ---------- */
export type MovTipo = "E" | "S" | "AJUSTE" | "PERDA";

export interface Movimentacao {
  id: string;
  idProduto: string;
  idLote?: string;
  tipo: MovTipo;
  quantidade: number;
  valorUnitario?: number;
  saldoAposMov: number;
  idPaciente?: string; // rastreabilidade ANVISA
  idProfissional?: string;
  documentoRef?: string;
  criadoEm: string;
}

/* ---------- Fichas técnicas (protocolos de aplicação) ---------- */
export type TipoConsumo = "INSUMO_PRINCIPAL" | "MATERIAL_APOIO";

export interface ItemFichaTecnica {
  id: string;
  idProduto: string;
  quantidadeNecessaria: number;
  unidadeConsumo: string;
  tipoConsumo: TipoConsumo;
}

export interface FichaTecnica {
  id: string;
  nome: string;
  tipo: string;
  precoVenda: number;
  ativo: boolean;
  itens: ItemFichaTecnica[];
}

export interface Alocacao {
  id: string;
  idCliente: string;
  idFicha: string;
  dataPrevista: string;
  criadaEm: string;
}

/* ---------- Pacientes ---------- */
export interface Client {
  id: string;
  name: string;
  phone: string;
  cpf?: string;
  fichaTecnicaId?: string;
  productId: string;
  frequencyDays: number;
  lastApplication: string;
  notes: string;
  active: boolean;
  since: string;
}

/* ---------- Financeiro ---------- */
export type TxType = "receita" | "despesa";
export type PayMethod = "pix" | "cartao" | "dinheiro" | "boleto";

export interface Transaction {
  id: string;
  type: TxType;
  description: string;
  category: string;
  amount: number;
  date: string;
  method: PayMethod;
  clientId?: string;
  productId?: string;
}

/* ---------- RH ---------- */
export type ContractType = "CLT" | "PJ" | "ESTAGIO" | "DIARISTA";
export type CostCenter = "OPERACIONAL" | "ADMINISTRATIVO";
export type EmployeeStatus = "ATIVO" | "AFASTADO" | "DESLIGADO";
export type ComponentType = "ADICIONAL" | "BENEFICIO" | "DESCONTO";

export interface SalaryComponent {
  id: string;
  kind: string;
  type: ComponentType;
  description: string;
  value: number;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  contractType: ContractType;
  costCenter: CostCenter;
  admissionDate: string;
  status: EmployeeStatus;
  baseSalary: number;
  monthlyHours: number;
  vacationTakenMonths: number;
  components: SalaryComponent[];
}

export type TerminationType = "SEM_JUSTA_CAUSA" | "COM_JUSTA_CAUSA" | "PEDIDO" | "ACORDO";

export interface Termination {
  id: string;
  employeeId: string;
  exitDate: string;
  type: TerminationType;
  notice: "TRABALHADO" | "INDENIZADO";
  calculatedAmount: number;
  fgtsFine: number;
  recordedAt: string;
}

/* ---------- Orçamentos ---------- */
export type QuoteStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

export interface QuoteMaterial {
  id: string;
  idProduto: string;
  quantity: number;
  unitCost: number; // PMP congelado no orçamento
  totalMaterialCost: number;
}

export interface QuoteLabor {
  id: string;
  idEmployee: string;
  hours: number;
  hourlyRate: number; // custo/hora do RH
  totalLaborCost: number;
}

export interface Quote {
  id: string;
  clientName: string;
  status: QuoteStatus;
  materiais: QuoteMaterial[];
  maoObra: QuoteLabor[];
  markupPct: number;
  taxPct: number;
  validUntil: string;
  createdAt: string;
  idCliente?: string; // paciente criado na aprovação
  idFicha?: string; // protocolo criado na aprovação
}

/* ---------- Protocolos comprados ---------- */
export interface ProtocoloFarma {
  id: string;
  idProduto: string;
  qtdDoses: number;
  qtdPorDose: number;
  unidadeConsumo: string;
}

export interface ProtocoloMaterial {
  id: string;
  idProduto: string;
  qtd: number; // por dose
}

export interface ProtocoloServico {
  id: string;
  descricao: string;
  valor: number;
  frequencia: "UNICA" | "POR_DOSE";
}

export type DoseStatus = "AGENDADA" | "APLICADA";

export interface Dose {
  id: string;
  numero: number; // nº global da dose
  idProduto: string;
  qtd: number;
  data: string;
  status: DoseStatus;
}

export interface Protocolo {
  id: string;
  idCliente: string;
  nome: string;
  farmacos: ProtocoloFarma[];
  materiais: ProtocoloMaterial[];
  servicos: ProtocoloServico[];
  valorPorDose: number;
  dataInicio: string;
  intervaloDias: number;
  doses: Dose[];
  ativo: boolean;
  createdAt: string;
}

export interface ServicoAplicacao {
  id: string;
  idProtocolo: string;
  idCliente: string;
  data: string;
  valor: number;
  metodo: PayMethod;
  localAplicacao: string;
  observacoes: string;
  insumosBaixados: string;
}

/* ---------- Estado raiz ---------- */
export interface AppState {
  v: 2;
  produtos: Produto[];
  lotes: Lote[];
  fornecedores: Fornecedor[];
  pedidos: PedidoCompra[];
  entradas: Entrada[];
  movimentacoes: Movimentacao[];
  fichas: FichaTecnica[];
  alocacoes: Alocacao[];
  clients: Client[];
  transactions: Transaction[];
  employees: Employee[];
  terminations: Termination[];
  quotes: Quote[];
  protocolos: Protocolo[];
  servicos: ServicoAplicacao[];
}

export type Result = { ok: true } | { ok: false; error: string };
