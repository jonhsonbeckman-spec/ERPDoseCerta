import { useRef, useState } from "react";
import { useStore } from "../lib/store";
import { Modal, useToast } from "./ui";
import { useUi } from "./modals";
import { IcAlert, IcBox, IcDownload, IcRefresh, IcTrash, IcWallet } from "./icons";
import { brl, diffDays, fmtLong, todayISO } from "../lib/utils";

const LAST_BACKUP_KEY = "dosecerta:lastBackup";

const csvEscape = (v: string | number) => {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function download(filename: string, content: string, mime: string) {
  const blob = new Blob(["\ufeff" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BackupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, importState, wipeAll } = useStore();
  const { push } = useToast();
  const ui = useUi();
  const fileRef = useRef<HTMLInputElement>(null);
  const hoje = todayISO();
  const [lastBackup, setLastBackup] = useState<string | null>(() => localStorage.getItem(LAST_BACKUP_KEY));

  const markBackup = () => {
    localStorage.setItem(LAST_BACKUP_KEY, hoje);
    setLastBackup(hoje);
  };

  const exportJSON = () => {
    download(`dosecerta-backup-${hoje}.json`, JSON.stringify(state, null, 2), "application/json");
    markBackup();
    push("success", "Backup completo exportado (JSON).");
  };

  const exportFinanceiro = () => {
    const head = "Data;Descrição;Categoria;Tipo;Valor;Método";
    const rows = [...state.transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t) =>
        [t.date, t.description, t.category, t.type === "receita" ? "Receita" : "Despesa", t.amount.toFixed(2).replace(".", ","), t.method].map(csvEscape).join(";"),
      );
    download(`dosecerta-financeiro-${hoje}.csv`, [head, ...rows].join("\n"), "text/csv;charset=utf-8");
    push("success", "Financeiro exportado (CSV) — pronto para a contabilidade.");
  };

  const exportEstoque = () => {
    const head = "SKU;Produto;Categoria;Saldo;Unidade;Preço Médio;Valor Total";
    const rows = state.produtos
      .filter((p) => p.tipo !== "SERVICO")
      .map((p) =>
        [p.sku, p.nome, p.categoria, p.saldoAtual, p.unidade, p.precoMedio.toFixed(2).replace(".", ","), (p.saldoAtual * p.precoMedio).toFixed(2).replace(".", ",")].map(csvEscape).join(";"),
      );
    download(`dosecerta-estoque-${hoje}.csv`, [head, ...rows].join("\n"), "text/csv;charset=utf-8");
    push("success", "Estoque exportado (CSV).");
  };

  const onImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const r = importState(parsed);
        if (r.ok) {
          push("success", "Backup restaurado com sucesso.");
          onClose();
        } else push("error", r.error);
      } catch {
        push("error", "Não foi possível ler o arquivo. Confira se é um backup JSON do DoseCerta.");
      }
    };
    reader.readAsText(file);
  };

  const askWipe = () =>
    ui.confirm({
      title: "Começar do zero",
      message: "Todos os dados (finanças, estoque, lotes, pacientes, protocolos) serão apagados deste aparelho. Essa ação não pode ser desfeita. Exporte um backup antes, se precisar.",
      confirmLabel: "Apagar tudo",
      danger: true,
      action: () => {
        wipeAll();
        push("success", "Dados apagados. Cadastre seus produtos e pacientes para começar.");
        onClose();
      },
    });

  const daysSinceBackup = lastBackup ? diffDays(lastBackup, hoje) : null;
  const nTx = state.transactions.length;
  const nPac = state.clients.length;
  const valorEstoque = state.produtos.filter((p) => p.tipo !== "SERVICO").reduce((a, p) => a + p.saldoAtual * p.precoMedio, 0);

  return (
    <Modal open={open} onClose={onClose} title="Backup & Exportação" subtitle="Seus dados ficam só neste aparelho — faça cópias para não perder nada.">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-mist/50 p-3 text-center">
          <div><p className="num font-display text-[17px] font-bold">{nTx}</p><p className="text-[10.5px] font-semibold text-ink-faint">lançamentos</p></div>
          <div><p className="num font-display text-[17px] font-bold">{nPac}</p><p className="text-[10.5px] font-semibold text-ink-faint">pacientes</p></div>
          <div><p className="num font-display text-[17px] font-bold">{brl(valorEstoque, 0)}</p><p className="text-[10.5px] font-semibold text-ink-faint">em estoque</p></div>
        </div>

        {daysSinceBackup == null ? (
          <div className="flex items-center gap-2 rounded-xl border border-coral-100 bg-coral-50 px-3.5 py-2.5">
            <IcAlert size={15} className="shrink-0 text-coral-600" />
            <p className="text-[12px] font-semibold text-coral-700">Nenhum backup feito ainda — seus dados existem só neste aparelho.</p>
          </div>
        ) : daysSinceBackup > 7 ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
            <IcAlert size={15} className="shrink-0 text-amber-700" />
            <p className="text-[12px] font-semibold text-amber-800">Último backup há {daysSinceBackup} dias ({fmtLong(lastBackup!)}). Faça uma cópia nova.</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-leaf-200 bg-leaf-50 px-3.5 py-2.5">
            <IcRefresh size={15} className="shrink-0 text-leaf-700" />
            <p className="text-[12px] font-semibold text-leaf-700">Último backup {daysSinceBackup === 0 ? "hoje" : `há ${daysSinceBackup} dia${daysSinceBackup > 1 ? "s" : ""}`} ({fmtLong(lastBackup!)}).</p>
          </div>
        )}

        <div className="space-y-2">
          <button onClick={exportJSON} className="btn-press flex w-full items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3 text-left transition-colors hover:border-leaf-200 hover:bg-leaf-50">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-pine-900 text-lime-400"><IcDownload size={16} /></span>
            <span>
              <span className="block text-[13.5px] font-bold">Backup completo (JSON)</span>
              <span className="block text-[11.5px] text-ink-faint">Tudo: finanças, estoque, lotes, pacientes, protocolos.</span>
            </span>
          </button>
          <button onClick={exportFinanceiro} className="btn-press flex w-full items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3 text-left transition-colors hover:border-leaf-200 hover:bg-leaf-50">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-leaf-100 text-leaf-700"><IcWallet size={16} /></span>
            <span>
              <span className="block text-[13.5px] font-bold">Financeiro (CSV)</span>
              <span className="block text-[11.5px] text-ink-faint">Receitas e despesas para o contador ou planilha.</span>
            </span>
          </button>
          <button onClick={exportEstoque} className="btn-press flex w-full items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3 text-left transition-colors hover:border-leaf-200 hover:bg-leaf-50">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700"><IcBox size={16} /></span>
            <span>
              <span className="block text-[13.5px] font-bold">Estoque & valoração (CSV)</span>
              <span className="block text-[11.5px] text-ink-faint">Saldo, custo médio e valor total por produto.</span>
            </span>
          </button>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-amber-800"><IcRefresh size={13} /> Restaurar backup</p>
          <p className="mt-1 text-[11.5px] leading-snug text-amber-800/80">Substitui todos os dados atuais pelos do arquivo. Faça um backup antes.</p>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} className="btn-press mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-paper px-3.5 py-2 text-[12.5px] font-bold text-amber-800 hover:bg-amber-100">
            <IcDownload size={13} /> Escolher arquivo JSON…
          </button>
        </div>

        <div className="rounded-xl border border-coral-100 bg-coral-50 p-3.5">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-coral-700"><IcTrash size={13} /> Começar do zero</p>
          <p className="mt-1 text-[11.5px] leading-snug text-coral-700/80">Remove os dados de demonstração e todos os lançamentos, para usar com o seu negócio de verdade.</p>
          <button onClick={askWipe} className="btn-press mt-2 inline-flex items-center gap-1.5 rounded-lg border border-coral-300 bg-paper px-3.5 py-2 text-[12.5px] font-bold text-coral-700 hover:bg-coral-100">
            <IcTrash size={13} /> Apagar todos os dados…
          </button>
        </div>
      </div>
    </Modal>
  );
}
