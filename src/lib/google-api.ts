/**
 * Frontend service to call the Google Apps Script backend.
 * 
 * After deploying the Apps Script, paste your web app URL below.
 */

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';

async function callAppsScript<T = unknown>(action: string, data?: Record<string, unknown>): Promise<T> {
  if (!APPS_SCRIPT_URL) {
    throw new Error('VITE_APPS_SCRIPT_URL no está configurada. Despliega el Apps Script y añade la URL.');
  }

  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // Apps Script needs text/plain to avoid CORS preflight
    body: JSON.stringify({ action, data }),
  });

  if (!res.ok) {
    throw new Error(`Apps Script error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/** Read the last consecutivo from Sheet column A */
export async function fetchConsecutivo(): Promise<number> {
  const result = await callAppsScript<{ consecutivo: number }>('getConsecutivo');
  return result.consecutivo;
}

/** Write a new row to the Sheet */
export async function writeSheetRow(data: {
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
  driveUrl?: string;
}): Promise<{ success: boolean; spCode: string; row: number }> {
  return callAppsScript('writeRow', data);
}

/** Upload a PDF (as base64) to Google Drive and return the URL */
export async function uploadPDFToDrive(
  fileName: string,
  pdfBytes: Uint8Array
): Promise<{ success: boolean; fileId: string; url: string; downloadUrl: string }> {
  // Convert Uint8Array to base64
  const base64 = uint8ArrayToBase64(pdfBytes);
  return callAppsScript('uploadPDF', { fileName, base64Content: base64 });
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
