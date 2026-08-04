import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { CollectionMaterial } from "@/src/types/collection";

type TopMaterial = {
  type: string;
  quantityKg: number;
};

interface UserData {
  id?: string;
  name?: string;
  age?: number;
  location?: string;
  cpf?: string;
  phone?: string;
  email?: string;
  code?: string;
  totalKg?: number;
  since?: string;
  topMaterials?: TopMaterial[];
}

interface ReceiptData {
  id: string;
  local: string;
  date: string;
  kg: number;
  materials: CollectionMaterial[];
}

interface GenerateReceiptResult {
  success: boolean;
  filePath?: string;
  mode?: "share" | "print";
  error?: string;
}

const escapeHtml = (value: string | number | null | undefined): string => {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const formatKg = (value?: number) => Number(value ?? 0).toFixed(1);

const sanitizeFileNamePart = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const renderMaterialsTable = (materials?: CollectionMaterial[]) => {
  if (!materials || materials.length === 0) {
    return `
      <tr>
        <td colspan="2" class="empty-cell">Nenhum material informado</td>
      </tr>
    `;
  }

  return materials
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.type)}</td>
          <td class="text-right">${escapeHtml(formatKg(item.quantityKg))} kg</td>
        </tr>
      `
    )
    .join("");
};

const renderTopMaterialsTable = (materials?: TopMaterial[]) => {
  if (!materials || materials.length === 0) {
    return `
      <tr>
        <td colspan="3" class="empty-cell">Nenhum material consolidado até o momento</td>
      </tr>
    `;
  }

  return materials
    .map(
      (item, index) => `
        <tr>
          <td class="text-center">${index + 1}</td>
          <td>${escapeHtml(item.type)}</td>
          <td class="text-right">${escapeHtml(formatKg(item.quantityKg))} kg</td>
        </tr>
      `
    )
    .join("");
};

const buildReceiptHtml = (
  userData: UserData,
  receipt?: ReceiptData
): { html: string; fileName: string } => {
  const now = new Date();
  const currentDate = now.toLocaleDateString("pt-BR");
  const currentTime = now.toLocaleTimeString("pt-BR");

  const safeName = userData.name ?? "Catador";
  const safeLocation = userData.location ?? "-";
  const safeCpf = userData.cpf ?? "-";
  const safePhone = userData.phone ?? "-";
  const safeEmail = userData.email ?? "-";
  const safeCode = userData.code ?? "-";
  const safeSince = userData.since ?? "-";
  const safeTotalKg = Number(userData.totalKg ?? 0);
  const safeTopMaterials = userData.topMaterials ?? [];

  const documentTitle = receipt
    ? "Comprovante Operacional de Coleta"
    : "Comprovante Consolidado de Serviço";

  const documentNumber = receipt
    ? `COL-${receipt.id.slice(0, 8).toUpperCase()}`
    : `CON-${String(safeCode || "GERAL").slice(0, 8).toUpperCase()}`;

  const fileName = receipt
    ? `Comprovante_KATUA_Coleta_${sanitizeFileNamePart(
        receipt.id.slice(0, 8)
      )}_${currentDate.replace(/\//g, "-")}.pdf`
    : `Comprovante_KATUA_Consolidado_${sanitizeFileNamePart(
        String(safeCode || "geral")
      )}_${currentDate.replace(/\//g, "-")}.pdf`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(documentTitle)}</title>

  <style>
    @page {
      size: A4;
      margin: 14mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .document {
      width: 100%;
      max-width: 760px;
      margin: 0 auto;
    }

    .header {
      background: linear-gradient(135deg, #10f35d 0%, #028c56 100%);
      color: #ffffff;
      border-radius: 18px;
      padding: 22px 24px;
      margin-bottom: 16px;
    }

    .header-top {
      display: table;
      width: 100%;
    }

    .header-left,
    .header-right {
      display: table-cell;
      vertical-align: top;
    }

    .header-right {
      text-align: right;
      width: 42%;
    }

    .brand {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }

    .brand-subtitle {
      font-size: 12px;
      line-height: 1.5;
      opacity: 0.95;
      margin: 0;
    }

    .doc-badge {
      display: inline-block;
      margin-top: 10px;
      padding: 7px 12px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border: 1px solid rgba(255,255,255,0.28);
      background: rgba(255,255,255,0.14);
    }

    .doc-meta {
      font-size: 11px;
      line-height: 1.7;
      margin-top: 6px;
    }

    .summary-hero {
      border: 1px solid #bbf7d0;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border-radius: 16px;
      padding: 16px;
      text-align: center;
      margin-bottom: 14px;
    }

    .summary-label {
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #166534;
      font-weight: 700;
    }

    .summary-value {
      margin-top: 8px;
      font-size: 32px;
      font-weight: 900;
      color: #047857;
      line-height: 1.1;
    }

    .summary-unit {
      font-size: 16px;
      font-weight: 700;
      margin-left: 4px;
    }

    .section-grid {
      display: table;
      width: 100%;
      border-spacing: 0 12px;
    }

    .row {
      display: table;
      width: 100%;
      table-layout: fixed;
    }

    .col {
      display: table-cell;
      width: 50%;
      vertical-align: top;
    }

    .col.left {
      padding-right: 7px;
    }

    .col.right {
      padding-left: 7px;
    }

    .card,
    .full-card {
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 14px;
      background: #ffffff;
    }

    .card {
      height: 100%;
    }

    .full-card {
      margin-top: 2px;
    }

    .card-title {
      margin: 0 0 10px 0;
      font-size: 12px;
      font-weight: 800;
      color: #028c56;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .info-table {
      width: 100%;
      border-collapse: collapse;
    }

    .info-table tr:not(:last-child) td {
      border-bottom: 1px solid #eef2f7;
    }

    .info-label,
    .info-value {
      padding: 8px 0;
      font-size: 12px;
      vertical-align: top;
    }

    .info-label {
      width: 42%;
      color: #6b7280;
    }

    .info-value {
      color: #111827;
      font-weight: 700;
      text-align: right;
      word-break: break-word;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }

    .data-table thead th {
      background: #f8fafc;
      color: #374151;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 9px 10px;
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
    }

    .data-table tbody td {
      padding: 10px;
      border-bottom: 1px solid #eef2f7;
      font-size: 12px;
      color: #111827;
    }

    .data-table tbody tr:last-child td {
      border-bottom: none;
    }

    .text-right {
      text-align: right;
    }

    .text-center {
      text-align: center;
    }

    .empty-cell {
      text-align: center;
      color: #6b7280 !important;
      font-style: italic;
      padding: 14px !important;
    }

    .legal-box {
      margin-top: 14px;
      border: 1px solid #fde68a;
      background: #fffbeb;
      border-radius: 16px;
      padding: 14px;
    }

    .legal-title {
      margin: 0 0 8px 0;
      font-size: 12px;
      font-weight: 800;
      color: #92400e;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .legal-text {
      margin: 0;
      color: #78350f;
      font-size: 12px;
      line-height: 1.6;
      text-align: justify;
    }

    .signature-area {
      margin-top: 24px;
      text-align: center;
    }

    .signature-line {
      width: 260px;
      max-width: 100%;
      margin: 0 auto 8px auto;
      border-top: 1px solid #9ca3af;
      height: 1px;
    }

    .signature-label {
      font-size: 12px;
      color: #6b7280;
    }

    .footer {
      margin-top: 16px;
      border-top: 1px solid #e5e7eb;
      padding-top: 10px;
      color: #6b7280;
      font-size: 10px;
      line-height: 1.6;
    }

    .footer-strong {
      color: #374151;
      font-weight: 700;
    }

    @media print {
      body {
        background: #ffffff;
      }

      .document {
        max-width: none;
      }
    }
  </style>
</head>

<body>
  <div class="document">
    <div class="header">
      <div class="header-top">
        <div class="header-left">
          <div class="brand">KATUÁ</div>
          <p class="brand-subtitle">
            Plataforma inteligente para gestão de resíduos recicláveis
          </p>
          <div class="doc-badge">${escapeHtml(documentTitle)}</div>
        </div>

        <div class="header-right">
          <div class="doc-meta">
            <div><strong>Nº do documento:</strong> ${escapeHtml(documentNumber)}</div>
            <div><strong>Emissão:</strong> ${escapeHtml(currentDate)} às ${escapeHtml(currentTime)}</div>
            <div><strong>Canal:</strong> Sistema KATUÁ</div>
          </div>
        </div>
      </div>
    </div>

    <div class="summary-hero">
      <div class="summary-label">Peso total comprovado</div>
      <div class="summary-value">
        ${escapeHtml(formatKg(receipt ? receipt.kg : safeTotalKg))}
        <span class="summary-unit">kg</span>
      </div>
    </div>

    <div class="section-grid">
      <div class="row">
        <div class="col left">
          <div class="card">
            <h2 class="card-title">Identificação do catador</h2>
            <table class="info-table">
              <tr>
                <td class="info-label">Nome</td>
                <td class="info-value">${escapeHtml(safeName)}</td>
              </tr>
              <tr>
                <td class="info-label">Código</td>
                <td class="info-value">${escapeHtml(safeCode)}</td>
              </tr>
              <tr>
                <td class="info-label">CPF</td>
                <td class="info-value">${escapeHtml(safeCpf)}</td>
              </tr>
              <tr>
                <td class="info-label">Telefone</td>
                <td class="info-value">${escapeHtml(safePhone)}</td>
              </tr>
              <tr>
                <td class="info-label">E-mail</td>
                <td class="info-value">${escapeHtml(safeEmail)}</td>
              </tr>
              <tr>
                <td class="info-label">Localidade</td>
                <td class="info-value">${escapeHtml(safeLocation)}</td>
              </tr>
              <tr>
                <td class="info-label">Atuação desde</td>
                <td class="info-value">${escapeHtml(safeSince)}</td>
              </tr>
            </table>
          </div>
        </div>

        <div class="col right">
          <div class="card">
            <h2 class="card-title">
              ${receipt ? "Dados da coleta" : "Resumo consolidado"}
            </h2>

            <table class="info-table">
              ${
                receipt
                  ? `
                    <tr>
                      <td class="info-label">Data da coleta</td>
                      <td class="info-value">${escapeHtml(receipt.date)}</td>
                    </tr>
                    <tr>
                      <td class="info-label">Código da coleta</td>
                      <td class="info-value">${escapeHtml(receipt.id)}</td>
                    </tr>
                    <tr>
                      <td class="info-label">Peso total</td>
                      <td class="info-value">${escapeHtml(formatKg(receipt.kg))} kg</td>
                    </tr>
                    <tr>
                      <td class="info-label">Observações</td>
                      <td class="info-value">${escapeHtml(receipt.local || "-")}</td>
                    </tr>
                    <tr>
                      <td class="info-label">Tipo</td>
                      <td class="info-value">Comprovante individual</td>
                    </tr>
                  `
                  : `
                    <tr>
                      <td class="info-label">Data de emissão</td>
                      <td class="info-value">${escapeHtml(currentDate)}</td>
                    </tr>
                    <tr>
                      <td class="info-label">Hora da emissão</td>
                      <td class="info-value">${escapeHtml(currentTime)}</td>
                    </tr>
                    <tr>
                      <td class="info-label">Peso consolidado</td>
                      <td class="info-value">${escapeHtml(formatKg(safeTotalKg))} kg</td>
                    </tr>
                    <tr>
                      <td class="info-label">Materiais em destaque</td>
                      <td class="info-value">${escapeHtml(String(safeTopMaterials.length))}</td>
                    </tr>
                    <tr>
                      <td class="info-label">Tipo</td>
                      <td class="info-value">Comprovante consolidado</td>
                    </tr>
                  `
              }
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="full-card">
      <h2 class="card-title">
        ${receipt ? "Materiais da coleta" : "Materiais com maior volume"}
      </h2>

      <table class="data-table">
        <thead>
          ${
            receipt
              ? `
                <tr>
                  <th>Material</th>
                  <th class="text-right">Quantidade</th>
                </tr>
              `
              : `
                <tr>
                  <th class="text-center" style="width: 72px;">Posição</th>
                  <th>Material</th>
                  <th class="text-right">Quantidade</th>
                </tr>
              `
          }
        </thead>
        <tbody>
          ${
            receipt
              ? renderMaterialsTable(receipt.materials)
              : renderTopMaterialsTable(safeTopMaterials)
          }
        </tbody>
      </table>
    </div>

    <div class="legal-box">
      <h3 class="legal-title">Declaração operacional</h3>
      <p class="legal-text">
        Declaramos, para os devidos fins, que
        <strong> ${escapeHtml(safeName)}</strong>
        está vinculado às operações registradas no sistema KATUÁ para coleta
        e destinação adequada de resíduos recicláveis.
        ${
          receipt
            ? ` Este documento comprova a execução da coleta identificada por
              <strong>${escapeHtml(receipt.id)}</strong>, realizada em
              <strong>${escapeHtml(receipt.date)}</strong>, com volume total de
              <strong>${escapeHtml(formatKg(receipt.kg))} kg</strong>.`
            : ` Este documento consolida o histórico operacional do usuário
              até a data de emissão, totalizando
              <strong>${escapeHtml(formatKg(safeTotalKg))} kg</strong>
              registrados no sistema.`
        }
      </p>
    </div>

    <div class="signature-area">
      <div class="signature-line"></div>
      <div class="signature-label">
        Assinatura do responsável / representante operacional
      </div>
    </div>

    <div class="footer">
      <div>
        <span class="footer-strong">Documento gerado automaticamente</span>
        pelo sistema KATUÁ em ${escapeHtml(currentDate)} às
        ${escapeHtml(currentTime)}.
      </div>
      <div>
        Este comprovante é destinado à comprovação operacional, registro digital
        e apresentação institucional da atividade executada.
      </div>
    </div>
  </div>
</body>
</html>
`;

  return { html, fileName };
};

const printHtmlOnWeb = async (html: string) => {
  if (typeof window === "undefined") {
    throw new Error("Ambiente web indisponível para impressão.");
  }

  const printWindow = window.open("", "_blank", "width=900,height=1200");

  if (!printWindow) {
    throw new Error("Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups.");
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
  }, 500);
};

export const generateReceiptPDF = async (
  userData: UserData | null | undefined,
  receipt?: ReceiptData
): Promise<GenerateReceiptResult> => {
  try {
    if (!userData) {
      return {
        success: false,
        error: "Dados do usuário não encontrados.",
      };
    }

    const { html } = buildReceiptHtml(userData, receipt);

    if (Platform.OS === "web") {
      await printHtmlOnWeb(html);

      return {
        success: true,
        mode: "print",
      };
    }

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    const canShare = await Sharing.isAvailableAsync();

    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Compartilhar comprovante KATUÁ",
        UTI: ".pdf",
      });
    }

    return {
      success: true,
      filePath: uri,
      mode: "share",
    };
  } catch (error) {
    console.error("Erro ao gerar comprovante PDF:", error);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o comprovante em PDF.",
    };
  }
};