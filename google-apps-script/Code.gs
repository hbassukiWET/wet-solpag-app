/**
 * Google Apps Script — Backend intermedio para Solicitudes de Pago
 * 
 * INSTRUCCIONES DE DESPLIEGUE:
 * 1. Ve a https://script.google.com y crea un nuevo proyecto
 * 2. Pega este código en Code.gs
 * 3. Configura las constantes SHEET_ID y DRIVE_FOLDER_ID abajo
 * 4. Despliega como "Aplicación web":
 *    - Ejecutar como: Tu cuenta
 *    - Acceso: Cualquiera (para permitir llamadas desde el frontend)
 * 5. Copia la URL del despliegue y pégala en tu proyecto Lovable
 *    como la variable APPS_SCRIPT_URL en src/lib/google-api.ts
 */

const SHEET_ID = '1oH0s_0suWNYcO1eBoHF5ypTI68MZdUXVzZcLsGaK8HY';
const DRIVE_FOLDER_ID = '1-9cDaNmwGd7simq8rDdBcTkJNQixoweY';
const SHEET_NAME = 'Hoja 1'; // Ajusta al nombre de tu hoja

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    switch (action) {
      case 'getConsecutivo':
        return jsonResponse(getConsecutivo());
      case 'writeRow':
        return jsonResponse(writeRow(body.data));
      case 'saveRecord':
        return jsonResponse(saveRecord(body));
      case 'getRecords':
        return jsonResponse(getRecords());
      case 'uploadPDF':
        return jsonResponse(uploadPDF(body));
      default:
        return jsonResponse({ error: 'Acción no reconocida' }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function doGet(e) {
  // GET endpoint para leer consecutivo sin POST
  const action = e.parameter.action;
  if (action === 'getConsecutivo') {
    return jsonResponse(getConsecutivo());
  }
  return jsonResponse({ error: 'Usa POST para esta acción' }, 400);
}

/**
 * Lee la columna A y retorna el último consecutivo numérico
 */
function getConsecutivo() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    // Solo hay encabezado o está vacía
    return { consecutivo: 1 };
  }

  // Leer toda la columna A para encontrar el último número SP
  const values = sheet.getRange('A2:A' + lastRow).getValues();
  let maxNum = 0;

  for (let i = values.length - 1; i >= 0; i--) {
    const cell = String(values[i][0]).trim();
    // Esperamos formato como "SP-25_070" o simplemente el número
    const match = cell.match(/SP-\d{2}_(\d{3})/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    } else {
      const num = parseInt(cell, 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }

  return { consecutivo: maxNum + 1 };
}

/**
 * Escribe una fila nueva en el Sheet
 * data: { numSP, empresa, ordenCompra, fechaSolicitud, fechaPago, 
 *         transferenciaNombre, moneda, conceptoPago, subtotal, impuestos,
 *         montoTotal, cuentaBanco, comentarios, email, driveUrl }
 */
function writeRow(data) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const yy = new Date().getFullYear().toString().slice(-2);
  const spCode = 'SP-' + yy + '_' + String(data.numSP).padStart(3, '0');

  const row = [
    spCode,
    data.empresa,
    data.ordenCompra,
    data.fechaSolicitud,
    data.fechaPago,
    data.transferenciaNombre,
    data.moneda,
    data.conceptoPago,
    data.subtotal,
    data.impuestos,
    data.montoTotal,
    data.cuentaBanco,
    data.comentarios || '',
    data.email || '',
    data.driveUrl || '',
    new Date().toISOString()
  ];

  sheet.appendRow(row);
  return { success: true, spCode: spCode, row: sheet.getLastRow() };
}

/**
 * Sube un PDF (base64) a Google Drive y retorna la URL
 * data: { fileName, base64Content }
 */
function uploadPDF(data) {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const decoded = Utilities.base64Decode(data.base64Content);
  const blob = Utilities.newBlob(decoded, 'application/pdf', data.fileName);
  const file = folder.createFile(blob);
  
  // Hacer público (solo lectura) para que se pueda acceder con el link
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    success: true,
    fileId: file.getId(),
    url: file.getUrl(),
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId()
  };
}

function jsonResponse(data, code) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Guarda un registro en el Sheet. Si overwrite=true y el num_sp ya existe,
 * sobreescribe esa fila en lugar de agregar una nueva.
 */
function saveRecord(data) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const numOnly = String(Number(data.num_sp));

  const row = [
    numOnly,
    new Date().toISOString(),        // Marca_Temporal
    data.empresa || '',
    data.orden_compra || '',
    data.fecha_solicitud || '',
    data.fecha_pago || '',
    data.transferencia_nombre || '',
    data.moneda || '',
    data.cuenta_banco || '',
    data.concepto_pago || '',
    data.subtotal || 0,
    data.impuestos || 0,
    data.monto_total || 0,
    data.comentarios || '',
    data.documento || '',
    data.solicitante || '',
    data.url_drive || ''
  ];

  // Si overwrite=true, buscar fila existente con ese SP
  if (data.overwrite) {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const spValues = sheet.getRange('A2:A' + lastRow).getValues();
      for (var i = 0; i < spValues.length; i++) {
        if (String(spValues[i][0]).trim() === numOnly) {
          var targetRow = i + 2;
          sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
          return { success: true, spCode: numOnly, row: targetRow, overwritten: true };
        }
      }
    }
  }

  // Si no se encontró o overwrite=false, agregar fila nueva
  sheet.appendRow(row);
  return { success: true, spCode: spCode, row: sheet.getLastRow(), overwritten: false };
}

/**
 * Lee todos los registros del Sheet y los retorna como array de objetos.
 * Columnas: A=Num_SP, B=Marca_Temporal, C=Empresa, J=Concepto_Pago,
 *           M=Monto_Total, H=Moneda, Q=URL_File_Drive
 */
function getRecords() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return { records: [] };
  }

  var data = sheet.getRange(2, 1, lastRow - 1, 17).getValues();
  var records = [];

  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    records.push({
      num_sp: String(r[0]),
      marca_temporal: String(r[1]),
      empresa: String(r[2]),
      concepto_pago: String(r[9]),
      transferencia_nombre: String(r[6]),
      monto_total: Number(r[12]) || 0,
      moneda: String(r[7]),
      fecha_pago: String(r[5]),
      url_drive: String(r[16])
    });
  }

  return { records: records };
}
