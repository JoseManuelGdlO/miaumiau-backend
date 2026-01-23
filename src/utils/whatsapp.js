const https = require('https');

const { WHATSAPP_API_URL, WHATSAPP_API_TOKEN } = process.env;

const buildRequestOptions = (apiUrl, phoneNumberId) => {
  const url = new URL(`${apiUrl.replace(/\/$/, '')}/${phoneNumberId}/messages`);
  return {
    hostname: url.hostname,
    path: url.pathname,
    port: url.port || 443,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
};

const sendWhatsAppMessage = (phone, message, phoneNumberId) => {
  if (!WHATSAPP_API_URL || !WHATSAPP_API_TOKEN) {
    return Promise.resolve({
      success: false,
      status: 500,
      error: 'Faltan variables de entorno de WhatsApp'
    });
  }

  return new Promise((resolve) => {
    if (!phoneNumberId) {
      resolve({
        success: false,
        status: 400,
        error: 'Falta el phone_number_id de WhatsApp'
      });
      return;
    }

    const payload = JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: {
        body: message
      }
    });
    const options = buildRequestOptions(WHATSAPP_API_URL, phoneNumberId);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const success = res.statusCode >= 200 && res.statusCode < 300;
        let messageId = null;
        let parsedData = null;

        // Intentar parsear la respuesta JSON
        if (success && data) {
          try {
            parsedData = JSON.parse(data);
            // Extraer message_id de la respuesta de WhatsApp
            // Estructura: { messages: [{ id: "wamid.xxx" }] }
            if (parsedData?.messages && Array.isArray(parsedData.messages) && parsedData.messages.length > 0) {
              messageId = parsedData.messages[0].id;
            }
          } catch (error) {
            // Si no se puede parsear, continuar sin message_id
            console.warn('No se pudo parsear la respuesta de WhatsApp:', error.message);
          }
        }

        resolve({
          success,
          status: res.statusCode,
          data,
          messageId,
          parsedData
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        status: 500,
        error: error.message
      });
    });

    req.write(payload);
    req.end();
  });
};

module.exports = {
  sendWhatsAppMessage
};
