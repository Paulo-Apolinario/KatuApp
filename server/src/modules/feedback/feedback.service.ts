import nodemailer from "nodemailer";
import { PrismaClient, FeedbackCategory as PrismaFeedbackCategory } from "@prisma/client";

const prisma = new PrismaClient();

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

function getSmtpTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true";

  if (!host || !port || !user || !pass) {
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

  if (user.generator?.cooperative?.id && user.generator?.cooperative?.email) {
    return {
      cooperativeId: user.generator.cooperative.id,
      cooperativeName: user.generator.cooperative.name,
      cooperativeEmail: user.generator.cooperative.email,
    };
  }

  if (user.collector?.cooperative?.id && user.collector?.cooperative?.email) {
    return {
      cooperativeId: user.collector.cooperative.id,
      cooperativeName: user.collector.cooperative.name,
      cooperativeEmail: user.collector.cooperative.email,
    };
  }

  if (user.driver?.cooperative?.id && user.driver?.cooperative?.email) {
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

  if (latestSchedule?.cooperative?.id && latestSchedule?.cooperative?.email) {
    return {
      cooperativeId: latestSchedule.cooperative.id,
      cooperativeName: latestSchedule.cooperative.name,
      cooperativeEmail: latestSchedule.cooperative.email,
      scheduleId: latestSchedule.id,
    };
  }

  throw new Error("Não foi possível localizar a cooperativa vinculada a este usuário.");
}

function buildCategoriesLabel(categories: PrismaFeedbackCategory[]) {
  if (!categories?.length) return "Nenhuma categoria informada";

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
  userName: string;
  userEmail: string;
  npsScore: number;
  categories: PrismaFeedbackCategory[];
  reason?: string;
  improvement?: string;
  likes?: string;
  continuity?: string;
}) {
  const transporter = getSmtpTransport();

  if (!transporter) {
    return false;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const bcc = process.env.FEEDBACK_BCC || undefined;

  const categoriesLabel = buildCategoriesLabel(params.categories);
  const npsLabel = buildNpsLabel(params.npsScore);

  const subject = `Novo feedback recebido no KATU - ${params.cooperativeName}`;

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="margin-bottom: 8px;">Novo feedback recebido</h2>
      <p style="margin-top: 0;">
        A cooperativa <strong>${escapeHtml(params.cooperativeName)}</strong> recebeu um novo feedback no KATU.
      </p>

      <div style="margin: 20px 0; padding: 16px; border: 1px solid #E5E7EB; border-radius: 12px;">
        <p><strong>Usuário:</strong> ${escapeHtml(params.userName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(params.userEmail)}</p>
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
    subject,
    html,
  });

  return true;
}

export async function createFeedback(input: CreateFeedbackInput) {
  const target = await resolveTargetCooperative(input.userId);

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
  });

  if (!user) {
    throw new Error("Usuário autenticado não encontrado.");
  }

  const feedback = await prisma.feedback.create({
    data: {
      userId: input.userId,
      cooperativeId: target.cooperativeId,
      scheduleId: target.scheduleId,
      npsScore: input.npsScore,
      categories: input.categories,
      reason: input.reason?.trim() || null,
      improvement: input.improvement?.trim() || null,
      likes: input.likes?.trim() || null,
      continuity: input.continuity?.trim() || null,
    },
  });

  let emailSent = false;

  try {
    emailSent = await sendFeedbackEmail({
      to: target.cooperativeEmail,
      cooperativeName: target.cooperativeName,
      userName: user.displayName,
      userEmail: user.email,
      npsScore: input.npsScore,
      categories: input.categories,
      reason: input.reason,
      improvement: input.improvement,
      likes: input.likes,
      continuity: input.continuity,
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
  };
}