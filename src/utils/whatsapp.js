const https = require('https');
const fs = require('fs');
const path = require('path');
const {
  CONVERSACIONES_DIR,
  extFromMime,
  uniqueFilename,
  MAX_SIZE,
  CONVERSACIONES_MIMES,
  ensureUploadsDirs,
} = require('./uploadImages');

const { WHATSAPP_API_URL, WHATSAPP_API_TOKEN } = process.env;

const buildRequestOptions = (apiUrl, phoneNumberId) => {
  const url = new URL(`${apiUrl.replace(/\/$/, '')}/${phoneNumberId}/messages`);
  return {
    hostname: url.hostname,
    path: url.pathname,
    port: url.port || 443,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };
};

const buildPublicImageUrl = (filename, subdir = 'conversaciones') => {
  const baseUrl = (process.env.IMAGE_BASE_URL || process.env.BASE_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const relativePath = `/uploads/${subdir}/${filename}`;
  return baseUrl ? `${baseUrl}${relativePath}` : relativePath;
};

const parseWhatsAppSendResponse = (phone, res, data) => {
  const success = res.statusCode >= 200 && res.statusCode < 300;
  let messageId = null;
  let parsedData = null;

  if (success && data) {
    try {
      parsedData = JSON.parse(data);
      if (parsedData?.messages?.length > 0) {
        messageId = parsedData.messages[0].id;
      }
    } catch (error) {
      console.warn('[WhatsApp API] No se pudo parsear la respuesta:', error.message);
    }
  }

  const hasErrors = parsedData?.errors && Array.isArray(parsedData.errors) && parsedData.errors.length > 0;
  const actualSuccess = success && !hasErrors;

  if (actualSuccess) {
    const input = parsedData?.contacts?.[0]?.input;
    const wa_id = parsedData?.contacts?.[0]?.wa_id;
    if (input && wa_id && input !== wa_id) {
      console.warn('[WhatsApp API] ADVERTENCIA: wa_id no coincide con input:', { phone, input, wa_id });
    }
  } else if (!success || hasErrors) {
    console.error('[WhatsApp API] Error al enviar:', {
      phone,
      statusCode: res.statusCode,
      response: data,
      errors: parsedData?.errors,
    });
  }

  return {
    success: actualSuccess,
    status: res.statusCode,
    data,
    messageId,
    parsedData,
    errors: hasErrors ? parsedData.errors : null,
  };
};

const httpsJsonRequest = ({ method, urlString, body = null, headers = {} }) => new Promise((resolve, reject) => {
  const url = new URL(urlString);
  const options = {
    hostname: url.hostname,
    path: `${url.pathname}${url.search}`,
    port: url.port || 443,
    method,
    headers: {
      Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
      ...headers,
    },
  };

  const req = https.request(options, (res) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve({ statusCode: res.statusCode, buffer, text: buffer.toString('utf8') });
    });
  });

  req.on('error', reject);
  if (body) req.write(body);
  req.end();
});

const httpsBinaryGet = (urlString) => new Promise((resolve, reject) => {
  const url = new URL(urlString);
  const options = {
    hostname: url.hostname,
    path: `${url.pathname}${url.search}`,
    port: url.port || 443,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
    },
  };

  const req = https.request(options, (res) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => {
      resolve({ statusCode: res.statusCode, buffer: Buffer.concat(chunks) });
    });
  });

  req.on('error', reject);
  req.end();
});

const ensureWhatsAppCredentials = () => {
  if (!WHATSAPP_API_URL || !WHATSAPP_API_TOKEN) {
    return {
      ok: false,
      error: 'Faltan variables de entorno de WhatsApp',
      status: 500,
    };
  }
  return { ok: true };
};

const sendWhatsAppPayload = (phone, phoneNumberId, payload, logLabel) => {
  const creds = ensureWhatsAppCredentials();
  if (!creds.ok) {
    console.error('[WhatsApp API] Error: Faltan variables de entorno');
    return Promise.resolve({ success: false, status: creds.status, error: creds.error });
  }

  return new Promise((resolve) => {
    if (!phoneNumberId) {
      resolve({ success: false, status: 400, error: 'Falta el phone_number_id de WhatsApp' });
      return;
    }

    const body = JSON.stringify(payload);
    console.log(`[WhatsApp API] ${logLabel}:`, { phone, phoneNumberId });

    const options = buildRequestOptions(WHATSAPP_API_URL, phoneNumberId);
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve(parseWhatsAppSendResponse(phone, res, data));
      });
    });

    req.on('error', (error) => {
      console.error('[WhatsApp API] Error de red:', { phone, error: error.message });
      resolve({ success: false, status: 500, error: error.message });
    });

    req.write(body);
    req.end();
  });
};

const sendWhatsAppMessage = (phone, message, phoneNumberId) => sendWhatsAppPayload(
  phone,
  phoneNumberId,
  {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: { body: message },
  },
  'Enviando mensaje de texto'
);

const isValidPublicHttpsUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
};

const uploadWhatsAppMedia = (phoneNumberId, filePath, mimeType) => {
  const creds = ensureWhatsAppCredentials();
  if (!creds.ok) {
    return Promise.resolve({ success: false, status: creds.status, error: creds.error });
  }

  if (!phoneNumberId) {
    return Promise.resolve({ success: false, status: 400, error: 'Falta el phone_number_id de WhatsApp' });
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return Promise.resolve({ success: false, status: 400, error: 'Archivo de imagen no encontrado' });
  }

  return new Promise((resolve) => {
    const fileBuffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    const boundary = `----WhatsAppForm${uniqueFilename()}`;

    const preamble = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="messaging_product"',
      '',
      'whatsapp',
      `--${boundary}`,
      'Content-Disposition: form-data; name="type"',
      '',
      mimeType,
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"`,
      `Content-Type: ${mimeType}`,
      '',
    ].join('\r\n');

    const body = Buffer.concat([
      Buffer.from(`${preamble}\r\n`, 'utf8'),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
    ]);

    const url = new URL(`${WHATSAPP_API_URL.replace(/\/$/, '')}/${phoneNumberId}/media`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      port: url.port || 443,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const success = res.statusCode >= 200 && res.statusCode < 300;
        let parsedData = null;
        let mediaId = null;

        if (data) {
          try {
            parsedData = JSON.parse(data);
            mediaId = parsedData?.id || null;
          } catch (error) {
            console.warn('[WhatsApp API] No se pudo parsear respuesta de upload media:', error.message);
          }
        }

        const hasErrors = parsedData?.error || (parsedData?.errors?.length > 0);
        const actualSuccess = success && mediaId && !hasErrors;

        if (!actualSuccess) {
          console.error('[WhatsApp API] Error al subir media:', {
            statusCode: res.statusCode,
            response: data,
          });
        }

        resolve({
          success: actualSuccess,
          status: res.statusCode,
          mediaId,
          data,
          error: hasErrors
            ? (parsedData?.error?.message || JSON.stringify(parsedData?.error || parsedData?.errors))
            : (!mediaId ? 'WhatsApp no devolvió media id' : null),
        });
      });
    });

    req.on('error', (error) => {
      console.error('[WhatsApp API] Error de red al subir media:', error.message);
      resolve({ success: false, status: 500, error: error.message });
    });

    req.write(body);
    req.end();
  });
};

const sendWhatsAppImage = (phone, phoneNumberId, { link, id, caption }) => {
  const imagePayload = {};
  if (id) {
    imagePayload.id = id;
  } else if (isValidPublicHttpsUrl(link)) {
    imagePayload.link = link;
  } else {
    return Promise.resolve({
      success: false,
      status: 400,
      error: 'Se requiere un media id o un link HTTPS público válido',
    });
  }

  if (caption && String(caption).trim()) {
    imagePayload.caption = String(caption).trim().slice(0, 1024);
  }

  return sendWhatsAppPayload(
    phone,
    phoneNumberId,
    {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'image',
      image: imagePayload,
    },
    'Enviando imagen'
  );
};

const fetchMediaInfo = async (mediaId) => {
  const creds = ensureWhatsAppCredentials();
  if (!creds.ok) {
    return { success: false, status: creds.status, error: creds.error };
  }

  if (!mediaId || !String(mediaId).trim()) {
    return { success: false, status: 400, error: 'media_id es requerido' };
  }

  try {
    const url = `${WHATSAPP_API_URL.replace(/\/$/, '')}/${String(mediaId).trim()}`;
    const { statusCode, text } = await httpsJsonRequest({ method: 'GET', urlString: url });

    if (statusCode === 404) {
      return { success: false, status: 404, error: 'Media no encontrada en WhatsApp' };
    }

    if (statusCode < 200 || statusCode >= 300) {
      return { success: false, status: 502, error: `Error al obtener media (${statusCode})`, data: text };
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { success: false, status: 502, error: 'Respuesta inválida de WhatsApp al obtener media' };
    }

    if (!parsed?.url) {
      return { success: false, status: 502, error: 'WhatsApp no devolvió URL de descarga' };
    }

    return {
      success: true,
      status: 200,
      url: parsed.url,
      mime_type: parsed.mime_type || null,
      sha256: parsed.sha256 || null,
      file_size: parsed.file_size || null,
    };
  } catch (error) {
    return { success: false, status: 502, error: error.message };
  }
};

const downloadMediaBinary = async (mediaUrl) => {
  try {
    const { statusCode, buffer } = await httpsBinaryGet(mediaUrl);
    if (statusCode < 200 || statusCode >= 300) {
      return { success: false, status: 502, error: `Error al descargar media (${statusCode})` };
    }
    return { success: true, buffer };
  } catch (error) {
    return { success: false, status: 502, error: error.message };
  }
};

const downloadAndSaveConversationImage = async (mediaId, mimeTypeHint = null) => {
  const mediaInfo = await fetchMediaInfo(mediaId);
  if (!mediaInfo.success) {
    return mediaInfo;
  }

  const mimeType = mimeTypeHint || mediaInfo.mime_type;
  if (!mimeType || !CONVERSACIONES_MIMES.includes(mimeType)) {
    return {
      success: false,
      status: 400,
      error: 'Tipo de imagen no soportado. Solo JPG, PNG y WEBP.',
    };
  }

  const download = await downloadMediaBinary(mediaInfo.url);
  if (!download.success) {
    return download;
  }

  if (download.buffer.length > MAX_SIZE) {
    return { success: false, status: 413, error: 'La imagen supera el límite de 5 MB' };
  }

  ensureUploadsDirs();
  const filename = `${uniqueFilename()}${extFromMime(mimeType)}`;
  const filePath = path.join(CONVERSACIONES_DIR, filename);
  fs.writeFileSync(filePath, download.buffer);

  return {
    success: true,
    status: 200,
    image_url: buildPublicImageUrl(filename),
    filename,
    mime_type: mimeType,
    size_bytes: download.buffer.length,
    sha256: mediaInfo.sha256,
  };
};

module.exports = {
  sendWhatsAppMessage,
  sendWhatsAppImage,
  uploadWhatsAppMedia,
  downloadAndSaveConversationImage,
  buildPublicImageUrl,
  isValidPublicHttpsUrl,
};
