import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { PaymentRequest } from "@/types/payment";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function generateFileName(data: PaymentRequest): string {
  const yy = new Date().getFullYear().toString().slice(-2);
  const num = data.numSP.padStart(3, '0');
  const oc = data.ordenCompra;
  const concepto = data.conceptoPago.toUpperCase();
  return `SP-${yy}_${num}_${oc}_${concepto}.pdf`;
}

export async function generatePDF(data: PaymentRequest): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter
  const { height } = page.getSize();

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const darkBlue = rgb(0.1, 0.15, 0.25);
  const gray = rgb(0.4, 0.4, 0.45);
  const lightGray = rgb(0.93, 0.93, 0.95);
  const accentColor = rgb(0.9, 0.65, 0.1);

  let y = height - 60;

  // Title
  const title = `Solicitud de Pago #${data.numSP.padStart(3, '0')}`;
  const titleWidth = helveticaBold.widthOfTextAtSize(title, 20);
  page.drawText(title, { x: (612 - titleWidth) / 2, y, size: 20, font: helveticaBold, color: darkBlue });
  y -= 10;

  // Accent line
  page.drawRectangle({ x: 206, y, width: 200, height: 3, color: accentColor });
  y -= 30;

  // Try to load company logo
  try {
    const logoUrl = `/logos/logo_${data.empresa}.png`;
    const logoResponse = await fetch(logoUrl);
    if (logoResponse.ok) {
      const logoBytes = await logoResponse.arrayBuffer();
      const logoImage = await pdfDoc.embedPng(new Uint8Array(logoBytes));
      const logoDims = logoImage.scale(0.5);
      const logoWidth = Math.min(logoDims.width, 150);
      const logoHeight = (logoWidth / logoDims.width) * logoDims.height;
      page.drawImage(logoImage, {
        x: (612 - logoWidth) / 2,
        y: y - logoHeight,
        width: logoWidth,
        height: logoHeight,
      });
      y -= logoHeight + 20;
    }
  } catch {
    // Logo not found, skip
    y -= 10;
  }

  // Table rows
  const rows: [string, string][] = [
    ['Empresa', data.empresa],
    ['Orden de Compra', data.ordenCompra],
    ['Fecha de Solicitud', format(data.fechaSolicitud, "dd/MM/yyyy", { locale: es })],
    ['Fecha de Pago Tentativa', format(data.fechaPagoTentativa, "dd/MM/yyyy", { locale: es })],
    ['Transferencia a Nombre de', data.transferenciaNombre],
    ['Moneda', data.moneda],
    ['Cuenta de Banco', data.cuentaBanco],
    ['Concepto de Pago', data.conceptoPago],
    ['Subtotal', `$${data.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${data.moneda}`],
    ['Impuestos', `$${data.impuestos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${data.moneda}`],
    ['Monto Total Solicitado', `$${data.montoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${data.moneda}`],
  ];

  const tableX = 60;
  const tableWidth = 492;
  const col1Width = 200;
  const rowHeight = 28;

  rows.forEach((row, i) => {
    const rowY = y - (i * rowHeight);

    if (i % 2 === 0) {
      page.drawRectangle({ x: tableX, y: rowY - 6, width: tableWidth, height: rowHeight, color: lightGray });
    }

    page.drawText(row[0], { x: tableX + 10, y: rowY + 4, size: 9, font: helveticaBold, color: darkBlue });
    page.drawText(row[1], { x: tableX + col1Width + 10, y: rowY + 4, size: 9, font: helvetica, color: gray });
  });

  y -= rows.length * rowHeight + 20;

  // Comments section (only if present)
  if (data.comentarios && data.comentarios.trim()) {
    page.drawText('Observaciones', { x: tableX, y, size: 11, font: helveticaBold, color: darkBlue });
    y -= 5;
    page.drawRectangle({ x: tableX, y, width: 100, height: 2, color: accentColor });
    y -= 15;

    // Word wrap comments
    const maxWidth = tableWidth - 20;
    const words = data.comentarios.split(' ');
    let line = '';
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (helvetica.widthOfTextAtSize(testLine, 9) > maxWidth) {
        page.drawText(line, { x: tableX + 10, y, size: 9, font: helvetica, color: gray });
        y -= 14;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x: tableX + 10, y, size: 9, font: helvetica, color: gray });
    }
  }

  return pdfDoc.save();
}

export async function mergePDFs(generatedPdf: Uint8Array, attachmentBytes: Uint8Array): Promise<Uint8Array> {
  const mergedDoc = await PDFDocument.load(generatedPdf);
  const attachmentDoc = await PDFDocument.load(attachmentBytes);
  const copiedPages = await mergedDoc.copyPages(attachmentDoc, attachmentDoc.getPageIndices());
  copiedPages.forEach(page => mergedDoc.addPage(page));
  return mergedDoc.save();
}
