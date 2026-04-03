import { z } from "zod";

export const createDriverSchema = z.object({
  name: z.string().min(2, "Nome inválido"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  cnh: z.string().optional(),
  cnhCategory: z.string().max(5).optional(),
  notes: z.string().optional(),
  status: z.enum(["AVAILABLE", "ON_ROUTE", "INACTIVE"]).optional(),
});

export const driverIdParamsSchema = z.object({
  id: z.string().min(1, "ID inválido"),
});

export const updateDriverStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "ON_ROUTE", "INACTIVE"]),
});

export const updateMyDriverProfileSchema = z.object({
  displayName: z.string().min(2, "Nome inválido"),
  phone: z.string().optional(),
  cnh: z.string().optional(),
  cnhCategory: z.string().max(5).optional(),
  notes: z.string().optional(),
});

export const createDriverReportSchema = z.object({
  type: z.enum([
    "DELAY",
    "MECHANICAL_ISSUE",
    "COLLECTION_NOT_COMPLETED",
    "GENERAL_NOTE",
  ]),
  description: z.string().min(3, "Descrição inválida"),
  routeId: z.string().optional(),
  vehicleId: z.string().optional(),
  collectionId: z.string().optional(),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type DriverIdParams = z.infer<typeof driverIdParamsSchema>;
export type UpdateDriverStatusInput = z.infer<typeof updateDriverStatusSchema>;
export type UpdateMyDriverProfileInput = z.infer<
  typeof updateMyDriverProfileSchema
>;
export type CreateDriverReportInput = z.infer<typeof createDriverReportSchema>;