import nodemailer from "nodemailer";
import { FeedbackCategory as PrismaFeedbackCategory } from "@prisma/client";

import { prisma } from "../../lib/prisma";

type CreateFeedbackInput = {
  userId: string;
  npsScore: number;
  categories: PrismaFeedbackCategory[];
  reason?: string;
  improvement?: string;
  likes?: string;
  continuity?: string;
};

type ResolvedCooperative = {
  cooperativeId: string;
  cooperativeName: string;
  cooperativeEmail: string;
  scheduleId?: string;
};

type SenderIdentity = {
  senderName: string;
  senderEmail: string;
  senderType: "COOPERATIVE" | "GENERATOR" | "COLLECTOR" | "DRIVER" | "PF";
};

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function getSmtpTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const secure = process.env.SMTP_SECURE === "true";

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

async function resolveTargetCooperative(userId: string): Promise<ResolvedCooperative> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      cooperative: true,
      generator: {
        include: {
          cooperative: true,
        },
      },
      collector: {
        include: {
          cooperative: true,
        },
      },
      driver: {
        include: {
          cooperative: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("Usuário autenticado não encontrado.");
  }

  if (user.cooperative?.id && user.cooperative?.email) {
    return {
      cooperativeId: user.cooperative.id,
      cooperativeName: user.cooperative.name,
      cooperativeEmail: user.cooperative.email,
    };
  }

  if (user.generator?.cooperative?.id && user.generator.cooperative?.email) {
    return {
      cooperativeId: user.generator.cooperative.id,
      cooperativeName: user.generator.cooperative.name,
      cooperativeEmail: user.generator.cooperative.email,
    };
  }

  if (user.collector?.cooperative?.id && user.collector.cooperative?.email) {
    return {
      cooperativeId: user.collector.cooperative.id,
      cooperativeName: user.collector.cooperative.name,
      cooperativeEmail: user.collector.cooperative.email,
    };
  }

  if (user.driver?.cooperative?.id && user.driver.cooperative?.email) {
    return {
      cooperativeId: user.driver.cooperative.id,
      cooperativeName: user.driver.cooperative.name,
      cooperativeEmail: user.driver.cooperative.email,
    };
  }

  const latestSchedule = await prisma.schedule.findFirst({
    where: {
      requestedByUserId: userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      cooperative: true,
    },
  });

  if (latestSchedule?.cooperative?.id && latestSchedule.cooperative?.email) {
    return {
      cooperativeId: latestSchedule.cooperative.id,
      cooperativeName: latestSchedule.cooperative.name,
      cooperativeEmail: latestSchedule.cooperative.email,
      scheduleId: latestSchedule.id,
    };
  }

  throw new Error("Não foi possível localizar a cooperativa vinculada a este usuário.");
}

async function resolveSenderIdentity(userId: string): Promise<SenderIdentity> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      cooperative: true,
      generator: true,
      collector: true,
      driver: true,
    },
  });

  if (!user) {
    throw new Error("Usuário autenticado não encontrado.");
  }

  if (user.generator) {
    return {
      senderName: user.generator.companyName || user.generator.name || user.displayName,
      senderEmail: user.generator.email || user.email,
      senderType: "GENERATOR",
    };
  }

  if (user.collector) {
    return {
      senderName: user.collector.name || user.displayName,
      senderEmail: user.collector.email || user.email,
      senderType: "COLLECTOR",
    };
  }

  if (user.driver) {
    return {
      senderName: user.driver.name || user.displayName,
      senderEmail: user.driver.email || user.email,
      senderType: "DRIVER",
    };
  }

  if (user.cooperative) {
    return {
      senderName: user.cooperative.name || user.displayName,
      senderEmail: user.cooperative.email || user.email,
      senderType: "COOPERATIVE",
    };
  }

  return {
    senderName: user.displayName,
    senderEmail: user.email,
    senderType: "PF",
  };
}

function buildCategoriesLabel(categories: PrismaFeedbackCategory[]) {
  if (!categories?.length) {
    return "Nenhuma categoria informada";
  }

  return categories
    .map((item) => {
      switch (item) {
        case "ATENDIMENTO":
          return "Atendimento";
        case "PONTUALIDADE":
          return "Pontualidade";
        case "COLETA":
          return "Coleta";
        case "APLICATIVO":
          return "Aplicativo";
        case "COMUNICACAO":
          return "Comunicação";
        default:
          return item;
      }
    })
    .join(", ");
}

function buildNpsLabel(score: number) {
  if (score <= 6) return "Precisamos melhorar";
  if (score <= 8) return "Boa experiência";
  return "Excelente experiência";
}

function buildSenderTypeLabel(senderType: SenderIdentity["senderType"]) {
  switch (senderType) {
    case "GENERATOR":
      return "Gerador";
    case "COOPERATIVE":
      return "Cooperativa";
    case "COLLECTOR":
      return "Catador";
    case "DRIVER":
      return "Motorista";
    case "PF":
    default:
      return "Usuário";
  }
}

function escapeHtml(value?: string | null) {
  if (!value) return "-";

  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendFeedbackEmail(params: {
  to: string;
  cooperativeName: string;
  senderName: string;
  senderEmail: string;
  senderType: SenderIdentity["senderType"];
  npsScore: number;
  categories: PrismaFeedbackCategory[];
  reason?: string | null;
  improvement?: string | null;
  likes?: string | null;
  continuity?: string | null;
}) {
  const transporter = getSmtpTransport();

  if (!transporter) {
    console.warn("[FEEDBACK] SMTP não configurado. Email não será enviado.");
    return false;
  }

  const from =
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "";

  if (!from) {
    console.warn("[FEEDBACK] SMTP_FROM/SMTP_USER ausente. Email não será enviado.");
    return false;
  }

  const bcc = process.env.FEEDBACK_BCC?.trim() || undefined;
  const categoriesLabel = buildCategoriesLabel(params.categories);
  const npsLabel = buildNpsLabel(params.npsScore);
  const senderTypeLabel = buildSenderTypeLabel(params.senderType);

  const subject = `Novo feedback recebido no KATU - ${params.cooperativeName}`;

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="margin-bottom: 8px;">Novo feedback recebido</h2>

      <p style="margin-top: 0;">
        A cooperativa <strong>${escapeHtml(params.cooperativeName)}</strong> recebeu um novo feedback no KATU.
      </p>

      <div style="margin: 20px 0; padding: 16px; border: 1px solid #E5E7EB; border-radius: 12px;">
        <p><strong>Tipo de remetente:</strong> ${escapeHtml(senderTypeLabel)}</p>
        <p><strong>Nome de quem enviou:</strong> ${escapeHtml(params.senderName)}</p>
        <p><strong>Email de quem enviou:</strong> ${escapeHtml(params.senderEmail)}</p>
        <p><strong>Nota NPS:</strong> ${params.npsScore} - ${escapeHtml(npsLabel)}</p>
        <p><strong>Categorias:</strong> ${escapeHtml(categoriesLabel)}</p>
        <p><strong>Motivo principal:</strong><br />${escapeHtml(params.reason)}</p>
        <p><strong>O que podemos melhorar:</strong><br />${escapeHtml(params.improvement)}</p>
        <p><strong>O que mais gostou:</strong><br />${escapeHtml(params.likes)}</p>
        <p><strong>Pretende continuar usando o serviço:</strong><br />${escapeHtml(params.continuity)}</p>
      </div>

      <p style="color: #6B7280; font-size: 12px;">
        Mensagem enviada automaticamente pelo sistema KATU.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from,
    to: params.to,
    bcc,
    replyTo: params.senderEmail,
    subject,
    html,
  });

  return true;
}

export async function createFeedback(input: CreateFeedbackInput) {
  const target = await resolveTargetCooperative(input.userId);
  const sender = await resolveSenderIdentity(input.userId);

  const normalizedReason = normalizeOptionalText(input.reason);
  const normalizedImprovement = normalizeOptionalText(input.improvement);
  const normalizedLikes = normalizeOptionalText(input.likes);
  const normalizedContinuity = normalizeOptionalText(input.continuity);

  const feedback = await prisma.feedback.create({
    data: {
      userId: input.userId,
      cooperativeId: target.cooperativeId,
      scheduleId: target.scheduleId,
      npsScore: input.npsScore,
      categories: input.categories,
      reason: normalizedReason,
      improvement: normalizedImprovement,
      likes: normalizedLikes,
      continuity: normalizedContinuity,
    },
  });

  let emailSent = false;

  try {
    emailSent = await sendFeedbackEmail({
      to: target.cooperativeEmail,
      cooperativeName: target.cooperativeName,
      senderName: sender.senderName,
      senderEmail: sender.senderEmail,
      senderType: sender.senderType,
      npsScore: input.npsScore,
      categories: input.categories,
      reason: normalizedReason,
      improvement: normalizedImprovement,
      likes: normalizedLikes,
      continuity: normalizedContinuity,
    });

    if (emailSent) {
      await prisma.feedback.update({
        where: { id: feedback.id },
        data: {
          emailSent: true,
          emailedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error("[FEEDBACK] Erro ao enviar email:", error);
  }

  return {
    success: true,
    message: emailSent
      ? "Feedback enviado com sucesso e encaminhado para a cooperativa."
      : "Feedback salvo com sucesso, mas o envio de email não foi concluído.",
    feedbackId: feedback.id,
    emailSent,
    destinationEmail: target.cooperativeEmail,
    senderEmail: sender.senderEmail,
  };
}