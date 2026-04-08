import { PDFDocument, rgb, StandardFonts, type Color } from "pdf-lib";
import type { Empresa, PaymentRequest } from "@/types/payment";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const EMPRESA_LOGOS: Record<Empresa, string> = {
  WET: "/logo_wet.png",
  WEST: "/logo_west.png",
  VCC: "/logo_vcc.png",
  ALDM: "/logo_aldim.png",
  ITR: "/logo_itr.png",
};

const EMPRESA_COLORS: Record<Empresa, Color> = {
  WET: rgb(0.8, 0, 0),           // #CC0000
  WEST: rgb(0.106, 0.165, 0.42), // #1B2A6B
  VCC: rgb(0.18, 0.46, 0.71),    // #2E75B6
  ALDM: rgb(0.96, 0.77, 0),      // #F5C400
  ITR: rgb(0.18, 0.49, 0.196),   // #2E7D32
};

const MONEDA_COLORS: Record<string, Color> = {
  EUR: rgb(0.18, 0.46, 0.71),    // #2E75B6
  USD: rgb(0.298, 0.686, 0.314), // #4CAF50
  MXN: rgb(0.106, 0.369, 0.125),// #1B5E20
};

const MONEDA_BG_COLORS: Record<string, Color> = {
  EUR: rgb(0.85, 0.91, 0.97),    // light blue
  USD: rgb(0.85, 0.95, 0.85),    // light green
  MXN: rgb(0.82, 0.93, 0.82),    // light dark-green
};

export function generateFileName(data: PaymentRequest): string {
  const yy = new Date().getFullYear().toString().slice(-2);
  const num = data.numSP.padStart(3, '0');
  const oc = data.ordenCompra;
  const concepto = data.conceptoPago.toUpperCase();
  return `${num}_SP-${yy}_${oc}_${concepto}.pdf`;
}

export async function generatePDF(data: PaymentRequest): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const { height } = page.getSize();

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const darkBlue = rgb(0.1, 0.15, 0.25);
  const gray = rgb(0.4, 0.4, 0.45);
  const lightGray = rgb(0.96, 0.96, 0.96); // #F5F5F5
  const accentColor = EMPRESA_COLORS[data.empresa] || rgb(0.9, 0.65, 0.1);

  let y = height - 60;

  // Embed company logo
  const logoMaxW = 150;
  const logoMaxH = 70;
  try {
    const logoPath = EMPRESA_LOGOS[data.empresa];
    const logoResponse = await fetch(logoPath);
    const logoArrayBuffer = await logoResponse.arrayBuffer();
    const logoImage = await pdfDoc.embedPng(new Uint8Array(logoArrayBuffer));
    const logoScale = Math.min(logoMaxW / logoImage.width, logoMaxH / logoImage.height);
    const logoW = logoImage.width * logoScale;
    const logoH = logoImage.height * logoScale;
    const logoX = (612 - logoW) / 2;
    page.drawImage(logoImage, { x: logoX, y: y - logoH, width: logoW, height: logoH });
    y -= logoH + 44;
  } catch {
    // Fallback: draw placeholder rectangle with empresa code
    const logoW = 120;
    const logoH = 60;
    const logoX = (612 - logoW) / 2;
    page.drawRectangle({ x: logoX, y: y - logoH, width: logoW, height: logoH, color: rgb(0.85, 0.85, 0.85) });
    const codeWidth = helveticaBold.widthOfTextAtSize(data.empresa, 14);
    page.drawText(data.empresa, { x: logoX + (logoW - codeWidth) / 2, y: y - logoH / 2 - 5, size: 14, font: helveticaBold, color: darkBlue });
    y -= logoH + 44;
  }

  // Title
  const title = `Solicitud de Pago #${data.numSP.padStart(3, '0')}`;
  const titleWidth = helveticaBold.widthOfTextAtSize(title, 20);
  page.drawText(title, { x: (612 - titleWidth) / 2, y, size: 20, font: helveticaBold, color: darkBlue });
  y -= 10;

  // Accent line (empresa color)
  page.drawRectangle({ x: 206, y, width: 200, height: 3, color: accentColor });
  y -= 30;

  // Moneda color
  const monedaColor = MONEDA_COLORS[data.moneda] || gray;

  const tableX = 60;
  const tableWidth = 492;
  const col1Width = 200;
  const col2Width = tableWidth - col1Width;
  const minRowHeight = 28;
  const cellPadding = 10;
  const fontSize = 9;
  const lineHeight = 13;

  const blendWithWhite = (c: Color, opacity: number): Color => {
    const r = (c as any).red ?? 0.5;
    const g = (c as any).green ?? 0.5;
    const b = (c as any).blue ?? 0.5;
    return rgb(1 - opacity * (1 - r), 1 - opacity * (1 - g), 1 - opacity * (1 - b));
  };
  const lightAccent = blendWithWhite(accentColor, 0.12);

  // Word-wrap helper: splits text into lines that fit within maxWidth
  const wrapText = (text: string, font: typeof helvetica, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth) {
        if (current) lines.push(current);
        // If a single word exceeds maxWidth, push it anyway (will be clipped but won't overflow other cells)
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  };

  // Helper: draw a table; rows can be [label, value, color?, highlight?, valueBgColor?]
  const drawTable = (rows: [string, string, Color?, boolean?, Color?][]) => {
    const borderColor = rgb(0.75, 0.75, 0.78);

    // Pre-calculate row heights based on wrapped text
    const col1MaxW = col1Width - cellPadding * 2;
    const col2MaxW = col2Width - cellPadding * 2;

    const rowData = rows.map((row) => {
      const isHighlight = row[3] === true;
      const valueBgColor = row[4];
      const labelFont = helveticaBold;
      const valueFont = isHighlight ? helveticaBold : helvetica;
      const labelLines = wrapText(row[0], labelFont, col1MaxW);
      const valueLines = wrapText(row[1], valueFont, col2MaxW);
      const textHeight = Math.max(labelLines.length, valueLines.length) * lineHeight;
      const rh = Math.max(minRowHeight, textHeight + cellPadding * 2);
      return { row, isHighlight, valueBgColor, labelFont, valueFont, labelLines, valueLines, height: rh };
    });

    let cumulativeY = 0;
    rowData.forEach((rd, i) => {
      const rowY = y - cumulativeY;
      const rh = rd.height;
      const isHighlight = rd.isHighlight;
      const cellBottom = rowY - rh + minRowHeight - 6;
      const cellTop = cellBottom + rh;

      // Background
      if (isHighlight) {
        page.drawRectangle({ x: tableX, y: cellBottom, width: tableWidth, height: rh, color: lightAccent });
      } else if (i % 2 === 0) {
        page.drawRectangle({ x: tableX, y: cellBottom, width: tableWidth, height: rh, color: lightGray });
      }

      // Value cell background color (e.g., for moneda)
      if (rd.valueBgColor) {
        page.drawRectangle({ x: tableX + col1Width, y: cellBottom, width: col2Width, height: rh, color: rd.valueBgColor });
      }

      // All 4 borders explicitly for every row
      page.drawRectangle({ x: tableX, y: cellTop, width: tableWidth, height: 0.75, color: borderColor });
      page.drawRectangle({ x: tableX, y: cellBottom, width: tableWidth, height: 0.75, color: borderColor });
      page.drawRectangle({ x: tableX, y: cellBottom, width: 0.75, height: rh, color: borderColor });
      page.drawRectangle({ x: tableX + tableWidth - 0.75, y: cellBottom, width: 0.75, height: rh, color: borderColor });
      page.drawRectangle({ x: tableX + col1Width, y: cellBottom, width: 0.75, height: rh, color: borderColor });

      // Draw label lines
      const valueColor = isHighlight ? darkBlue : (rd.row[2] || gray);
      const textStartY = rowY + 4;
      rd.labelLines.forEach((line, li) => {
        page.drawText(line, { x: tableX + cellPadding, y: textStartY - li * lineHeight, size: fontSize, font: rd.labelFont, color: darkBlue });
      });
      // Draw value lines
      rd.valueLines.forEach((line, li) => {
        page.drawText(line, { x: tableX + col1Width + cellPadding, y: textStartY - li * lineHeight, size: fontSize, font: rd.valueFont, color: valueColor });
      });

      cumulativeY += rh;
    });
    y -= cumulativeY + 30;
  };

  // Table 1
  drawTable([
    ['Empresa', data.empresa],
    ['Orden de Compra', data.ordenCompra],
    ['Fecha de Solicitud', format(data.fechaSolicitud, "dd/MM/yyyy", { locale: es })],
    ['Fecha de Pago Tentativa', format(data.fechaPagoTentativa, "dd/MM/yyyy", { locale: es })],
  ]);

  // Table 2
  drawTable([
    ['Transferencia a Nombre de', data.transferenciaNombre],
    ['Moneda', data.moneda, monedaColor, false, MONEDA_BG_COLORS[data.moneda]],
  ]);

  // Table 3
  drawTable([
    ['Concepto de Pago', data.conceptoPago],
  ]);

  // Table 4
  drawTable([
    ['Subtotal', `$${data.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`],
    ['Impuestos', `$${data.impuestos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`],
    ['Monto Total Solicitado', `$${data.montoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, undefined, true],
  ]);

  // Table 5
  drawTable([
    ['Cuenta de Banco', data.cuentaBanco],
  ]);

  // Comments section
  if (data.comentarios && data.comentarios.trim()) {
    page.drawText('Comentarios adicionales', { x: tableX, y, size: 11, font: helveticaBold, color: darkBlue });
    y -= 5;
    page.drawRectangle({ x: tableX, y, width: 140, height: 2, color: accentColor });
    y -= 15;

    const maxWidth = tableWidth - 20;
    const words = data.comentarios.split(' ');
    let line = '';
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (helvetica.widthOfTextAtSize(testLine, 9) > maxWidth) {
        page.drawText(line, { x: tableX + cellPadding, y, size: 9, font: helvetica, color: gray });
        y -= 14;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x: tableX + cellPadding, y, size: 9, font: helvetica, color: gray });
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
