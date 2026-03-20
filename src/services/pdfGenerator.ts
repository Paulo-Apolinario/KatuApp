import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

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
  topMaterials?: string[];
}

interface ReceiptData {
  id: string;
  local: string;
  date: string;
  kg: number;
  materials: string[];
}

interface GenerateReceiptResult {
  success: boolean;
  filePath?: string;
}

const escapeHtml = (value: string | number | null | undefined): string => {
  return String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const generateReceiptPDF = async (
  userData: UserData | null | undefined,
  receipt?: ReceiptData
): Promise<GenerateReceiptResult> => {
  try {
    if (!userData) {
      Alert.alert('Erro', 'Dados do usuário não encontrados.');
      return { success: false };
    }

    if (!FileSystem.documentDirectory) {
      Alert.alert('Erro', 'Não foi possível acessar o armazenamento do dispositivo.');
      return { success: false };
    }

    const now = new Date();
    const currentDate = now.toLocaleDateString('pt-BR');
    const currentTime = now.toLocaleTimeString('pt-BR');

    // Valores seguros com fallback
    const safeName = userData.name ?? 'Catador';
    const safeLocation = userData.location ?? '-';
    const safeCpf = userData.cpf ?? '-';
    const safePhone = userData.phone ?? '-';
    const safeCode = userData.code ?? '-';
    const safeSince = userData.since ?? '-';
    const safeTotalKg = userData.totalKg ?? 0;
    const safeTopMaterials = userData.topMaterials ?? [];
    const safeReceiptMaterials = receipt?.materials ?? [];

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Comprovante KATUÁ</title>
        <style>
          /* ... seu CSS original mantido igual ... */
          /* (copie o <style> inteiro do seu código original aqui) */
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">KATUÁ</div>
            <div class="subtitle">Sistema de Gestão de Resíduos</div>
          </div>

          <div class="badge">${receipt ? 'COLETA INDIVIDUAL' : 'COMPROVANTE DE SERVIÇO'}</div>

          <div class="card">
            <div class="card-title">📋 DADOS DO CATADOR</div>
            <div class="info-row">
              <span class="info-label">Nome:</span>
              <span class="info-value">${escapeHtml(safeName)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Localidade:</span>
              <span class="info-value">${escapeHtml(safeLocation)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">CPF:</span>
              <span class="info-value">${escapeHtml(safeCpf)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Contato:</span>
              <span class="info-value">${escapeHtml(safePhone)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Código:</span>
              <span class="info-value"><strong>${escapeHtml(safeCode)}</strong></span>
            </div>
            <div class="info-row">
              <span class="info-label">Catador desde:</span>
              <span class="info-value">${escapeHtml(safeSince)}</span>
            </div>
          </div>

          ${receipt ? `
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
                <span class="info-value">${safeReceiptMaterials.map(escapeHtml).join(', ') || '-'}</span>
              </div>
              ${receipt.local ? `
                <div class="info-row">
                  <span class="info-label">Local/Obs:</span>
                  <span class="info-value">${escapeHtml(receipt.local)}</span>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <div class="total-box">
            <div class="total-label">TOTAL DE RESÍDUOS COLETADOS</div>
            <div class="total-value">${escapeHtml(safeTotalKg)}<span class="total-unit">kg</span></div>
          </div>

          <div class="card">
            <div class="card-title">🏆 PRINCIPAIS MATERIAIS</div>
            <div class="materials-list">
              ${safeTopMaterials.length > 0
                ? safeTopMaterials
                    .map(
                      (material, index) => `
                        <div class="material-item">
                          <div class="material-rank">${index + 1}</div>
                          <div class="material-name">${escapeHtml(material)}</div>
                        </div>
                      `
                    )
                    .join('')
                : '<p style="color:#6b7280;">Nenhum material registrado</p>'}
            </div>
          </div>

          <div class="declaration">
            <p style="margin-bottom: 15px;">
              Declaramos, para os devidos fins, que <strong>${escapeHtml(safeName)}</strong>,
              ${safeCpf !== '-' ? `portador(a) do CPF nº <strong>${escapeHtml(safeCpf)}</strong>, ` : ''}
              exerceu atividades como catador(a) de materiais recicláveis no período de 
              <strong>${escapeHtml(safeSince)}</strong> até a presente data, realizando coleta, 
              separação e destinação adequada de resíduos recicláveis.
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
      ? `Comprovante_KATU_${receipt.date.replace(/\//g, '-')}_${receipt.id.slice(0, 8)}.html`
      : `Comprovante_KATU_${safeCode || 'geral'}_${currentDate.replace(/\//g, '-')}.html`;

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
        'O comprovante foi salvo, mas o compartilhamento não está disponível neste dispositivo.'
      );
    }

    return { success: true, filePath };
  } catch (error) {
    console.error('Erro ao gerar comprovante:', error);
    Alert.alert('Erro', 'Não foi possível gerar o comprovante. Tente novamente.');
    return { success: false };
  }
};