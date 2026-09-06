import { useMemo, useState } from "react";
import type { ContractType, CostCenter, Employee, TerminationType } from "../../types";
import { useStore } from "../../lib/store";
import { useUi } from "../../components/modals";
import { Badge, CountUp, EmptyState, Field, Modal, useToast } from "../../components/ui";
import { IcAlert, IcCheck, IcIdCard, IcPlus } from "../../components/icons";
import { brl, fmtMed, monthFull, monthKey, todayISO, uid } from "../../lib/utils";
import { calculateEmployeeMonthlyCost, getPayrollSummaryByCostCenter, simulateTerminationCost } from "../../lib/domain/rh";

const CONTRACT_LABEL: Record<ContractType, string> = { CLT: "CLT", PJ: "PJ", ESTAGIO: "Estágio", DIARISTA: "Diarista" };
const TIPO_DESL: Record<TerminationType, string> = {
  SEM_JUSTA_CAUSA: "Sem justa causa",
  COM_JUSTA_CAUSA: "Com justa causa",
  PEDIDO: "Pedido do colaborador",
  ACORDO: "Acordo (multa 20%)",
};

export function RH() {
  const { state, saveEmployee, deleteEmployee, recordTermination, launchPayroll } = useStore();
  const ui = useUi();
  const { push } = useToast();

  const month = monthKey(todayISO());
  const [novo, setNovo] = useState(false);
  const [simId, setSimId] = useState<string | null>(null);
  const [simTipo, setSimTipo] = useState<TerminationType>("SEM_JUSTA_CAUSA");

  const resumo = useMemo(() => getPayrollSummaryByCostCenter(state.employees, month), [state.employees, month]);

  const askFolha = () =>
    ui.confirm({
      title: `Lançar folha de ${monthFull(month)}`,
      message: <>Lançar <strong className="text-ink">{brl(resumo.mod.total)}</strong> (MOD) e <strong className="text-ink">{brl(resumo.moi.total)}</strong> (MOI) como despesas no financeiro?</>,
      confirmLabel: "Lançar folha",
      action: () => {
        const r = launchPayroll({ month, mod: resumo.mod.total, moi: resumo.moi.total });
        push(r.ok ? "success" : "error", r.ok ? "Folha lançada no financeiro." : r.error);
      },
    });

  const simEmp = state.employees.find((e) => e.id === simId) ?? null;
  const sim = simEmp ? simulateTerminationCost(simEmp, todayISO(), simTipo) : null;

  const askExcluir = (e: Employee) =>
    ui.confirm({
      title: "Remover colaborador",
      message: <>Remover <strong className="text-ink">{e.name}</strong>? Use a simulação de rescisão antes, se for o caso.</>,
      confirmLabel: "Remover", danger: true,
      action: () => { deleteEmployee(e.id); push("success", "Colaborador removido."); },
    });

  return (
    <div className="space-y-5">
      <header className="anim-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Custo real por pessoa · MOD × MOI</p>
          <h1 className="mt-1 font-display text-[28px] font-bold tracking-tight sm:text-3xl">RH &amp; Custos</h1>
        </div>
        <button onClick={() => setNovo(true)} className="btn-press inline-flex items-center gap-2 rounded-lg bg-pine-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-pine-800">
          <IcPlus size={15} /> Novo colaborador
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Mão de Obra Direta", v: resumo.mod.total, foot: `${resumo.mod.headcount} pessoa(s)`, tone: "text-leaf-700" },
          { label: "Mão de Obra Indireta", v: resumo.moi.total, foot: `${resumo.moi.headcount} pessoa(s)`, tone: "text-ink" },
          { label: "Custo total do mês", v: resumo.total, foot: monthFull(month), tone: "text-ink" },
        ].map((k, i) => (
          <div key={k.label} className="anim-rise card card-hover px-4 py-3.5" style={{ animationDelay: `${i * 60}ms` }}>
            <p className="eyebrow">{k.label}</p>
            <CountUp value={k.v} format={(n) => brl(n, 0)} className={`num mt-1 block font-display text-[20px] font-bold ${k.tone}`} />
            <p className="mt-1 text-[11px] font-medium text-ink-faint">{k.foot}</p>
          </div>
        ))}
        <button onClick={askFolha} className="anim-rise card card-hover flex flex-col items-start justify-center px-4 py-3.5 text-left hover:border-leaf-200" style={{ animationDelay: "180ms" }}>
          <p className="eyebrow">Fechar o mês</p>
          <p className="mt-1 font-display text-[15px] font-bold text-leaf-700">Lançar folha no financeiro →</p>
          <p className="mt-0.5 text-[11px] font-medium text-ink-faint">MOD e MOI viram despesas do mês</p>
        </button>
      </div>

      {state.employees.length === 0 ? (
        <EmptyState icon={<IcIdCard size={20} />} title="Nenhum colaborador" hint="Cadastre a equipe para calcular o custo real (encargos + provisões) de cada pessoa." />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {state.employees.map((e, i) => {
            const c = calculateEmployeeMonthlyCost(e, month);
            const maxLine = Math.max(1, ...c.lines.map((l) => l.value));
            return (
              <div key={e.id} className="anim-rise card p-4" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-bold">{e.name}</p>
                    <p className="text-[11.5px] text-ink-soft">{e.role} · desde {fmtMed(e.admissionDate)}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone="neutral">{CONTRACT_LABEL[e.contractType]}</Badge>
                      <Badge tone={e.costCenter === "OPERACIONAL" ? "leaf" : "amber"}>{e.costCenter === "OPERACIONAL" ? "MOD · operacional" : "MOI · administrativo"}</Badge>
                      <Badge tone={e.status === "ATIVO" ? "leaf" : e.status === "AFASTADO" ? "amber" : "coral"}>{e.status.toLowerCase()}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="num font-display text-[20px] font-bold">{brl(c.total, 0)}</p>
                    <p className="num text-[10.5px] text-ink-faint">{brl(c.costPerHour)}/hora</p>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  {c.lines.map((l) => (
                    <div key={l.key} className="flex items-center gap-2">
                      <span className="w-32 shrink-0 truncate text-[11px] font-semibold text-ink-soft">{l.label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist">
                        <div className={`h-full rounded-full ${l.key.startsWith("p") || l.key === "inss" || l.key === "fgts" ? "bg-amber-400" : "bg-leaf-500"}`} style={{ width: `${(l.value / maxLine) * 100}%`, transition: "width .6s ease" }} />
                      </div>
                      <span className="num w-20 shrink-0 text-right text-[11.5px] font-bold">{brl(l.value, 0)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex gap-2 border-t border-line-soft pt-3">
                  <button onClick={() => { setSimId(e.id); setSimTipo("SEM_JUSTA_CAUSA"); }} className="btn-press flex-1 rounded-lg border border-line px-3 py-2 text-[12px] font-bold text-ink-soft hover:border-amber-300 hover:text-amber-700">
                    Simular rescisão
                  </button>
                  <button onClick={() => askExcluir(e)} className="btn-press rounded-lg border border-line px-3 py-2 text-[12px] font-bold text-ink-faint hover:border-coral-100 hover:text-coral-600">
                    Remover
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* simulação de rescisão */}
      <Modal open={!!simEmp} onClose={() => setSimId(null)} title="Simular rescisão" subtitle={simEmp?.name}>
        {sim && simEmp && (
          <div className="space-y-3">
            <Field label="Tipo de desligamento">
              <select className="field-input" value={simTipo} onChange={(ev) => setSimTipo(ev.target.value as TerminationType)}>
                {(Object.keys(TIPO_DESL) as TerminationType[]).map((t) => <option key={t} value={t}>{TIPO_DESL[t]}</option>)}
              </select>
            </Field>
            <div className="rounded-xl border border-line bg-mist/50 p-3">
              <ul className="space-y-1.5">
                {sim.lines.map((l) => (
                  <li key={l.key} className="flex justify-between text-[12.5px] font-semibold">
                    <span className="text-ink-soft">{l.label}</span>
                    <span className="num">{brl(l.value)}</span>
                  </li>
                ))}
                <li className="flex justify-between border-t border-line pt-1.5 text-[13.5px] font-bold">
                  <span>Total estimado</span>
                  <span className="num text-coral-600">{brl(sim.total)}</span>
                </li>
              </ul>
              <p className="mt-2 text-[10.5px] font-medium text-ink-faint">Saldo FGTS {brl(sim.fgtsBalance)} · multa {brl(sim.fgtsFine)}</p>
            </div>
            <button
              onClick={() =>
                ui.confirm({
                  title: "Confirmar desligamento",
                  message: <>Registrar a rescisão de <strong className="text-ink">{simEmp.name}</strong> por {brl(sim.total)} e marcá-lo como desligado?</>,
                  confirmLabel: "Confirmar", danger: true,
                  action: () => {
                    const r = recordTermination({ id: uid(), employeeId: simEmp.id, exitDate: todayISO(), type: simTipo, notice: "INDENIZADO", calculatedAmount: sim.total, fgtsFine: sim.fgtsFine, recordedAt: todayISO() });
                    push(r.ok ? "success" : "error", r.ok ? "Rescisão registrada." : r.error);
                    setSimId(null);
                  },
                })
              }
              className="btn-press w-full rounded-xl bg-coral-600 px-4 py-3 text-sm font-bold text-white hover:bg-coral-700"
            >
              Confirmar desligamento
            </button>
          </div>
        )}
      </Modal>

      <EmployeeModal open={novo} onClose={() => setNovo(false)} onSave={(e) => { saveEmployee(e); push("success", "Colaborador cadastrado."); setNovo(false); }} />
    </div>
  );
}

function EmployeeModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (e: Employee) => void }) {
  const [nome, setNome] = useState("");
  const [role, setRole] = useState("");
  const [tipo, setTipo] = useState<ContractType>("CLT");
  const [centro, setCentro] = useState<CostCenter>("OPERACIONAL");
  const [salario, setSalario] = useState("");
  const [horas, setHoras] = useState("220");
  const [err, setErr] = useState("");

  const salvar = () => {
    const v = parseFloat(salario.replace(",", ".")) || 0;
    if (!nome.trim()) return setErr("Informe o nome.");
    if (v <= 0) return setErr("Informe o salário/contrato.");
    onSave({
      id: uid(), name: nome.trim(), role: role.trim() || "—", contractType: tipo, costCenter: centro,
      admissionDate: todayISO(), status: "ATIVO", baseSalary: v, monthlyHours: parseInt(horas) || 220,
      vacationTakenMonths: 0, components: [],
    });
    setNome(""); setRole(""); setSalario(""); setErr("");
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo colaborador" subtitle="CLT gera FGTS, INSS patronal e provisões; PJ gera só o contrato.">
      <div className="space-y-3">
        <Field label="Nome"><input className="field-input" value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cargo"><input className="field-input" value={role} onChange={(e) => setRole(e.target.value)} /></Field>
          <Field label="Contrato">
            <select className="field-input" value={tipo} onChange={(e) => setTipo(e.target.value as ContractType)}>
              {(Object.keys(CONTRACT_LABEL) as ContractType[]).map((t) => <option key={t} value={t}>{CONTRACT_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label="Centro de custo">
            <select className="field-input" value={centro} onChange={(e) => setCentro(e.target.value as CostCenter)}>
              <option value="OPERACIONAL">Operacional (MOD)</option>
              <option value="ADMINISTRATIVO">Administrativo (MOI)</option>
            </select>
          </Field>
          <Field label="Salário / contrato (R$)">
            <input className="field-input num" type="number" min="0" step="0.01" value={salario} onChange={(e) => setSalario(e.target.value)} />
          </Field>
          <Field label="Horas/mês">
            <input className="field-input num" type="number" min="1" value={horas} onChange={(e) => setHoras(e.target.value)} />
          </Field>
        </div>
        {err && <p className="flex items-center gap-1.5 text-xs font-semibold text-coral-600"><IcAlert size={13} /> {err}</p>}
        <button onClick={salvar} className="btn-big"><IcCheck size={18} /> Cadastrar</button>
      </div>
    </Modal>
  );
}
