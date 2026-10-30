const { resolveWhatsAppAccessToken } = require('./cityWhatsappService');

const UNREADABLE_CITY_TOKEN_MESSAGE = 'No se pudo leer el token de WhatsApp de la ciudad.';

function unreadableCityTokenError() {
  const error = new Error(UNREADABLE_CITY_TOKEN_MESSAGE);
  error.status = 500;
  return error;
}

async function accessTokenForSend(phoneNumberId, deps = {}) {
  const findProfile = deps.findProfile || (async () => {
    const { CityWhatsappProfile } = require('../models');
    return CityWhatsappProfile.findOne({ where: { phone_number_id: phoneNumberId } });
  });

  const profile = await findProfile(phoneNumberId);
  let resolved;
  try {
    resolved = resolveWhatsAppAccessToken({
      phoneNumberId,
      profile,
      globalToken: process.env.WHATSAPP_API_TOKEN
    });
  } catch (error) {
    throw unreadableCityTokenError();
  }

  if (resolved.source === 'city-unreadable') {
    throw unreadableCityTokenError();
  }
  return resolved.token;
}

module.exports = { accessTokenForSend };
