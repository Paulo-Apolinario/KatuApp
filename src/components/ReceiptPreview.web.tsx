import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReceiptPreviewProps } from "./ReceiptPreview";
export default function ReceiptPreview({
  uri,
  fileName,
  html,
  onClose,
}: ReceiptPreviewProps) {
  const root = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") close.current();
      if (e.key !== "Tab") return;
      const controls = root.current?.querySelectorAll<HTMLElement>(
        "a[href],button,iframe",
      );
      const first = controls?.[0],
        last = controls?.[controls.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === root.current)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === root.current)
      ) {
        e.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      URL.revokeObjectURL(uri);
      previous?.isConnected && previous.focus();
    };
  }, [uri]);
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20000,
        background: "#102c26bb",
        padding: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-preview-title"
        tabIndex={-1}
        style={{
          background: "white",
          borderRadius: 12,
          width: "100%",
          maxWidth: 1080,
          height: "94dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          outline: "none",
        }}
      >
        <header
          style={{
            padding: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            borderBottom: "1px solid #dce6df",
          }}
        >
          <h2
            id="receipt-preview-title"
            style={{
              fontSize: 18,
              margin: 0,
              flex: "1 1 180px",
              color: "#123c35",
            }}
          >
            Comprovante em PDF
          </h2>
          <a
            href={uri}
            download={fileName}
            style={{
              background: "#047857",
              color: "white",
              padding: "10px 16px",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Baixar PDF
          </a>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 16px",
              border: "1px solid #799488",
              borderRadius: 8,
              background: "white",
              cursor: "pointer",
            }}
          >
            Fechar
          </button>
        </header>
        <iframe
          title="Visualização do comprovante PDF"
          src={navigator.pdfViewerEnabled ? uri : undefined}
          srcDoc={!navigator.pdfViewerEnabled ? html : undefined}
          sandbox={!navigator.pdfViewerEnabled ? "" : undefined}
          style={{ flex: 1, width: "100%", border: 0, minHeight: 0 }}
        />
        <p style={{ fontSize: 12, color: "#52675e", margin: 0, padding: 12 }}>
          Se o navegador não exibir o documento, use Baixar PDF para abrir no
          seu leitor. Documento interno; não substitui MTR, CDF ou documento
          fiscal.
        </p>
      </div>
    </div>,
    document.body,
  );
}
