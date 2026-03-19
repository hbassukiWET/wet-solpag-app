/**
 * Frontend service to call the Google Apps Script backend.
 */

const APPS_SCRIPT_URL =
  import.meta.env.VITE_APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbynkE1bX2wH9X1pCUzduCtm4kS2IcBYaO4gIlsYilIuFp-kwiWsmbzOJOHVsqRN3NQY/exec';

type AppsScriptErrorPayload = {
  success?: boolean;
  error?: string;
  message?: string;
};

async function callAppsScript<T = unknown>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Apps Script error: ${res.status}`);
  }

  const data = (await res.json()) as T & AppsScriptErrorPayload;

  if (typeof data === 'object' && data !== null) {
    if (data.success === false) {
      throw new Error(data.error || data.message || 'Error en Apps Script');
    }

    if (typeof data.error === 'string' && data.error.trim().length > 0) {
      throw new Error(data.error);
    }
  }

  return data as T;
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
  const base64Content = uint8ArrayToBase64(pdfBytes);
  return callAppsScript<{ url: string }>({ action: 'uploadPDF', base64Content, fileName: filename });
}

/** Write a new row to the Sheet */
export async function saveRecord(data: {
  num_sp: string;
  empresa: string;
  orden_compra: string;
  fecha_solicitud: string;
  fecha_pago: string;
  transferencia_nombre: string;
  moneda: string;
  cuenta_banco: string;
  concepto_pago: string;
  subtotal: number;
  impuestos: number;
  monto_total: number;
  comentarios?: string;
  documento?: string;
  solicitante?: string;
  url_drive?: string;
  overwrite?: boolean;
}): Promise<{ success: boolean }> {
  console.log('saveRecord → overwrite:', data.overwrite);
  return callAppsScript({ action: 'saveRecord', ...data });
}

/** Fetch all records from the Sheet */
export async function fetchRecords(): Promise<
  Array<{
    num_sp: string;
    marca_temporal: string;
    empresa: string;
    concepto_pago: string;
    transferencia_nombre: string;
    monto_total: number;
    moneda: string;
    fecha_pago: string;
    url_drive: string;
  }>
> {
  const result = await callAppsScript<{ records: any[] }>({ action: 'getRecords' });
  return result.records;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
