import { useMemo, useState } from "react";
import { useStore } from "../../lib/store";
import { Badge, Field, useToast } from "../../components/ui";
import { IcAlert, IcBox, IcCheck, IcCoins, IcPlus, IcTrash, IcTruck } from "../../components/icons";
import { brl, fmtCNPJ, fmtMed, fmtQtd, todayISO, uid } from "../../lib/utils";
import { calcPMP, fefoSort, loteEfetiva, loteSaldo, saldoAtivo } from "../../lib/domain/engine";
import { VencChip, ColdTag } from "./shared";

interface Linha { id: string; idProduto: string; qtd: string; custo: string; lote: string; validade: string }
const linhaVazia = (): Linha => ({ id: uid(), idProduto: "", qtd: "", custo: "", lote: "", validade: "" });

const th = "px-2 py-2 text-[10.5px] font-bold uppercase tracking-wide text-ink-faint text-left";
const thR = "px-2 py-2 text-[10.5px] font-bold uppercase tracking-wide text-ink-faint text-right";

export function ComprasLotes() {
  const { state, registrarCompra, addFornecedor } = useStore();
  const { push } = useToast();

  const [dataCompra, setDataCompra] = useState(todayISO());
  const [forn, setForn] = useState(state.fornecedores[0]?.id ?? "");
  const [documento, setDocumento] = useState("");
  const [frete, setFrete] = useState("0");
  const [seguro, setSeguro] = useState("0");
  const [tributos, setTributos] = useState("0");
  const [rows, setRows] = useState([linhaVazia()]);
  const [err, setErr] = useState("");
  const [novoForn, setNovoForn] = useState(false);
  const [nfRazao, setNfRazao] = useState("");
  const [nfCnpj, setNfCnpj] = useState("");

  const insumos = state.produtos.filter((p) => p.tipo !== "SERVICO");

  const freteNum = Math.max(0, parseFloat(frete.replace(",", ".")) || 0);
  const seguroNum = Math.max(0, parseFloat(seguro.replace(",", ".")) || 0);
  const tributosNum = Math.max(0, parseFloat(tributos.replace(",", ".")) || 0);
  const extras = freteNum + seguroNum + tributosNum;

  const linhas = useMemo(
    () =>
      rows.map((r) => {
        const produto = state.produtos.find((x) => x.id === r.idProduto) ?? null;
        const qtd = parseFloat(r.qtd.replace(",", ".")) || 0;
        const custo = parseFloat(r.custo.replace(",", ".")) || 0;
        return { r, produto, qtd, custo, subtotal: qtd * custo };
      }),
    [rows, state.produtos],
  );

  const base = linhas.reduce((a, l) => a + l.subtotal, 0);
  const fatorRateio = base > 0 ? extras / base : 0;
  const preview = linhas.map((l) => {
    const rateio = base > 0 && l.subtotal > 0 ? (extras * l.subtotal) / base : 0;
    const landed = l.qtd > 0 ? l.custo + rateio / l.qtd : l.custo;
    const novoPmp = l.produto && l.qtd > 0 ? calcPMP(saldoAtivo(state, l.produto.id), l.produto.precoMedio, l.qtd, l.custo, rateio) : null;
    return { ...l, rateio, landed, novoPmp };
  });

  const totalCompra = base + extras;
  const linhasValidas = preview.filter((l) => l.produto && l.qtd > 0);

  const setLinha = (id: string, patch: Partial<Linha>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const submit = () => {
    if (!forn) return setErr("Selecione ou cadastre um fornecedor.");
    if (!linhasValidas.length) return setErr("Preencha ao menos um insumo com quantidade e preço.");
    for (const l of linhasValidas) {
      if (!l.r.lote.trim()) return setErr(`Informe o número do lote de ${l.produto!.nome}.`);
      if (!l.r.validade) return setErr(`Informe a validade do lote de ${l.produto!.nome}.`);
    }
    const res = registrarCompra({
      idFornecedor: forn,
      dataCompra,
      valorFrete: freteNum,
      valorSeguro: seguroNum,
      valorOutros: tributosNum,
      numeroDocumento: documento,
      itens: linhasValidas.map((l) => ({
        idProduto: l.produto!.id,
        qtd: Math.round(l.qtd * 100) / 100,
        custoUnit: Math.round(l.custo * 100) / 100,
        numeroLote: l.r.lote.trim(),
        dataValidade: l.r.validade,
      })),
    });
    if (res.ok) {
      push("success", "Compra registrada — lotes criados (FEFO), custo médio recalculado com frete/seguro/tributos e despesa lançada no financeiro.");
      setRows([linhaVazia()]);
      setDocumento(""); setFrete("0"); setSeguro("0"); setTributos("0"); setErr("");
    } else setErr(res.error);
  };

  const lotesOrdenados = fefoSort(state.lotes.filter((l) => l.status !== "DESCARTADO"));

  return (
    <div className="space-y-5">
      <header className="anim-rise">
        <p className="eyebrow">Aquisições, lote, validade e custo médio</p>
        <h1 className="mt-1 font-display text-[28px] font-bold tracking-tight sm:text-3xl">Compras &amp; Lotes</h1>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* formulário */}
        <section className="anim-rise card p-4 sm:p-5 xl:col-span-7">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Data da compra">
              <input className="field-input num" type="date" value={dataCompra} max={todayISO()} onChange={(e) => setDataCompra(e.target.value)} />
            </Field>
            <Field label="Fornecedor" className="sm:col-span-2">
              {novoForn ? (
                <div className="flex gap-2">
                  <input className="field-input" placeholder="Razão social" value={nfRazao} onChange={(e) => setNfRazao(e.target.value)} />
                  <input className="field-input num w-36" placeholder="CNPJ" value={nfCnpj} onChange={(e) => setNfCnpj(e.target.value)} />
                  <button
                    onClick={() => {
                      if (!nfRazao.trim()) return;
                      const f = addFornecedor({ razaoSocial: nfRazao, cnpj: nfCnpj });
                      setForn(f.id); setNovoForn(false); setNfRazao(""); setNfCnpj("");
                      push("success", "Fornecedor cadastrado.");
                    }}
                    className="btn-press shrink-0 rounded-xl bg-leaf-600 px-3 text-[12px] font-bold text-white hover:bg-leaf-700"
                  >
                    Salvar
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select className="field-input" value={forn} onChange={(e) => setForn(e.target.value)}>
                    <option value="">Selecione…</option>
                    {state.fornecedores.map((f) => <option key={f.id} value={f.id}>{f.razaoSocial}</option>)}
                  </select>
                  <button onClick={() => setNovoForn(true)} className="btn-press shrink-0 rounded-xl border border-line px-3 text-[12px] font-bold text-ink-soft hover:text-leaf-700">+ novo</button>
                </div>
              )}
            </Field>
          </div>

          {/* itens */}
          <div className="mt-4 space-y-2">
            {preview.map((l) => (
              <div key={l.r.id} className="rounded-xl border border-line bg-mist/40 p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_80px_110px]">
                  <select className="field-input sm:col-span-1" value={l.r.idProduto} onChange={(e) => setLinha(l.r.id, { idProduto: e.target.value })}>
                    <option value="">Insumo…</option>
                    {insumos.map((p) => <option key={p.id} value={p.id}>{p.nome} ({brl(p.precoMedio)}/{p.unidade})</option>)}
                  </select>
                  <input className="field-input num" placeholder="Qtd" inputMode="decimal" value={l.r.qtd} onChange={(e) => setLinha(l.r.id, { qtd: e.target.value })} />
                  <input className="field-input num" placeholder="R$ unit" inputMode="decimal" value={l.r.custo} onChange={(e) => setLinha(l.r.id, { custo: e.target.value })} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input className="field-input num" placeholder="Nº do lote" value={l.r.lote} onChange={(e) => setLinha(l.r.id, { lote: e.target.value })} />
                  <input className="field-input num" type="date" value={l.r.validade} min={todayISO()} onChange={(e) => setLinha(l.r.id, { validade: e.target.value })} />
                </div>
                {l.produto && l.qtd > 0 && (
                  <p className="num mt-2 text-[11px] font-semibold text-ink-soft">
                    subtotal {brl(l.subtotal)} · rateio {brl(l.rateio)} · custo c/ acessórios {brl(l.landed)}/{l.produto.unidade}
                    {l.novoPmp != null && <> · PMP {brl(l.produto.precoMedio)} → <strong className="text-leaf-700">{brl(l.novoPmp)}</strong></>}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => setRows((p) => [...p, linhaVazia()])} className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3.5 py-2 text-[12.5px] font-bold text-ink-soft hover:border-leaf-200 hover:text-leaf-700">
              <IcPlus size={14} /> Adicionar insumo
            </button>
            {rows.length > 1 && (
              <button onClick={() => setRows((p) => p.slice(0, -1))} className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3.5 py-2 text-[12.5px] font-bold text-ink-soft hover:border-coral-100 hover:text-coral-600">
                <IcTrash size={14} /> Remover último
              </button>
            )}
          </div>

          {/* custos acessórios */}
          <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-line bg-mist/50 p-4 lg:grid-cols-[auto_1fr]">
            <div className="flex flex-wrap gap-3">
              <Field label="Frete (R$)" className="w-[110px]"><input className="field-input num" inputMode="decimal" value={frete} onChange={(e) => setFrete(e.target.value)} placeholder="0,00" /></Field>
              <Field label="Seguro (R$)" className="w-[110px]"><input className="field-input num" inputMode="decimal" value={seguro} onChange={(e) => setSeguro(e.target.value)} placeholder="0,00" /></Field>
              <Field label="Tributos não recup." className="w-[130px]"><input className="field-input num" inputMode="decimal" value={tributos} onChange={(e) => setTributos(e.target.value)} placeholder="0,00" /></Field>
            </div>
            <div className="min-w-[220px]">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="eyebrow">Custo da aquisição</p>
                <span className={`num rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${fatorRateio > 0 ? "bg-lime-400/25 text-pine-800 ring-lime-400/40" : "bg-paper text-ink-faint ring-line"}`}>
                  Fator de rateio {(fatorRateio * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                </span>
              </div>
              <dl className="space-y-1 text-[12.5px]">
                <div className="flex justify-between gap-4"><dt className="text-ink-soft">Valor das mercadorias</dt><dd className="num font-semibold">{brl(base)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-soft">+ Frete + Seguro + Tributos</dt><dd className="num font-semibold">{brl(extras)}</dd></div>
                <div className="flex items-baseline justify-between gap-4 border-t border-line pt-1.5">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Preço total</dt>
                  <dd className="num font-display text-[20px] font-bold text-leaf-700">{brl(totalCompra)}</dd>
                </div>
              </dl>
              <p className="mt-1.5 flex items-center gap-1.5 text-[10.5px] font-medium text-ink-faint">
                <IcCoins size={11} /> Rateado proporcionalmente ao valor — compõe o PMP e gera o CMV
              </p>
            </div>
          </div>

          <Field label="Documento (NF/recibo) — opcional" className="mt-3">
            <input className="field-input" value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Geramos um código se ficar vazio" />
          </Field>

          {err && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-coral-600"><IcAlert size={13} /> {err}</p>}
          <button onClick={submit} className="btn-big mt-4"><IcCheck size={18} /> Registrar compra</button>
        </section>

        {/* lotes + histórico */}
        <aside className="space-y-4 xl:col-span-5">
          <div className="anim-rise card overflow-hidden" style={{ animationDelay: "80ms" }}>
            <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
              <h3 className="font-display text-[14px] font-bold tracking-tight">Lotes em estoque (FEFO)</h3>
              <Badge tone="neutral">{lotesOrdenados.length}</Badge>
            </div>
            {lotesOrdenados.length === 0 ? (
              <p className="px-4 py-5 text-center text-[12.5px] text-ink-faint">Nenhum lote — registre a primeira compra.</p>
            ) : (
              <ul>
                {lotesOrdenados.slice(0, 8).map((l) => {
                  const p = state.produtos.find((x) => x.id === l.idProduto);
                  return (
                    <li key={l.id} className="flex items-center gap-3 border-b border-line-soft px-4 py-2.5 last:border-0 hover:bg-leaf-50/40">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${l.status === "QUARENTENA" ? "bg-amber-100 text-amber-700" : "bg-mist text-ink-soft"}`}><IcBox size={14} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-bold">{p?.nome} <span className="num text-ink-faint">· {l.numeroLote}</span></p>
                        <div className="flex items-center gap-1.5">
                          <VencChip lote={l} />
                          {p && <ColdTag on={p.refrigerado} />}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="num text-[12.5px] font-bold">{fmtQtd(loteSaldo(l), p?.unidade)}</p>
                        <p className="num text-[10.5px] text-ink-faint">val {fmtMed(loteEfetiva(l))}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="anim-rise card overflow-hidden" style={{ animationDelay: "140ms" }}>
            <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
              <h3 className="font-display text-[14px] font-bold tracking-tight">Últimas aquisições</h3>
              <Badge tone="neutral">{state.entradas.length}</Badge>
            </div>
            {state.entradas.length === 0 ? (
              <p className="px-4 py-5 text-center text-[12.5px] text-ink-faint">Nenhuma compra registrada ainda.</p>
            ) : (
              <ul>
                {state.entradas.slice(0, 6).map((e) => {
                  const f = state.fornecedores.find((x) => x.id === e.idFornecedor);
                  return (
                    <li key={e.id} className="flex items-center gap-3 border-b border-line-soft px-4 py-2.5 last:border-0">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-leaf-100 text-leaf-700"><IcTruck size={14} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-bold">{e.numeroNota} · {f?.razaoSocial ?? "—"}</p>
                        <p className="num text-[10.5px] text-ink-faint">{fmtMed(e.dataEntrada)}{f?.cnpj ? ` · ${fmtCNPJ(f.cnpj)}` : ""}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
