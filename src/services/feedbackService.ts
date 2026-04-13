import { api } from "./api";

export type FeedbackCategory =
  | "ATENDIMENTO"
  | "PONTUALIDADE"
  | "COLETA"
  | "APLICATIVO"
  | "COMUNICAÇÃO";

export type CreateFeedbackPayload = {
  npsScore: number;
  categories: FeedbackCategory[];
  reason?: string;
  improvement?: string;
  likes?: string;
  continuity?: string;
};

type FeedbackResponse = {
  success: boolean;
  message: string;
};

export async function sendFeedback(
  payload: CreateFeedbackPayload
): Promise<FeedbackResponse> {
  try {
    const response = await api.post<FeedbackResponse>(
      "/feedback",
      payload,
      true // 🔥 ESSENCIAL: envia o token JWT
    );

    return response;
  } catch (error: any) {
    console.error("[FEEDBACK] Erro ao enviar:", error);

    throw new Error(
      error?.message || "Erro ao enviar feedback. Tente novamente."
    );
  }
}