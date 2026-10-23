import { materialQuantity } from "../utils/materials";
import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type {
  CollectionMaterial,
  CollectionQuantityReview,
  WasteUnit,
} from "@/src/types/collection";

type TopMaterial = {
  type: string;
  quantityKg: number;
  quantity?: number;
  unit?: WasteUnit;
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
  cooperativeName?: string;
  collectionCount?: number;
  periodStart?: string;
  periodEnd?: string;
}

interface ReceiptData {
  quantityReviews?: CollectionQuantityReview[];
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

const formatKg = (value?: number) =>
  Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 3,
  });

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
          <td class="text-right">${escapeHtml(materialQuantity(item))}</td>
        </tr>
      `,
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
          <td class="text-right">${escapeHtml(materialQuantity(item))}</td>
        </tr>
      `,
    )
    .join("");
};

export const buildReceiptHtml = (
  userData: UserData,
  receipt?: ReceiptData,
): { html: string; fileName: string } => {
  const now = new Date(),
    currentDate = now.toLocaleDateString("pt-BR", {
      timeZone: "America/Fortaleza",
    }),
    currentTime = now.toLocaleTimeString("pt-BR", {
      timeZone: "America/Fortaleza",
    });
  const text = (value?: string) => value?.trim() || "Não informado";
  const name = text(userData.name),
    code = text(userData.code || userData.id);
  const documentTitle = receipt
    ? "Comprovante de coleta"
    : "Comprovante consolidado de serviço";
  const reference =
    receipt?.id || userData.code || userData.id || "sem-identificador";
  const documentNumber = `${receipt ? "COL" : "CON"}-${reference.toUpperCase()}-${now.getTime().toString(36).toUpperCase()}`;
  const fileName = `KATUA_${receipt ? "Coleta" : "Consolidado"}_${sanitizeFileNamePart(reference)}_${currentDate.replace(/\//g, "-")}.pdf`;
  const mass = receipt?.kg ?? userData.totalKg ?? 0;
  const period = receipt
    ? receipt.date
    : [userData.periodStart || userData.since, userData.periodEnd]
        .filter(Boolean)
        .join(" a ") || "Histórico disponível até a emissão";
  const row = (label: string, value: string) =>
    `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(text(value))}</td></tr>`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(documentTitle)}</title><style>
 @page {size:A4;margin:15mm 14mm 16mm;} *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#172E2A;font-size:12px;line-height:1.5;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact} .document{max-width:760px;margin:auto} .header{display:table;width:100%;border-bottom:2px solid #17674F;padding-bottom:18px;margin-bottom:24px}.brand{display:table-cell;vertical-align:top}.brand-name{font-size:27px;font-weight:700;letter-spacing:1.6px;color:#14533F}.brand-subtitle{font-size:9px;color:#64766E;margin-top:4px}.metadata{display:table-cell;text-align:right;vertical-align:top;font-size:9px;color:#52675E}.eyebrow{color:#36755D;font-size:9px;font-weight:700;letter-spacing:1.6px;margin-bottom:7px}h1{font-size:25px;line-height:1.2;letter-spacing:-.6px;margin:0 0 9px;color:#153B30;font-weight:600}.lead{margin:0 0 22px;color:#66786E;font-size:10px}.summary{display:table;width:100%;background:#EEF6F1;border:1px solid #D6E5DC;border-radius:10px;margin:0 0 22px}.summary-cell{display:table-cell;width:33%;padding:15px 17px;vertical-align:top}.summary-label{display:block;font-size:8px;letter-spacing:.8px;text-transform:uppercase;color:#587163;margin-bottom:7px}.summary-value{font-size:23px;line-height:1.2;font-weight:600;color:#14533F}.summary-value small{font-size:11px;font-weight:400}.summary-description{font-size:10px;line-height:1.5;color:#234E3B}.section{margin:0 0 22px}h2{font-size:12px;font-weight:600;color:#234E3B;margin:0 0 10px;padding-bottom:7px;border-bottom:1px solid #DCE6DF}.columns{display:table;width:100%;table-layout:fixed}.column{display:table-cell;width:50%;vertical-align:top}.column:first-child{padding-right:18px}.column:last-child{padding-left:18px;border-left:1px solid #E3EBE5}.info{border-collapse:collapse;width:100%;font-size:11px}.info th{color:#6A7A71;font-weight:400;text-align:left;width:30%;vertical-align:top;padding:5px 8px 5px 0}.info td{padding:5px 0;vertical-align:top;color:#203B2F;overflow-wrap:anywhere;word-break:break-word}.reference{font-family:monospace;font-size:8px;word-break:break-all;color:#52675E}.data-table{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}.data-table thead{display:table-header-group}.data-table th{text-align:left;background:#F0F4F1;color:#4A6657;font-size:8px;text-transform:uppercase;letter-spacing:.7px;padding:10px;border-top:1px solid #DAE5DD;border-bottom:1px solid #DAE5DD}.data-table td{padding:10px;border-bottom:1px solid #E6ECE8;overflow-wrap:anywhere}.data-table th:first-child{width:12%}.data-table.individual th:first-child{width:75%}.data-table th:last-child{width:25%;text-align:right}.data-table tr{break-inside:avoid;page-break-inside:avoid}.text-right{text-align:right;font-variant-numeric:tabular-nums}.text-center{text-align:center;color:#64766E}.empty-cell{color:#758279;text-align:center}.note{font-size:10px;color:#6A7A71;margin-top:9px}.statement{padding:15px 17px;border-left:3px solid #72A88B;background:#F7F9F7;border-radius:0 8px 8px 0;break-inside:avoid;page-break-inside:avoid}.statement h2{border:0;padding:0;margin:0 0 6px;font-size:10px}.statement p{margin:0;color:#5A6C61;font-size:9px}.signature{margin:42px 0 24px;break-inside:avoid;text-align:center}.signature-line{width:260px;max-width:80%;border-top:1px solid #AEBFB4;margin:auto auto 7px}.signature span{font-size:9px;color:#64766E}.footer{border-top:1px solid #DCE6DF;padding-top:12px;color:#748177;font-size:9px;line-height:1.6;break-inside:avoid}.footer strong{color:#3F5C49;font-weight:600}.print-tools{padding:14px;background:#123C35;color:white;font:13px Arial;margin-bottom:24px}.print-tools button{background:white;color:#123C35;padding:8px 14px;border:0;border-radius:6px;margin-right:12px;cursor:pointer}@media print{.print-tools{display:none}h2{break-after:avoid;page-break-after:avoid}}@media screen{body{background:#EAF0EC;padding:24px}.document{background:white;padding:42px;box-shadow:0 4px 24px #123C3510}}
 </style></head><body><div class="print-tools"><button id="print-document" type="button">Imprimir ou salvar PDF</button>Para salvar, escolha “Salvar como PDF” e desative os cabeçalhos e rodapés do navegador.</div><main class="document"><header class="header"><div class="brand"><div class="brand-name">KATUÁ</div><div class="brand-subtitle">Gestão da coleta seletiva</div></div><div class="metadata">REGISTRO OPERACIONAL<br>Emissão: ${escapeHtml(currentDate)} · ${escapeHtml(currentTime)}<br>Horário de Fortaleza (UTC−03)</div></header><div class="eyebrow">${receipt ? "REGISTRO INDIVIDUAL" : "HISTÓRICO CONSOLIDADO"}</div><h1>${escapeHtml(documentTitle)}</h1><p class="lead">${receipt ? "Materiais registrados na coleta identificada neste documento." : "Resumo das coletas concluídas presentes no histórico do catador."}</p>
 <section class="summary"><div class="summary-cell"><span class="summary-label">Massa registrada</span><div class="summary-value">${escapeHtml(formatKg(mass))} <small>kg</small></div></div><div class="summary-cell"><span class="summary-label">${receipt ? "Data da coleta" : "Coletas concluídas"}</span><div class="summary-description">${escapeHtml(receipt ? receipt.date : String(userData.collectionCount ?? "Não informado"))}</div></div><div class="summary-cell"><span class="summary-label">Período do histórico</span><div class="summary-description">${escapeHtml(period)}</div></div></section>
 <section class="section columns"><div class="column"><h2>Identificação do catador</h2><table class="info"><tbody>${row("Nome", name)}${row("CPF", userData.cpf || "")}${row("Telefone", userData.phone || "")}${row("E-mail", userData.email || "")}${row("Localidade", userData.location || "")}</tbody></table></div><div class="column"><h2>Identificação do registro</h2><table class="info"><tbody>${row("Cooperativa / OSC", userData.cooperativeName || "")}${row("Referência", receipt?.id || code)}${receipt ? row("Observações", receipt.local) : row("Abrangência", "Histórico disponível no sistema")}</tbody></table><p class="note">Documento <span class="reference">${escapeHtml(documentNumber)}</span></p></div></section>
 <section class="section"><h2>${receipt ? "Materiais da coleta" : "Materiais consolidados"}</h2><table class="data-table ${receipt ? "individual" : ""}"><thead><tr>${receipt ? "" : "<th scope=col>Item</th>"}<th scope=col>Material</th><th scope=col class="text-right">Quantidade registrada</th></tr></thead><tbody>${receipt ? renderMaterialsTable(receipt.materials) : renderTopMaterialsTable(userData.topMaterials)}</tbody></table><p class="note">Quantidades preservadas na unidade de origem. A massa em kg considera apenas kg e toneladas; litros, unidades e m³ não são convertidos em peso.</p></section>
 ${receipt?.quantityReviews?.map((review) => `<section class="section"><h2>Conferência ${review.version} da cooperativa</h2><p>${escapeHtml(review.actorName)} · ${escapeHtml(new Date(review.createdAt).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" }))}</p><p>${escapeHtml(review.reason)}</p><table class="data-table"><thead><tr><th>Material</th><th>Informado</th><th>Anterior</th><th>Conferido</th></tr></thead><tbody>${review.items.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(materialQuantity({ quantity: item.reportedQuantity, unit: item.unit }))}</td><td>${escapeHtml(materialQuantity({ quantity: item.previousQuantity, unit: item.unit }))}</td><td>${escapeHtml(materialQuantity({ quantity: item.confirmedQuantity, unit: item.unit }))}</td></tr>`).join("")}</tbody></table></section>`).join("") || ""}
 <section class="statement"><h2>Sobre este comprovante</h2><p>Este documento apresenta os registros operacionais de <strong>${escapeHtml(name)}</strong> disponíveis no sistema KATUÁ na data de emissão. As informações refletem o histórico consultado e não constituem certificação independente de pesagem ou destinação ambiental. Não substitui MTR, CDF ou documento fiscal.</p></section><section class="signature"><div class="signature-line"></div><span>Responsável pela conferência · nome e identificação</span></section><footer class="footer"><strong>KATUÁ · Registro operacional de coleta seletiva</strong><br>Gerado em ${escapeHtml(currentDate)} às ${escapeHtml(currentTime)} (Fortaleza). Para conferência, utilize a referência completa no histórico da cooperativa.</footer></main></body></html>`;
  return { html, fileName };
};

const printHtmlOnWeb = async (html: string) => {
  if (typeof window === "undefined") {
    throw new Error("Ambiente web indisponível para impressão.");
  }

  const printWindow = window.open("", "_blank", "width=900,height=1200");

  if (!printWindow) {
    throw new Error(
      "Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups.",
    );
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.focus();

  printWindow.document
    .getElementById("print-document")
    ?.addEventListener("click", () => printWindow.print());
  void printWindow.document.fonts.ready.then(() => {
    setTimeout(() => {
      if (!printWindow.closed) printWindow.print();
    }, 250);
  });
};

export const generateReceiptPDF = async (
  userData: UserData | null | undefined,
  receipt?: ReceiptData,
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
