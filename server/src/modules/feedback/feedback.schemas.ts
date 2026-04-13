export const createFeedbackSchema = {
  tags: ["Feedback"],
  summary: "Criar feedback e enviar para a cooperativa vinculada",
  security: [{ bearerAuth: [] }],
  body: {
    type: "object",
    required: ["npsScore", "categories"],
    properties: {
      npsScore: {
        type: "integer",
        minimum: 0,
        maximum: 10,
      },
      categories: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "ATENDIMENTO",
            "PONTUALIDADE",
            "COLETA",
            "APLICATIVO",
            "COMUNICACAO",
          ],
        },
      },
      reason: { type: "string" },
      improvement: { type: "string" },
      likes: { type: "string" },
      continuity: { type: "string" },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
        feedbackId: { type: "string" },
        emailSent: { type: "boolean" },
      },
    },
  },
} as const;