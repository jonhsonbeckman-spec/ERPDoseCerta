import type { Lote, LoteStatus, MovTipo, ProdutoTipo } from "../../types";
import { diffDays, fmtShort, todayISO } from "../../lib/utils";
import { loteEfetiva } from "../../lib/domain/engine";
import { Badge } from "../../components/ui";
import { IcSnow } from "../../components/icons";

export const TIPO_LABEL: Record<ProdutoTipo, string> = {
  FARMACO: "Fármaco",
  INSUMO: "Insumo",
  SERVICO: "Serviço",
};

export const MOV_META: Record<MovTipo, { label: string; tone: "leaf" | "coral" | "amber" | "neutral" }> = {
  E: { label: "Entrada", tone: "leaf" },
  S: { label: "Saída", tone: "coral" },
  AJUSTE: { label: "Ajuste", tone: "neutral" },
  PERDA: { label: "Perda", tone: "amber" },
};

export function LoteStatusBadge({ status }: { status: LoteStatus }) {
  if (status === "ATIVO") return <Badge tone="leaf">ativo</Badge>;
  if (status === "QUARENTENA") return <Badge tone="amber">quarentena</Badge>;
  return <Badge tone="neutral">descartado</Badge>;
}

export function VencChip({ lote }: { lote: Lote }) {
  if (lote.status === "DESCARTADO") return <Badge tone="neutral">—</Badge>;
  const d = diffDays(todayISO(), loteEfetiva(lote));
  if (d < 0) return <Badge tone="coral">vencido há {-d}d</Badge>;
  if (d <= 30) return <Badge tone="amber">vence em {d}d</Badge>;
  return <Badge tone="neutral">val {fmtShort(loteEfetiva(lote))}</Badge>;
}

export function ColdTag({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold tracking-wide text-sky-700" title="Cadeia de frio 2–8 °C">
      <IcSnow size={11} /> 2–8 °C
    </span>
  );
}
