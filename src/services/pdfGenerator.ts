import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
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

const renderMaterials = (materials?: CollectionMaterial[]) => {
  if (!materials || materials.length === 0) {
    return `<div class="empty-text">Nenhum material informado</div>`;
  }

  return materials
    .map(
      (item) => `
        <div class="material-line">
          <div class="material-name">${escapeHtml(item.type)}</div>
          <div class="material-kg">${escapeHtml(formatKg(item.quantityKg))} kg</div>
        </div>
      `
    )
    .join("");
};

const renderTopMaterials = (materials?: TopMaterial[]) => {
  if (!materials || materials.length === 0) {
    return `<div class="empty-text">Nenhum material consolidado até o momento</div>`;
  }

  return materials
    .map(
      (item, index) => `
        <div class="ranking-item">
          <div class="ranking-left">
            <div class="ranking-badge">${index + 1}</div>
            <div class="ranking-name">${escapeHtml(item.type)}</div>
          </div>
          <div class="ranking-value">${escapeHtml(formatKg(item.quantityKg))} kg</div>
        </div>
      `
    )
    .join("");
};

export const generateReceiptPDF = async (
  userData: UserData | null | undefined,
  receipt?: ReceiptData
): Promise<GenerateReceiptResult> => {
  try {
    if (!userData) {
      Alert.alert("Erro", "Dados do usuário não encontrados.");
      return { success: false };
    }

    if (!FileSystem.documentDirectory) {
      Alert.alert("Erro", "Não foi possível acessar o armazenamento do dispositivo.");
      return { success: false };
    }

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
      ? "Comprovante Individual de Coleta"
      : "Comprovante Consolidado de Serviço";

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(documentTitle)}</title>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
            background: #eef2f7;
            color: #111827;
            padding: 24px;
          }

          .page {
            max-width: 900px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
          }

          .header {
            background: linear-gradient(135deg, #10f35d 0%, #028c56 100%);
            padding: 32px;
            color: #ffffff;
          }

          .brand {
            font-size: 28px;
            font-weight: 800;
            letter-spacing: 1px;
          }

          .subtitle {
            margin-top: 8px;
            font-size: 15px;
            opacity: 0.95;
          }

          .document-tag {
            display: inline-block;
            margin-top: 18px;
            background: rgba(255, 255, 255, 0.18);
            border: 1px solid rgba(255, 255, 255, 0.28);
            padding: 10px 16px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .content {
            padding: 28px;
          }

          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
            margin-bottom: 18px;
          }

          .card {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            padding: 20px;
          }

          .card.full {
            grid-column: 1 / -1;
          }

          .card-title {
            font-size: 14px;
            font-weight: 800;
            color: #028c56;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin-bottom: 16px;
          }

          .info-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
          }

          .info-row:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }

          .info-label {
            color: #6b7280;
            font-size: 13px;
          }

          .info-value {
            color: #111827;
            font-size: 13px;
            font-weight: 700;
            text-align: right;
          }

          .hero {
            background: linear-gradient(135deg, #ecfdf5 0%, #dcfce7 100%);
            border: 1px solid #bbf7d0;
            border-radius: 20px;
            padding: 24px;
            margin-bottom: 18px;
            text-align: center;
          }

          .hero-label {
            font-size: 13px;
            font-weight: 700;
            color: #166534;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .hero-value {
            font-size: 42px;
            line-height: 1.1;
            font-weight: 900;
            color: #047857;
            margin-top: 10px;
          }

          .hero-unit {
            font-size: 22px;
            margin-left: 4px;
          }

          .material-line,
          .ranking-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
          }

          .material-line:last-child,
          .ranking-item:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }

          .material-name,
          .ranking-name {
            font-size: 14px;
            color: #111827;
            font-weight: 700;
          }

          .material-kg,
          .ranking-value {
            font-size: 14px;
            color: #028c56;
            font-weight: 800;
            white-space: nowrap;
          }

          .ranking-left {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .ranking-badge {
            width: 28px;
            height: 28px;
            border-radius: 14px;
            background: #dcfce7;
            color: #166534;
            font-size: 13px;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .declaration {
            margin-top: 18px;
            background: #fff7ed;
            border: 1px solid #fed7aa;
            border-radius: 18px;
            padding: 20px;
            color: #7c2d12;
            line-height: 1.7;
            font-size: 14px;
          }

          .signature {
            margin-top: 28px;
            text-align: center;
            padding-top: 18px;
          }

          .signature-line {
            width: 280px;
            max-width: 100%;
            height: 1px;
            background: #9ca3af;
            margin: 0 auto 8px auto;
          }

          .signature-text {
            font-size: 13px;
            color: #6b7280;
          }

          .footer {
            margin-top: 28px;
            padding: 20px 28px 28px 28px;
            background: #f8fafc;
            color: #6b7280;
            font-size: 12px;
            line-height: 1.7;
            border-top: 1px solid #e5e7eb;
          }

          .empty-text {
            font-size: 14px;
            color: #6b7280;
          }

          @media print {
            body {
              background: #ffffff;
              padding: 0;
            }

            .page {
              box-shadow: none;
              border-radius: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div class="brand">KATUÁ</div>
            <div class="subtitle">Sistema inteligente de gestão de resíduos recicláveis</div>
            <div class="document-tag">${escapeHtml(documentTitle)}</div>
          </div>

          <div class="content">
            <div class="hero">
              <div class="hero-label">Total registrado</div>
              <div class="hero-value">${escapeHtml(formatKg(receipt ? receipt.kg : safeTotalKg))}<span class="hero-unit">kg</span></div>
            </div>

            <div class="grid">
              <div class="card">
                <div class="card-title">Dados do catador</div>
                <div class="info-row">
                  <span class="info-label">Nome</span>
                  <span class="info-value">${escapeHtml(safeName)}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Código</span>
                  <span class="info-value">${escapeHtml(safeCode)}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Localidade</span>
                  <span class="info-value">${escapeHtml(safeLocation)}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">CPF</span>
                  <span class="info-value">${escapeHtml(safeCpf)}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Contato</span>
                  <span class="info-value">${escapeHtml(safePhone)}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">E-mail</span>
                  <span class="info-value">${escapeHtml(safeEmail)}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Atuação desde</span>
                  <span class="info-value">${escapeHtml(safeSince)}</span>
                </div>
              </div>

              ${
                receipt
                  ? `
                    <div class="card">
                      <div class="card-title">Detalhes da coleta</div>
                      <div class="info-row">
                        <span class="info-label">Data</span>
                        <span class="info-value">${escapeHtml(receipt.date)}</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Código da coleta</span>
                        <span class="info-value">${escapeHtml(receipt.id)}</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Peso total</span>
                        <span class="info-value">${escapeHtml(formatKg(receipt.kg))} kg</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Observações</span>
                        <span class="info-value">${escapeHtml(receipt.local || "-")}</span>
                      </div>
                    </div>
                  `
                  : `
                    <div class="card">
                      <div class="card-title">Resumo consolidado</div>
                      <div class="info-row">
                        <span class="info-label">Data de emissão</span>
                        <span class="info-value">${escapeHtml(currentDate)}</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Hora</span>
                        <span class="info-value">${escapeHtml(currentTime)}</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Total geral</span>
                        <span class="info-value">${escapeHtml(formatKg(safeTotalKg))} kg</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Materiais em destaque</span>
                        <span class="info-value">${escapeHtml(String(safeTopMaterials.length))}</span>
                      </div>
                    </div>
                  `
              }

              ${
                receipt
                  ? `
                    <div class="card full">
                      <div class="card-title">Materiais da coleta</div>
                      ${renderMaterials(receipt.materials)}
                    </div>
                  `
                  : `
                    <div class="card full">
                      <div class="card-title">Materiais com maior volume</div>
                      ${renderTopMaterials(safeTopMaterials)}
                    </div>
                  `
              }
            </div>

            <div class="declaration">
              Declaramos, para os devidos fins, que <strong>${escapeHtml(
                safeName
              )}</strong> atua na coleta e destinação adequada de resíduos recicláveis por meio do sistema KATUÁ. ${
                receipt
                  ? `Este documento comprova a execução da coleta registrada em <strong>${escapeHtml(
                      receipt.date
                    )}</strong>, com volume total de <strong>${escapeHtml(
                      formatKg(receipt.kg)
                    )} kg</strong>.`
                  : `Este documento resume o histórico consolidado de atuação até a data de emissão, totalizando <strong>${escapeHtml(
                      formatKg(safeTotalKg)
                    )} kg</strong> coletados.`
              }
            </div>

            <div class="signature">
              <div class="signature-line"></div>
              <div class="signature-text">Assinatura do responsável / representante</div>
            </div>
          </div>

          <div class="footer">
            <div>Documento gerado pelo sistema KATUÁ em ${escapeHtml(currentDate)} às ${escapeHtml(currentTime)}.</div>
            <div>Arquivo preparado para compartilhamento digital e comprovação operacional.</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const fileName = receipt
      ? `Comprovante_KATUA_Coleta_${receipt.id.slice(0, 8)}_${currentDate.replace(
          /\//g,
          "-"
        )}.html`
      : `Comprovante_KATUA_Consolidado_${(safeCode || "geral").replace(
          /\s+/g,
          "_"
        )}_${currentDate.replace(/\//g, "-")}.html`;

    const filePath = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, htmlContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();

    if (isAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: "text/html",
        dialogTitle: "Comprovante KATUÁ",
        UTI: "public.html",
      });
    } else {
      Alert.alert(
        "Comprovante gerado",
        "O comprovante foi salvo, mas o compartilhamento não está disponível neste dispositivo."
      );
    }

    return { success: true, filePath };
  } catch (error) {
    console.error("Erro ao gerar comprovante:", error);
    Alert.alert("Erro", "Não foi possível gerar o comprovante. Tente novamente.");
    return { success: false };
  }
};