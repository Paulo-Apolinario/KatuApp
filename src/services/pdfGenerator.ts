import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

interface UserData {
  name: string;
  age: number;
  location: string;
  cpf: string;
  phone: string;
  totalKg: number;
  since: string;
  code: string;
  topMaterials: string[];
}

interface ReceiptData {
  date: string;
  kg: number;
  materials: string[];
}

interface GenerateReceiptResult {
  success: boolean;
  filePath?: string;
}

const escapeHtml = (value: string | number | null | undefined): string => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const generateReceiptPDF = async (
  userData: UserData,
  receipt?: ReceiptData
): Promise<GenerateReceiptResult> => {
  try {
    if (!FileSystem.documentDirectory) {
      Alert.alert(
        'Erro',
        'Não foi possível acessar o armazenamento do dispositivo.'
      );
      return { success: false };
    }

    const now = new Date();
    const currentDate = now.toLocaleDateString('pt-BR');
    const currentTime = now.toLocaleTimeString('pt-BR');

    const safeTopMaterials = userData.topMaterials ?? [];
    const safeReceiptMaterials = receipt?.materials ?? [];

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Comprovante KATU</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #ffffff;
            padding: 30px;
            color: #1f2937;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #028C56;
          }
          .logo {
            font-size: 42px;
            font-weight: 800;
            color: #028C56;
            letter-spacing: 1px;
            margin-bottom: 5px;
          }
          .subtitle {
            font-size: 14px;
            color: #6b7280;
          }
          .title {
            font-size: 24px;
            font-weight: 700;
            color: #028C56;
            text-align: center;
            margin: 25px 0;
          }
          .card {
            background: #f9fafb;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            border: 1px solid #e5e7eb;
          }
          .card-title {
            font-size: 18px;
            font-weight: 600;
            color: #028C56;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e5e7eb;
          }
          .info-row {
            display: flex;
            margin-bottom: 12px;
            align-items: flex-start;
          }
          .info-label {
            width: 120px;
            font-weight: 600;
            color: #4b5563;
          }
          .info-value {
            flex: 1;
            color: #1f2937;
          }
          .total-box {
            background: #f0fdf4;
            border: 2px solid #028C56;
            border-radius: 16px;
            padding: 25px;
            text-align: center;
            margin: 25px 0;
          }
          .total-label {
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 8px;
          }
          .total-value {
            font-size: 48px;
            font-weight: 800;
            color: #028C56;
            line-height: 1.2;
          }
          .total-unit {
            font-size: 18px;
            color: #6b7280;
            margin-left: 5px;
          }
          .materials-list {
            margin-top: 10px;
          }
          .material-item {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
          }
          .material-rank {
            width: 30px;
            height: 30px;
            background: #028C56;
            border-radius: 15px;
            color: white;
            text-align: center;
            line-height: 30px;
            font-weight: 600;
            margin-right: 10px;
          }
          .material-name {
            font-size: 16px;
            color: #1f2937;
          }
          .declaration {
            background: #f3f4f6;
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
            font-style: italic;
            line-height: 1.8;
            color: #4b5563;
            border-left: 4px solid #028C56;
          }
          .signature {
            margin-top: 40px;
            text-align: center;
          }
          .signature-line {
            width: 300px;
            border-top: 2px solid #1f2937;
            margin: 0 auto 10px;
            padding-top: 10px;
          }
          .signature-text {
            color: #6b7280;
            font-size: 14px;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #9ca3af;
            font-size: 12px;
          }
          .badge {
            background: #028C56;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            display: inline-block;
            margin-bottom: 15px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">KATU</div>
            <div class="subtitle">Sistema de Gestão de Resíduos</div>
          </div>

          <div class="badge">${receipt ? 'COLETA INDIVIDUAL' : 'COMPROVANTE DE SERVIÇO'}</div>

          <div class="card">
            <div class="card-title">📋 DADOS DO CATADOR</div>
            <div class="info-row">
              <span class="info-label">Nome:</span>
              <span class="info-value">${escapeHtml(userData.name)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Idade:</span>
              <span class="info-value">${escapeHtml(userData.age)} anos</span>
            </div>
            <div class="info-row">
              <span class="info-label">Localidade:</span>
              <span class="info-value">${escapeHtml(userData.location)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">CPF:</span>
              <span class="info-value">${escapeHtml(userData.cpf)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Contato:</span>
              <span class="info-value">${escapeHtml(userData.phone)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Código:</span>
              <span class="info-value"><strong>${escapeHtml(userData.code)}</strong></span>
            </div>
            <div class="info-row">
              <span class="info-label">Catador desde:</span>
              <span class="info-value">${escapeHtml(userData.since)}</span>
            </div>
          </div>

          ${
            receipt
              ? `
            <div class="card">
              <div class="card-title">📦 DETALHES DA COLETA</div>
              <div class="info-row">
                <span class="info-label">Data:</span>
                <span class="info-value"><strong>${escapeHtml(receipt.date)}</strong></span>
              </div>
              <div class="info-row">
                <span class="info-label">Peso:</span>
                <span class="info-value"><strong>${escapeHtml(receipt.kg)} kg</strong></span>
              </div>
              <div class="info-row">
                <span class="info-label">Materiais:</span>
                <span class="info-value">${safeReceiptMaterials.map(escapeHtml).join(', ')}</span>
              </div>
            </div>
          `
              : ''
          }

          <div class="total-box">
            <div class="total-label">TOTAL DE RESÍDUOS COLETADOS</div>
            <div class="total-value">${escapeHtml(userData.totalKg)}<span class="total-unit">kg</span></div>
          </div>

          <div class="card">
            <div class="card-title">🏆 PRINCIPAIS MATERIAIS</div>
            <div class="materials-list">
              ${safeTopMaterials
                .map(
                  (material, index) => `
                <div class="material-item">
                  <div class="material-rank">${index + 1}</div>
                  <div class="material-name">${escapeHtml(material)}</div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="declaration">
            <p style="margin-bottom: 15px;">
              Declaramos, para os devidos fins, que <strong>${escapeHtml(userData.name)}</strong>,
              portador(a) do CPF nº <strong>${escapeHtml(userData.cpf)}</strong>, exerceu atividades
              como catador(a) de materiais recicláveis no período de <strong>${escapeHtml(userData.since)}</strong>
              até a presente data, realizando coleta, separação e destinação adequada de resíduos recicláveis.
            </p>
            <p>
              Esta declaração é emitida a pedido do(a) interessado(a) para comprovação de experiência e atuação na área.
            </p>
          </div>

          <div class="signature">
            <div class="signature-line"></div>
            <div class="signature-text">Assinatura do representante</div>
          </div>

          <div class="footer">
            <p>Documento gerado pelo sistema KATU em ${escapeHtml(currentDate)} às ${escapeHtml(currentTime)}</p>
            <p>Este é um documento válido como comprovante de serviço.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const fileName = receipt
      ? `Comprovante_KATU_${receipt.date.replace(/\//g, '-')}.html`
      : `Comprovante_KATU_${userData.code}.html`;

    const filePath = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, htmlContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();

    if (isAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'text/html',
        dialogTitle: 'Comprovante KATU',
        UTI: 'public.html',
      });
    } else {
      Alert.alert(
        'Comprovante gerado',
        'O comprovante foi gerado com sucesso, mas o compartilhamento não está disponível neste dispositivo.'
      );
    }

    return { success: true, filePath };
  } catch (error) {
    console.error('Erro ao gerar comprovante:', error);
    Alert.alert(
      'Erro',
      'Não foi possível gerar o comprovante. Tente novamente.'
    );
    return { success: false };
  }
};