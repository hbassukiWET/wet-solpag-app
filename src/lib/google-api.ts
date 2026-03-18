/**
 * Frontend service to call the Google Apps Script backend.
 */

const APPS_SCRIPT_URL =
  import.meta.env.VITE_APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbyFEvte_P8ruYO40uZTGJshP2jVkeSz4qMIYjE-ZwUsEpDqZ-TcJcS9dsyDLWrsp-mF/exec';

async function callAppsScript<T = unknown>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Apps Script error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/** Read the last consecutivo from Sheet column A */
export async function fetchConsecutivo(): Promise<number> {
  const result = await callAppsScript<{ consecutivo: number }>({ action: 'getConsecutivo' });
  return result.consecutivo;
}

/** @deprecated Use uploadPDF instead */
export async function uploadPDFToDrive(
  fileName: string,
  pdfBytes: Uint8Array
): Promise<{ success: boolean; url: string }> {
  const result = await uploadPDF(fileName, pdfBytes);
  return { success: true, url: result.url };
}

export async function uploadPDF(
  filename: string,
  pdfBytes: Uint8Array
): Promise<{ url: string }> {
  const pdfBase64 = uint8ArrayToBase64(pdfBytes);
  return callAppsScript<{ url: string }>({ action: 'uploadPDF', pdfBase64, filename });
}

/** Write a new row to the Sheet */
export async function saveRecord(data: {
  numSP: string;
  empresa: string;
  ordenCompra: string;
  fechaSolicitud: string;
  fechaPago: string;
  transferenciaNombre: string;
  moneda: string;
  conceptoPago: string;
  subtotal: number;
  impuestos: number;
  montoTotal: number;
  cuentaBanco: string;
  comentarios?: string;
  email?: string;
  url_drive?: string;
  overwrite?: boolean;
}): Promise<{ success: boolean; spCode: string; row: number }> {
  return callAppsScript({ action: 'saveRecord', ...data });
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
