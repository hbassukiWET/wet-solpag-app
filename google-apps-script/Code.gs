/**
 * Google Apps Script — Backend intermedio para Solicitudes de Pago
 */

const SHEET_ID = '1oH0s_0suWNYcO1eBoHF5ypTI68MZdUXVzZcLsGaK8HY';
const DRIVE_FOLDER_ID = '1-9cDaNmwGd7simq8rDdBcTkJNQixoweY';
const SHEET_NAME = 'Hoja 1';
const SLACK_BOT_TOKEN = 'xoxb-8123766403011-10814720273552-1asfSHd9M8mMZelMj5q0LTm6';
const SLACK_CHANNEL = 'C08HF9S0ZKQ';

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
      case 'updatePagado':
        return jsonResponse(updatePagado(body));
      default:
        return jsonResponse({ error: 'Acción no reconocida' }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'getConsecutivo') {
    return jsonResponse(getConsecutivo());
  }
  return jsonResponse({ error: 'Usa POST para esta acción' }, 400);
}

function jsonResponse(data, code) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── CONSECUTIVO ───

function getConsecutivo() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { consecutivo: 1 };

  const values = sheet.getRange('A2:A' + lastRow).getValues();
  let maxNum = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    const cell = String(values[i][0]).trim();
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

// ─── WRITE ROW ───

function writeRow(data) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const yy = new Date().getFullYear().toString().slice(-2);
  const spCode = 'SP-' + yy + '_' + String(data.numSP).padStart(3, '0');

  const row = [
    spCode, data.empresa, data.ordenCompra, data.fechaSolicitud,
    data.fechaPago, data.transferenciaNombre, data.moneda, data.conceptoPago,
    data.subtotal, data.impuestos, data.montoTotal, data.cuentaBanco,
    data.comentarios || '', data.email || '', data.driveUrl || '',
    new Date().toISOString()
  ];
  sheet.appendRow(row);
  return { success: true, spCode: spCode, row: sheet.getLastRow() };
}

// ─── UPLOAD PDF + SLACK ───

function uploadPDF(data) {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const decoded = Utilities.base64Decode(data.base64Content);
  const blob = Utilities.newBlob(decoded, 'application/pdf', data.fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var result = {
    success: true,
    fileId: file.getId(),
    url: file.getUrl(),
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId()
  };

  // Enviar PDF a Slack
  try {
    sendToSlack(file.getId(), data.fileName, data.comentarios || '');
  } catch (slackErr) {
    Logger.log('Error enviando a Slack: ' + slackErr.message);
    result.slackError = slackErr.message;
  }

  return result;
}

/**
 * Sube el PDF a Slack usando la Web API (files.getUploadURLExternal → upload → completeUploadExternal)
 */
function sendToSlack(fileId, fileName, comentarios) {
  var driveFile = DriveApp.getFileById(fileId);
  var blob = driveFile.getBlob();
  var bytes = blob.getBytes();
  var headers = { 'Authorization': 'Bearer ' + SLACK_BOT_TOKEN };

  // 1. Obtener URL de subida
  var step1 = UrlFetchApp.fetch('https://slack.com/api/files.getUploadURLExternal', {
    method: 'post',
    headers: headers,
    payload: { filename: fileName, length: String(bytes.length) },
    muteHttpExceptions: true
  });
  var step1Data = JSON.parse(step1.getContentText());
  if (!step1Data.ok) throw new Error('getUploadURLExternal: ' + (step1Data.error || 'unknown'));

  var uploadUrl = step1Data.upload_url;
  var fileIdSlack = step1Data.file_id;

  // 2. Subir contenido del archivo
  UrlFetchApp.fetch(uploadUrl, {
    method: 'post',
    contentType: 'application/pdf',
    payload: bytes,
    muteHttpExceptions: true
  });

  // 3. Completar subida y publicar en canal
  var message = '*NUEVA SOLICITUD DE PAGO*\n\n' + fileName;
  if (comentarios && comentarios.trim().length > 0) {
    message += '\n\nComentarios: ' + comentarios;
  }

  var step3 = UrlFetchApp.fetch('https://slack.com/api/files.completeUploadExternal', {
    method: 'post',
    headers: headers,
    contentType: 'application/json',
    payload: JSON.stringify({
      files: [{ id: fileIdSlack, title: fileName }],
      channel_id: SLACK_CHANNEL,
      initial_comment: message
    }),
    muteHttpExceptions: true
  });
  var step3Data = JSON.parse(step3.getContentText());
  if (!step3Data.ok) throw new Error('completeUploadExternal: ' + (step3Data.error || 'unknown'));
}

// ─── SAVE RECORD ───

function saveRecord(data) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const numOnly = String(Number(data.num_sp));

  const row = [
    numOnly, new Date().toISOString(), data.empresa || '',
    data.orden_compra || '', data.fecha_solicitud || '', data.fecha_pago || '',
    data.transferencia_nombre || '', data.moneda || '', data.cuenta_banco || '',
    data.concepto_pago || '', data.subtotal || 0, data.impuestos || 0,
    data.monto_total || 0, data.comentarios || '', data.documento || '',
    data.solicitante || '', data.url_drive || ''
  ];

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

  sheet.appendRow(row);
  return { success: true, spCode: numOnly, row: sheet.getLastRow(), overwritten: false };
}

// ─── GET RECORDS ───

function getRecords() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { records: [] };

  var data = sheet.getRange(2, 1, lastRow - 1, 19).getValues();
  var records = [];
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    var pagadoRaw = r[17];
    var pagado = pagadoRaw === true || String(pagadoRaw).toLowerCase() === 'true' || String(pagadoRaw).toLowerCase() === 'si' || String(pagadoRaw).toLowerCase() === 'sí' || String(pagadoRaw) === '1';
    records.push({
      num_sp: String(r[0]),
      marca_temporal: String(r[1]),
      empresa: String(r[2]),
      concepto_pago: String(r[9]),
      transferencia_nombre: String(r[6]),
      monto_total: Number(r[12]) || 0,
      moneda: String(r[7]),
      fecha_pago: String(r[5]),
      url_drive: String(r[16]),
      pagado: pagado,
      fecha_pago_real: r[18] ? String(r[18]) : ''
    });
  }
  return { records: records };
}

// ─── UPDATE PAGADO ───

function updatePagado(data) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: 'Sin registros' };

  var numTarget = String(Number(data.num_sp));
  var spValues = sheet.getRange('A2:A' + lastRow).getValues();
  for (var i = 0; i < spValues.length; i++) {
    if (String(spValues[i][0]).trim() === numTarget) {
      var targetRow = i + 2;
      var pagado = data.pagado === true;
      sheet.getRange(targetRow, 18).setValue(pagado);
      sheet.getRange(targetRow, 19).setValue(pagado ? (data.fecha_pago_real || '') : '');
      return { success: true, row: targetRow };
    }
  }
  return { success: false, error: 'No se encontró el registro' };
}
