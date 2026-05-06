/**
 * Frontend service to call the Google Apps Script backend.
 */

const APPS_SCRIPT_URL =
  import.meta.env.VITE_APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbzi1GjPIdg5IYNquqoVqFr6fhXCSM163vnQXLBFQCchQYXsvT1yFTP5Rhh9D4s8cVnU/exec';

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

  const text = await res.text();
  console.log('Apps Script raw response for', payload.action, ':', text.slice(0, 300));
  let data: T & AppsScriptErrorPayload;
  try {
    data = JSON.parse(text);
  } catch {
    const isHtml = text.trim().toLowerCase().startsWith('<!doctype') || text.trim().toLowerCase().startsWith('<html');
    if (isHtml) {
      throw new Error(
        'El Apps Script no respondió JSON (devolvió una página HTML de Google). Esto pasa cuando el deployment está configurado como "Execute as: Me" + "Who has access: Only myself". Editá el deployment y poné "Who has access: Anyone".',
      );
    }
    throw new Error(`Apps Script returned invalid JSON: ${text.slice(0, 200)}`);
  }

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
): Promise<{ url: string; slackError?: string }> {
  const base64Content = uint8ArrayToBase64(pdfBytes);

  const parseUploadUrl = (result: Record<string, unknown>): string | undefined => {
    if (typeof result.url === 'string' && result.url.trim().length > 0) return result.url;
    if (typeof result.downloadUrl === 'string' && result.downloadUrl.trim().length > 0) return result.downloadUrl;
    if (typeof result.driveUrl === 'string' && result.driveUrl.trim().length > 0) return result.driveUrl;
    return undefined;
  };

  try {
    const topLevel = await callAppsScript<Record<string, unknown>>({
      action: 'uploadPDF',
      base64Content,
      fileName: filename,
    });

    if (topLevel.slackError) {
      console.warn('Slack error from Apps Script:', topLevel.slackError);
    }

    const url = parseUploadUrl(topLevel);
    if (url) {
      return { url, slackError: topLevel.slackError as string | undefined };
    }
  } catch {
    // Fallback below
  }

  const nested = await callAppsScript<Record<string, unknown>>({
    action: 'uploadPDF',
    data: { base64Content, fileName: filename },
  });

  const fallbackUrl = parseUploadUrl(nested);
  if (fallbackUrl) return { url: fallbackUrl };

  throw new Error('No se recibió URL del PDF desde Apps Script');
}

function extractNumericSP(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const matches = trimmed.match(/\d+/g);
  return matches && matches.length > 0 ? matches[matches.length - 1] : trimmed;
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
  const numericSP = extractNumericSP(data.num_sp);

  return callAppsScript({
    action: 'saveRecord',
    ...data,
    num_sp: numericSP,
    numSP: numericSP,
    ordenCompra: data.orden_compra,
    fechaSolicitud: data.fecha_solicitud,
    fechaPago: data.fecha_pago,
    transferenciaNombre: data.transferencia_nombre,
    cuentaBanco: data.cuenta_banco,
    conceptoPago: data.concepto_pago,
    montoTotal: data.monto_total,
    driveUrl: data.url_drive || '',
  });
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
    orden_compra?: string;
    cuenta_banco?: string;
    subtotal?: number;
    impuestos?: number;
    comentarios?: string;
    solicitante?: string;
    pagado?: boolean;
    fecha_pago_real?: string;
  }>
> {
  const result = await callAppsScript<{ records?: any[]; data?: any[] }>({ action: 'getRecords' });
  // Handle various response shapes
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.records)) return result.records;
  if (Array.isArray(result.data)) return result.data;
  console.warn('fetchRecords: unexpected response shape', result);
  return [];
}

/** Update Pagado status and fecha de pago real for a given num_sp */
export async function updatePagado(
  num_sp: string,
  pagado: boolean,
  fecha_pago_real: string,
): Promise<{ success: boolean }> {
  return callAppsScript({
    action: 'updatePagado',
    num_sp,
    pagado,
    fecha_pago_real,
  });
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
