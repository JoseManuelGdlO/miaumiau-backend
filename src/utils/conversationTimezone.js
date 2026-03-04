const { Conversacion } = require('../models');

const DEFAULT_TIMEZONE = 'America/Monterrey';

/**
 * Obtiene el timezone para una conversación ya cargada con Cliente/Pedido y City.
 * @param {Object} conversacion - Instancia de Conversacion con includes opcionales (cliente.ciudad, pedido.ciudad)
 * @returns {string} - Zona horaria IANA (ej: 'America/Monterrey') o DEFAULT_TIMEZONE si no hay ciudad
 */
function getTimezoneForConversation(conversacion) {
  if (!conversacion) return DEFAULT_TIMEZONE;

  if (conversacion.cliente?.ciudad?.timezone) {
    return conversacion.cliente.ciudad.timezone;
  }
  if (conversacion.pedido?.ciudad?.timezone) {
    return conversacion.pedido.ciudad.timezone;
  }

  return DEFAULT_TIMEZONE;
}

/**
 * Obtiene el timezone para una conversación por ID (carga Cliente->City y Pedido->City).
 * @param {number} conversacionId - ID de la conversación
 * @returns {Promise<string>} - Zona horaria IANA o 'America/Monterrey' por defecto
 */
async function getTimezoneForConversationId(conversacionId) {
  if (!conversacionId) return DEFAULT_TIMEZONE;

  const conversacion = await Conversacion.findByPk(conversacionId, {
    include: [
      { association: 'cliente', required: false, include: [{ association: 'ciudad', required: false, attributes: ['timezone'] }] },
      { association: 'pedido', required: false, include: [{ association: 'ciudad', required: false, attributes: ['timezone'] }] }
    ],
    attributes: ['id']
  });

  return getTimezoneForConversation(conversacion);
}

module.exports = {
  getTimezoneForConversation,
  getTimezoneForConversationId,
  DEFAULT_TIMEZONE
};
