import type { Client, PayMethod, Produto, Transaction, TxType } from "../types";

/* ---------- ids ---------- */
export const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

/* ---------- moeda ---------- */
export const brl = (n: number, digits = 2) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const brlK = (n: number) => {
  if (Math.abs(n) >= 1000) {
    const v = n / 1000;
    return "R$ " + v.toLocaleString("pt-BR", { maximumFractionDigits: v >= 10 ? 0 : 1 }) + "k";
  }
  return brl(n, 0);
};

export const fmtQtd = (n: number, unit?: string) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + (unit ? ` ${unit}` : "");

/* ---------- datas (YYYY-MM-DD) ---------- */
export const toISO = (d: Date) => {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const todayISO = () => toISO(new Date());
export const dOffset = (n: number) => addDays(todayISO(), n);
export const fromISO = (iso: string) => new Date(`${iso}T12:00:00`);

export const addDays = (iso: string, n: number) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

export const diffDays = (from: string, to: string) =>
  Math.round((fromISO(to).getTime() - fromISO(from).getTime()) / 86_400_000);

export const fmtShort = (iso: string) =>
  fromISO(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export const fmtMed = (iso: string) =>
  fromISO(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");

export const fmtLong = (iso: string) =>
  fromISO(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });

export const weekdayLong = () =>
  new Date().toLocaleDateString("pt-BR", { weekday: "long" });

export const monthKey = (iso: string) => iso.slice(0, 7);

export const monthShort = (key: string) =>
  fromISO(`${key}-15`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

export const monthFull = (key: string) => {
  const s = fromISO(`${key}-15`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const shiftMonth = (key: string, delta: number) => {
  const d = fromISO(`${key}-15`);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/* ---------- documentos ---------- */
export const onlyDigits = (s: string) => s.replace(/\D/g, "");

export const fmtCPF = (d: string) => {
  const x = onlyDigits(d);
  if (x.length !== 11) return d;
  return x.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

export const fmtCNPJ = (d: string) => {
  const x = onlyDigits(d);
  if (x.length !== 14) return d;
  return x.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

/* ---------- constantes ---------- */
export const MEI_CAP = 81_000;

export const REVENUE_CATS = ["Aplicação", "Venda de dose", "Avaliação", "Outras receitas"];
export const EXPENSE_CATS = [
  "Reposição de estoque",
  "Insumos",
  "Custo do serviço prestado",
  "Folha de pagamento",
  "Aluguel do studio",
  "Transporte",
  "MEI (DAS)",
  "Marketing",
  "Outros",
];

export const METHOD_LABEL: Record<PayMethod, string> = {
  pix: "Pix",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  boleto: "Boleto",
};

/* ---------- agenda ---------- */
export type DueStatus = "atrasado" | "hoje" | "proximo" | "agendado";

export const nextDate = (c: Client) => addDays(c.lastApplication, c.frequencyDays);

export const dueStatus = (c: Client): { status: DueStatus; days: number } => {
  const days = diffDays(todayISO(), nextDate(c));
  if (days < 0) return { status: "atrasado", days: -days };
  if (days === 0) return { status: "hoje", days: 0 };
  if (days <= 7) return { status: "proximo", days };
  return { status: "agendado", days };
};

export const initials = (name: string) =>
  name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export const waLink = (phone: string, msg: string) =>
  `https://wa.me/55${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;

/* ---------- financeiro ---------- */
export const sumBy = (txs: Transaction[], type: TxType) =>
  txs.filter((t) => t.type === type).reduce((a, t) => a + t.amount, 0);

export const monthTotals = (txs: Transaction[], key: string) => {
  const inMonth = txs.filter((t) => monthKey(t.date) === key);
  const rec = sumBy(inMonth, "receita");
  const des = sumBy(inMonth, "despesa");
  return { rec, des, result: rec - des, count: inMonth.length };
};

export const yearRevenue = (txs: Transaction[], year: number) =>
  txs.filter((t) => t.type === "receita" && t.date.startsWith(String(year))).reduce((a, t) => a + t.amount, 0);

export interface FlowPoint {
  key: string;
  label: string;
  rec: number;
  des: number;
}

export const flowSeries = (txs: Transaction[], months = 6): FlowPoint[] => {
  const now = monthKey(todayISO());
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) keys.push(shiftMonth(now, -i));
  return keys.map((key) => {
    const t = monthTotals(txs, key);
    return { key, label: monthShort(key), rec: t.rec, des: t.des };
  });
};

/* ---------- lookups ---------- */
export const clientName = (clients: Client[], id?: string) =>
  id ? clients.find((c) => c.id === id)?.name ?? "" : "";

export const productName = (produtos: Produto[], id?: string) =>
  id ? produtos.find((p) => p.id === id)?.nome ?? "" : "";
