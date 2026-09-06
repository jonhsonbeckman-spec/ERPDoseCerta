import { useEffect, useState } from "react";
import { Modal, Badge, useToast } from "./ui";
import { IcCheck, IcCopy, IcDownload, IcMonitor, IcShare, IcSmartphone, IcSyringe } from "./icons";

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let promptListeners: (() => void)[] = [];

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((fn) => fn());
  });
}

const detectPlatform = () => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
};

export function InstallModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { push } = useToast();
  const [installable, setInstallable] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const url = typeof window !== "undefined" ? window.location.href : "";
  const platform = detectPlatform();
  const standalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);

  useEffect(() => {
    const sync = () => setInstallable(deferredPrompt !== null);
    promptListeners.push(sync);
    sync();
    const onInstalled = () => {
      push("success", "DoseCerta instalado! Procure na tela inicial.");
      onClose();
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      promptListeners = promptListeners.filter((fn) => fn !== sync);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [push, onClose]);

  const installNow = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") push("success", "Instalação confirmada!");
    deferredPrompt = null;
    setInstallable(false);
    setInstalling(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      push("info", "Copie o endereço diretamente da barra do navegador.");
    }
  };

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=6&color=0C2A21&bgcolor=FFFFFF&data=${encodeURIComponent(url)}`;

  const buildQrCanvas = () =>
    new Promise<HTMLCanvasElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const S = 640;
        const H = S + 118;
        const canvas = document.createElement("canvas");
        canvas.width = S;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas"));
        ctx.fillStyle = "#fbfcf8";
        ctx.fillRect(0, 0, S, H);
        ctx.strokeStyle = "#d9e2d3";
        ctx.lineWidth = 3;
        ctx.strokeRect(6, 6, S - 12, H - 12);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(36, 36, S - 72, S - 72);
        ctx.drawImage(img, 48, 48, S - 96, S - 96);
        ctx.textAlign = "center";
        ctx.fillStyle = "#0c2a21";
        ctx.font = "800 40px 'Bricolage Grotesque', sans-serif";
        ctx.fillText("DoseCerta", S / 2, S + 62);
        ctx.fillStyle = "#4e6156";
        ctx.font = "600 21px 'Instrument Sans', sans-serif";
        ctx.fillText("escaneie para instalar no celular", S / 2, S + 96);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error("qr"));
      img.src = qrSrc;
    });

  const downloadQR = async () => {
    setSaving(true);
    try {
      const canvas = await buildQrCanvas();
      const a = document.createElement("a");
      a.download = "dosecerta-instalacao.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
      push("success", "QR Code baixado — agora é só anexar no WhatsApp.");
    } catch {
      window.open(qrSrc, "_blank", "noopener");
      push("info", "Abri o QR em outra aba: toque e segure na imagem para salvar.");
    } finally {
      setSaving(false);
    }
  };

  const shareQR = async () => {
    try {
      const canvas = await buildQrCanvas();
      const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/png"));
      const file = new File([blob], "dosecerta-instalacao.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "DoseCerta", text: "Escaneie o QR Code (ou abra o link) para instalar o DoseCerta." });
      } else {
        await downloadQR();
      }
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") push("info", "Compartilhamento não concluído.");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Instalar o DoseCerta" subtitle="Use no iPhone, no Android e no PC — com o mesmo link." wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="pine">
            <span className="inline-flex items-center gap-1.5">
              {platform === "desktop" ? <IcMonitor size={12} /> : <IcSmartphone size={12} />}
              {platform === "ios" ? "iPhone detectado" : platform === "android" ? "Android detectado" : "Computador detectado"}
            </span>
          </Badge>
          {standalone && (
            <Badge tone="leaf"><span className="inline-flex items-center gap-1"><IcCheck size={12} /> já instalado</span></Badge>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
          {/* QR grande */}
          <div className="flex flex-col items-center gap-2.5">
            <div className="relative rounded-2xl border border-line bg-paper p-3.5 shadow-[var(--shadow-card)]">
              <span className="absolute left-2 top-2 h-6 w-6 rounded-tl-xl border-l-[3px] border-t-[3px] border-leaf-600" />
              <span className="absolute right-2 top-2 h-6 w-6 rounded-tr-xl border-r-[3px] border-t-[3px] border-leaf-600" />
              <span className="absolute bottom-2 left-2 h-6 w-6 rounded-bl-xl border-b-[3px] border-l-[3px] border-leaf-600" />
              <span className="absolute bottom-2 right-2 h-6 w-6 rounded-br-xl border-b-[3px] border-r-[3px] border-leaf-600" />
              <div className="relative aspect-square w-[min(72vw,300px)] overflow-hidden rounded-xl bg-white sm:w-[232px]">
                <img src={qrSrc} crossOrigin="anonymous" alt="QR Code para instalar o DoseCerta" className="h-full w-full object-contain" loading="lazy" />
                {!standalone && (
                  <span className="pointer-events-none absolute left-2 right-2 h-[2.5px] rounded bg-leaf-500/85" style={{ animation: "scan-line 2.6s ease-in-out infinite" }} />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={downloadQR} disabled={saving} className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-pine-900 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-pine-800 disabled:opacity-60">
                <IcDownload size={14} /> {saving ? "Gerando…" : "Baixar PNG"}
              </button>
              <button onClick={shareQR} className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-leaf-200 bg-leaf-50 px-4 py-2.5 text-[13px] font-bold text-leaf-700 hover:bg-leaf-100">
                <IcShare size={14} /> Enviar
              </button>
            </div>
            <p className="flex items-center gap-1.5 text-center text-[11px] font-bold leading-snug text-ink-faint">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-pine-900 text-lime-400" style={{ animation: "float-soft 3s ease-in-out infinite" }}>
                <IcSyringe size={11} />
              </span>
              Escaneie com a câmera — ou baixe e mande no WhatsApp
            </p>
          </div>

          <div className="min-w-0 space-y-3">
            <div>
              <p className="eyebrow">Link de instalação</p>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-line bg-mist/60 px-3 py-2.5">
                <span className="num min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{url || "—"}</span>
                <button onClick={copy} className={`btn-press inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${copied ? "bg-leaf-600 text-white" : "bg-pine-900 text-white hover:bg-pine-800"}`}>
                  {copied ? <IcCheck size={13} /> : <IcCopy size={13} />} {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-snug text-ink-faint">Este endereço é o instalador: abra-o no aparelho desejado e siga o passo a passo.</p>
            </div>

            {installable && (
              <button onClick={installNow} disabled={installing} className="btn-big disabled:opacity-60">
                <IcDownload size={19} /> {installing ? "Instalando…" : "Instalar agora neste aparelho"}
              </button>
            )}

            {!standalone && platform === "ios" && (
              <ol className="space-y-2">
                {[
                  { icon: <IcShare size={15} />, text: "No Safari, toque no botão de compartilhar (quadrado com seta ↑)." },
                  { icon: <IcSmartphone size={15} />, text: "Role e toque em “Adicionar à Tela de Início”." },
                  { icon: <IcCheck size={15} />, text: "Confirme — o DoseCerta aparece como app, em tela cheia." },
                ].map((s, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl border border-line bg-paper px-3.5 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pine-900 text-lime-400">{s.icon}</span>
                    <span className="text-[13px] font-semibold leading-snug text-ink-soft">
                      <strong className="num mr-1 text-leaf-700">{i + 1}.</strong>{s.text}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {!standalone && platform === "desktop" && !installable && (
              <ol className="space-y-2">
                {[
                  { icon: <IcMonitor size={15} />, text: "No Chrome ou Edge, clique no ícone de instalar na barra de endereço (monitor com seta ↓)." },
                  { icon: <IcCheck size={15} />, text: "Ou: Menu → Aplicativos → “Instalar DoseCerta”. Vira app com janela própria." },
                ].map((s, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl border border-line bg-paper px-3.5 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pine-900 text-lime-400">{s.icon}</span>
                    <span className="text-[13px] font-semibold leading-snug text-ink-soft">
                      <strong className="num mr-1 text-leaf-700">{i + 1}.</strong>{s.text}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {!standalone && platform === "android" && !installable && (
              <p className="rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13px] font-semibold text-ink-soft">
                No Chrome: menu (⋮) → <strong>“Adicionar à tela inicial”</strong> ou <strong>“Instalar app”</strong>.
              </p>
            )}
          </div>
        </div>

        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11.5px] font-semibold leading-snug text-amber-800">
          Cada aparelho guarda seus próprios dados. Para levar tudo de um para o outro: Dinheiro → Backup → exportar JSON e Restaurar no novo aparelho.
        </p>
      </div>
    </Modal>
  );
}
