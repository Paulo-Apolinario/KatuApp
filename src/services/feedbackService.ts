import { api } from "./api";

export type FeedbackCategory =
  | "ATENDIMENTO"
  | "PONTUALIDADE"
  | "COLETA"
  | "APLICATIVO"
  | "COMUNICACAO";

export type SendFeedbackPayload = {
  npsScore: number;
  categories: FeedbackCategory[];
  reason?: string;
  improvement?: string;
  likes?: string;
  continuity?: string;
};

export type SendFeedbackResponse = {
  success: boolean;
  message: string;
  feedbackId: string;
  emailSent: boolean;
  destinationEmail?: string;
  senderEmail?: string;
};

export async function sendFeedback(
  payload: SendFeedbackPayload
): Promise<SendFeedbackResponse> {
  return api.post<SendFeedbackResponse>("/feedback", payload, true);
}