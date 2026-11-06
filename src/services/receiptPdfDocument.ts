import { materialsTotalLabel, materialQuantity } from "../utils/materials";
import type { UserData, ReceiptData } from "./pdfGenerator";
/** Build vector PDF content directly; no print dialog or HTML screenshot. Loaded only on Web. */
export async function buildReceiptPdfDocument(
  user: UserData,
  receipt?: ReceiptData,
): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf/dist/jspdf.es.min.js"),
    import("jspdf-autotable/es"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const title = receipt
    ? "Comprovante de coleta"
    : "Comprovante consolidado de serviço";
  const reference = receipt?.id || user.code || user.id || "Não informado";
  const emitted = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Fortaleza",
  }).format(new Date());
  doc.setProperties({
    title,
    author: user.cooperativeName || "KATUÁ",
    creator: "KATUÁ",
  });
  let y = 35;
  function table(heading: string[], rows: (string | number)[][]) {
    autoTable(doc, {
      startY: y,
      head: [heading],
      body: rows,
      margin: { left: 15, right: 15, top: 35, bottom: 25 },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 3,
        overflow: "linebreak",
      },
      headStyles: { fillColor: [23, 103, 79] },
      columnStyles:
        heading.length === 2
          ? { 0: { cellWidth: 55 }, 1: { cellWidth: 125 } }
          : {},
      rowPageBreak: "avoid",
    });
    y =
      (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 8;
  }
  table(
    ["Resumo", "Registro"],
    [
      [
        "Quantidades registradas",
        materialsTotalLabel(
          receipt?.materials || user.topMaterials,
          receipt?.kg ?? user.totalKg ?? 0,
        ),
      ],
      [
        receipt ? "Data da coleta" : "Coletas concluídas",
        receipt?.date || String(user.collectionCount ?? "Não informado"),
      ],
      [
        "Período",
        receipt?.date ||
          [user.periodStart || user.since, user.periodEnd]
            .filter(Boolean)
            .join(" a ") ||
          "Histórico consultado",
      ],
      ["Emissão (Fortaleza)", emitted],
      ["Referência", reference],
    ],
  );
  const text = (value?: string) => value?.trim() || "Não informado";
  table(
    ["Identificação", "Dados"],
    [
      ["Catador", text(user.name)],
      ["CPF", text(user.cpf)],
      ["Telefone", text(user.phone)],
      ["E-mail", text(user.email)],
      ["Localidade", text(user.location)],
      ["Cooperativa / OSC", text(user.cooperativeName)],
      [
        "Origem / observações",
        receipt ? text(receipt.local) : "Histórico disponível no sistema",
      ],
    ],
  );
  const materials = receipt?.materials || user.topMaterials || [];
  table(
    [
      receipt ? "Material da coleta" : "Material consolidado",
      "Quantidade registrada",
    ],
    materials.length
      ? materials.map((m) => [m.type, materialQuantity(m)])
      : [["Nenhum material informado", "Não informado"]],
  );
  for (const review of receipt?.quantityReviews || []) {
    table(
      [`Conferência ${review.version}`, "Registro"],
      [
        ["Responsável", review.actorName],
        [
          "Data e hora",
          new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
            timeZone: "America/Fortaleza",
          }).format(new Date(review.createdAt)),
        ],
        ["Observações", review.reason || "Não informadas"],
      ],
    );
    table(
      ["Material", "Informado", "Anterior", "Conferido"],
      review.items.map((m) => [
        m.name,
        m.reportedQuantity == null
          ? "Não informado"
          : materialQuantity({ quantity: m.reportedQuantity, unit: m.unit }),
        materialQuantity({ quantity: m.previousQuantity, unit: m.unit }),
        materialQuantity({ quantity: m.confirmedQuantity, unit: m.unit }),
      ]),
    );
  }
  table(
    ["Sobre este comprovante", "Informação"],
    [
      [
        "Unidades",
        "Quantidades preservadas na unidade de origem. Litros, unidades e m³ não são convertidos em kg.",
      ],
      [
        "Registro interno",
        "Reflete o histórico consultado na emissão. Não constitui certificação independente de pesagem ou destinação. Não substitui MTR, CDF ou documento fiscal.",
      ],
      ["Conferência", "Responsável: ______________________________________"],
    ],
  );
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setTextColor(20, 83, 63);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.text("KATUÁ", 15, 16);
    doc.setFontSize(11);
    doc.text(title, 15, 24);
    doc.setDrawColor(180, 205, 190);
    doc.line(15, 28, 195, 28);
    doc.line(15, 277, 195, 277);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 100, 90);
    doc.setFontSize(8);
    doc.text("Registro operacional interno · KATUÁ", 15, 283);
    doc.text(`Página ${page} de ${pages}`, 195, 283, { align: "right" });
    doc.text(`Emissão: ${emitted} (Fortaleza)`, 15, 288);
  }
  return doc.output("blob");
}
