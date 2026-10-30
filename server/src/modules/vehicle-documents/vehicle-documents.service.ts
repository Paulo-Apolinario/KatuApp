import { prisma } from "../../lib/prisma";
import type {
  CreateVehicleDocumentInput,
  UpdateVehicleDocumentInput,
} from "./vehicle-documents.schemas";

function toDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

async function getCooperativeId(userId: string) {
  const cooperative = await prisma.cooperative.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!cooperative) {
    throw new Error("Cooperativa não encontrada para o usuário autenticado.");
  }

  return cooperative.id;
}

export const vehicleDocumentsService = {
  async list(userId: string) {
    const cooperativeId = await getCooperativeId(userId);

    const documents = await prisma.vehicleDocument.findMany({
      where: { cooperativeId },
      include: {
        vehicle: true,
        cooperative: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return documents.map((document) => ({
      id: document.id,
      cooperative_id: document.cooperativeId,
      vehicle_id: document.vehicleId,
      vehicle: document.vehicle,
      cooperative: document.cooperative,
      document_type: document.documentType,
      document_number: document.documentNumber,
      issue_date: document.issueDate,
      expiry_date: document.expiryDate,
      file: document.fileUrl,
      file_url: document.fileUrl,
      notes: document.notes,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    }));
  },

  async findById(userId: string, id: string) {
    const cooperativeId = await getCooperativeId(userId);

    const document = await prisma.vehicleDocument.findFirst({
      where: {
        id,
        cooperativeId,
      },
      include: {
        vehicle: true,
        cooperative: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!document) {
      throw new Error("Documento não encontrado.");
    }

    return {
      id: document.id,
      cooperative_id: document.cooperativeId,
      vehicle_id: document.vehicleId,
      vehicle: document.vehicle,
      cooperative: document.cooperative,
      document_type: document.documentType,
      document_number: document.documentNumber,
      issue_date: document.issueDate,
      expiry_date: document.expiryDate,
      file: document.fileUrl,
      file_url: document.fileUrl,
      notes: document.notes,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  },

  async create(userId: string, data: CreateVehicleDocumentInput, fileUrl?: string | null) {
    const cooperativeId = await getCooperativeId(userId);

    if (data.vehicle_id) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: data.vehicle_id,
          cooperativeId,
        },
      });

      if (!vehicle) {
        throw new Error("Veículo não encontrado para esta cooperativa.");
      }
    }

    const document = await prisma.vehicleDocument.create({
      data: {
        cooperativeId,
        vehicleId: data.vehicle_id || null,
        documentType: data.document_type,
        documentNumber: data.document_number,
        issueDate: toDate(data.issue_date),
        expiryDate: toDate(data.expiry_date),
        notes: data.notes || null,
        fileUrl: fileUrl || null,
      },
    });

    return document;
  },

  async update(
    userId: string,
    id: string,
    data: UpdateVehicleDocumentInput,
    fileUrl?: string | null
  ) {
    const cooperativeId = await getCooperativeId(userId);

    const current = await prisma.vehicleDocument.findFirst({
      where: {
        id,
        cooperativeId,
      },
    });

    if (!current) {
      throw new Error("Documento não encontrado.");
    }

    if (data.vehicle_id) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: data.vehicle_id,
          cooperativeId,
        },
      });

      if (!vehicle) {
        throw new Error("Veículo não encontrado para esta cooperativa.");
      }
    }

    const updated = await prisma.vehicleDocument.update({
      where: { id },
      data: {
        vehicleId: data.vehicle_id === undefined ? current.vehicleId : data.vehicle_id || null,
        documentType: data.document_type ?? current.documentType,
        documentNumber: data.document_number ?? current.documentNumber,
        issueDate:
          data.issue_date === undefined ? current.issueDate : toDate(data.issue_date),
        expiryDate:
          data.expiry_date === undefined ? current.expiryDate : toDate(data.expiry_date),
        notes: data.notes === undefined ? current.notes : data.notes || null,
        fileUrl: fileUrl || current.fileUrl,
      },
    });

    return updated;
  },

  async remove(userId: string, id: string) {
    const cooperativeId = await getCooperativeId(userId);

    const current = await prisma.vehicleDocument.findFirst({
      where: {
        id,
        cooperativeId,
      },
    });

    if (!current) {
      throw new Error("Documento não encontrado.");
    }

    await prisma.vehicleDocument.delete({
      where: { id },
    });

    return true;
  },
};