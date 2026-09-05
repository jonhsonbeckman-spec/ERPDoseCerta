/* ============================================================
   RH — custo real mensal por colaborador (MOD × MOI),
   provisões CLT e simulação de rescisão.
   ============================================================ */
import type { CostCenter, Employee, EmployeeStatus, TerminationType } from "../../types";
import { round2 } from "./engine";

export const PAYROLL_CONFIG = {
  FGTS_PCT: 0.08,
  FERIAS_FATOR: 1.3333, // férias + 1/3
  MULTA_FGTS: 0.4,
  MULTA_FGTS_ACORDO: 0.2,
};

/** INSS patronal total (20% INSS + 2% RAT + 5,8% terceiros) */
export const INSS_TOTAL_PCT = 0.278;

export interface CostLine {
  key: string;
  label: string;
  value: number;
}

export interface MonthlyCost {
  lines: CostLine[];
  total: number;
  costPerHour: number;
}

/** Base de encargos = salário base + adicionais (benefícios/descontos não entram) */
export const baseEncargos = (e: Employee) =>
  round2(
    e.baseSalary +
      e.components.filter((c) => c.type === "ADICIONAL").reduce((a, c) => a + c.value, 0),
  );

const somaTipo = (e: Employee, type: "ADICIONAL" | "BENEFICIO" | "DESCONTO") =>
  e.components.filter((c) => c.type === type).reduce((a, c) => a + c.value, 0);

export function calculateEmployeeMonthlyCost(e: Employee, _month: string): MonthlyCost {
  const lines: CostLine[] = [];
  let total = 0;

  if (e.contractType === "CLT") {
    const base = baseEncargos(e);
    const fgts = round2(base * PAYROLL_CONFIG.FGTS_PCT);
    const inss = round2(base * INSS_TOTAL_PCT);
    const p13 = round2(base / 12);
    const pfer = round2((base / 12) * PAYROLL_CONFIG.FERIAS_FATOR);
    const ben = round2(somaTipo(e, "BENEFICIO"));
    lines.push(
      { key: "base", label: "Salário base + adicionais", value: base },
      { key: "fgts", label: "FGTS (8%)", value: fgts },
      { key: "inss", label: "INSS patronal (27,8%)", value: inss },
      { key: "p13", label: "Provisão 13º (1/12)", value: p13 },
      { key: "pfer", label: "Provisão férias + 1/3 (1/12)", value: pfer },
      { key: "ben", label: "Benefícios", value: ben },
    );
    total = base + fgts + inss + p13 + pfer + ben;
  } else {
    // PJ / Estágio / Diarista: valor do contrato + benefícios combinados
    const contrato = e.baseSalary;
    const ben = round2(somaTipo(e, "BENEFICIO"));
    lines.push(
      { key: "contrato", label: "Valor do contrato", value: contrato },
      { key: "ben", label: "Benefícios diretos", value: ben },
    );
    total = contrato + ben;
  }

  total = round2(total);
  const costPerHour = e.monthlyHours > 0 ? round2(total / e.monthlyHours) : 0;
  return { lines: lines.filter((l) => l.value !== 0), total, costPerHour };
}

/* ---------- rescisão ---------- */

/** Fração ≥ 15 dias conta como mês inteiro (regra trabalhista) */
export function monthsBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) {
    months -= 1;
    const restDays = td + 30 - fd;
    if (restDays >= 15) months += 1;
  }
  return Math.max(0, months);
}

export interface TerminationSim {
  lines: CostLine[];
  fgtsBalance: number;
  fgtsFine: number;
  total: number;
}

export function simulateTerminationCost(e: Employee, exitDate: string, type: TerminationType): TerminationSim {
  const base = baseEncargos(e);
  const meses = monthsBetween(e.admissionDate, exitDate);
  const fgtsBalance = round2(base * PAYROLL_CONFIG.FGTS_PCT * meses);

  const lines: CostLine[] = [];
  let total = 0;

  const justa = type === "COM_JUSTA_CAUSA";
  const acordo = type === "ACORDO";

  const fgtsFine = justa ? 0 : round2(fgtsBalance * (acordo ? PAYROLL_CONFIG.MULTA_FGTS_ACORDO : PAYROLL_CONFIG.MULTA_FGTS));

  // saldo de salário + férias vencidas (simplificado: vencidas se > 12 meses sem gozo)
  const feriasVencidas = meses - e.vacationTakenMonths > 12 ? round2(base * PAYROLL_CONFIG.FERIAS_FATOR) : 0;
  if (!justa) {
    // 13º proporcional (meses trabalhados no ano da saída)
    const anoSaida = exitDate.slice(0, 4);
    const mesesAno = type === "PEDIDO" || type === "ACORDO" ? monthsBetween(`${anoSaida}-01-01`, exitDate) : monthsBetween(`${anoSaida}-01-01`, exitDate);
    const decimoTerceiro = round2((base / 12) * Math.min(12, Math.max(1, mesesAno)));
    // férias proporcionais + 1/3
    const feriasProp = round2((base / 12) * Math.min(12, Math.max(1, mesesAno)) * PAYROLL_CONFIG.FERIAS_FATOR);
    lines.push(
      { key: "saldo", label: "Saldo de salário", value: base },
      { key: "feriasVenc", label: "Férias vencidas + 1/3", value: feriasVencidas },
      { key: "decimoTerceiro", label: "13º proporcional", value: decimoTerceiro },
      { key: "feriasProp", label: "Férias proporcionais + 1/3", value: feriasProp },
      { key: "multa", label: `Multa FGTS (${acordo ? "20%" : "40%"})`, value: fgtsFine },
    );
    total = base + feriasVencidas + decimoTerceiro + feriasProp + fgtsFine;
  } else {
    lines.push(
      { key: "saldo", label: "Saldo de salário", value: base },
      { key: "feriasVenc", label: "Férias vencidas + 1/3", value: feriasVencidas },
    );
    total = base + feriasVencidas;
  }

  return { lines: lines.filter((l) => l.value !== 0), fgtsBalance, fgtsFine, total: round2(total) };
}

/* ---------- resumo por centro de custo ---------- */

export interface CostCenterSummary {
  mod: { headcount: number; total: number };
  moi: { headcount: number; total: number };
  total: number;
}

export function getPayrollSummaryByCostCenter(employees: Employee[], month: string): CostCenterSummary {
  const ativos = employees.filter((e) => e.status === "ATIVO");
  const porCentro = (cc: CostCenter) => {
    const grupo = ativos.filter((e) => e.costCenter === cc);
    return {
      headcount: grupo.length,
      total: round2(grupo.reduce((a, e) => a + calculateEmployeeMonthlyCost(e, month).total, 0)),
    };
  };
  const mod = porCentro("OPERACIONAL");
  const moi = porCentro("ADMINISTRATIVO");
  return { mod, moi, total: round2(mod.total + moi.total) };
}

export const STATUS_LABEL: Record<EmployeeStatus, string> = {
  ATIVO: "Ativo",
  AFASTADO: "Afastado",
  DESLIGADO: "Desligado",
};
