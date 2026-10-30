const { resolveWhatsAppAccessToken } = require('./cityWhatsappService');

const UNREADABLE_CITY_TOKEN_MESSAGE = 'No se pudo leer el token de WhatsApp de la ciudad.';
const MISSING_WHATSAPP_ENV_MESSAGE = 'Faltan variables de entorno de WhatsApp';

function unreadableCityTokenError() {
  const error = new Error(UNREADABLE_CITY_TOKEN_MESSAGE);
  error.status = 500;
  return error;
}

function missingWhatsAppEnvError() {
  const error = new Error(MISSING_WHATSAPP_ENV_MESSAGE);
  error.status = 500;
  return error;
}

async function accessTokenForSend(phoneNumberId, deps = {}) {
  const findProfile = deps.findProfile || (async () => {
    const { CityWhatsappProfile } = require('../models');
    return CityWhatsappProfile.findOne({ where: { phone_number_id: phoneNumberId } });
  });

  const profile = await findProfile(phoneNumberId);
  const resolved = resolveWhatsAppAccessToken({
    phoneNumberId,
    profile,
    globalToken: process.env.WHATSAPP_API_TOKEN
  });

  if (resolved.source === 'city-unreadable') {
    throw unreadableCityTokenError();
  }
  if (resolved.source === 'global' && !resolved.token) {
    throw missingWhatsAppEnvError();
  }
  return resolved.token;
}

module.exports = { accessTokenForSend };
