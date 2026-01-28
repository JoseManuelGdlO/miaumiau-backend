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
    console.error('[WhatsApp API] Error: Faltan variables de entorno');
    return Promise.resolve({
      success: false,
      status: 500,
      error: 'Faltan variables de entorno de WhatsApp'
    });
  }

  return new Promise((resolve) => {
    if (!phoneNumberId) {
      console.error('[WhatsApp API] Error: Falta phone_number_id', { phone });
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
    
    console.log('[WhatsApp API] Enviando mensaje:', {
      phone,
      phoneNumberId,
      url: `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      messageLength: message.length
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
            console.warn('[WhatsApp API] No se pudo parsear la respuesta:', error.message);
          }
        }

        // Log detallado de la respuesta
        if (success) {
          // Verificar si hay errores en la respuesta aunque el status sea 200
          const hasErrors = parsedData?.errors && Array.isArray(parsedData.errors) && parsedData.errors.length > 0;
          
          if (hasErrors) {
            console.error('[WhatsApp API] Error en respuesta (aunque status 200):', {
              phone,
              statusCode: res.statusCode,
              errors: parsedData.errors,
              fullResponse: parsedData
            });
          } else {
            // Verificar si el wa_id coincide con el input (si no coincide, puede haber problema)
            const input = parsedData?.contacts?.[0]?.input;
            const wa_id = parsedData?.contacts?.[0]?.wa_id;
            const waIdMismatch = input && wa_id && input !== wa_id;
            
            if (waIdMismatch) {
              console.warn('[WhatsApp API] ADVERTENCIA: wa_id no coincide con input:', {
                phone,
                input,
                wa_id,
                message: 'WhatsApp puede haber normalizado el número, verificar formato'
              });
            }
            
            console.log('[WhatsApp API] Mensaje enviado exitosamente:', {
              phone,
              statusCode: res.statusCode,
              messageId,
              wa_id,
              input,
              waIdMismatch,
              contacts: parsedData?.contacts,
              messages: parsedData?.messages,
              fullResponse: JSON.stringify(parsedData, null, 2)
            });
          }
        } else {
          console.error('[WhatsApp API] Error al enviar mensaje:', {
            phone,
            statusCode: res.statusCode,
            response: data,
            parsedData
          });
        }

        // Verificar si hay errores aunque el status sea 200
        const hasErrors = parsedData?.errors && Array.isArray(parsedData.errors) && parsedData.errors.length > 0;
        const actualSuccess = success && !hasErrors;
        
        resolve({
          success: actualSuccess,
          status: res.statusCode,
          data,
          messageId,
          parsedData,
          errors: hasErrors ? parsedData.errors : null
        });
      });
    });

    req.on('error', (error) => {
      console.error('[WhatsApp API] Error de red:', {
        phone,
        error: error.message,
        stack: error.stack
      });
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
