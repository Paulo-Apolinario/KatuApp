import { z } from "zod";

export const cooperativeIdParamsSchema = z.object({
  id: z.string().min(1, "ID da cooperativa é obrigatório."),
});