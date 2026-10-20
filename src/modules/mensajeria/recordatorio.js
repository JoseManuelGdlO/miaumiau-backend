const { Op } = require('sequelize');
const { formatPhoneForWhatsApp } = require('../../services/whatsappWindowService');
const { sendWhatsAppTemplate, WHATSAPP_TEMPLATE_LANGUAGE } = require('../../utils/whatsapp');

const PLANTILLA = 'recordatorio_mes';
const LINEA = '986416624552272';

function inicioDeMes(ahora = new Date()) {
  return new Date(ahora.getFullYear(), ahora.getMonth(), 1);
}

async function recordatorioMes(deps = {}) {
  const db = deps.models || require('../../models');
  const soloTest = deps.solo_test === true || deps.soloTest === true;
  const corte = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const where = { isActive: true };
  if (soloTest) where.nombre_completo = { [Op.like]: 'TEST%' };
  const clientes = await db.Cliente.findAll({ where });
  let enviados = 0;
  let omitidos = 0;
  const send = deps.sendWhatsAppTemplate || sendWhatsAppTemplate;
  for (const cliente of clientes) {
    const telefono = formatPhoneForWhatsApp(cliente.telefono);
    if (!telefono) {
      omitidos += 1;
      continue;
    }
    const ultima = await db.Pedido.findOne({
      where: {
        fkid_cliente: cliente.id,
        baja_logica: false,
        estado: { [Op.ne]: 'cancelado' },
      },
      order: [['fecha_pedido', 'DESC']],
    });
    if (!ultima || new Date(ultima.fecha_pedido) >= corte) {
      omitidos += 1;
      continue;
    }
    const ya = await db.CampanaEnvio.findOne({
      where: {
        fkid_cliente: cliente.id,
        plantilla: PLANTILLA,
        enviado_en: { [Op.gte]: inicioDeMes() },
      },
    });
    if (ya) {
      omitidos += 1;
      continue;
    }
    const linea = deps.phoneNumberId || LINEA;
    const result = await send(telefono, linea, PLANTILLA, {
      languageCode: WHATSAPP_TEMPLATE_LANGUAGE,
      components: [{
        type: 'body',
        parameters: [{ type: 'text', text: String(cliente.nombre_completo || 'cliente').slice(0, 60) }],
      }],
    });
    if (!result?.success) {
      omitidos += 1;
      continue;
    }
    await db.CampanaEnvio.create({
      fkid_cliente: cliente.id,
      plantilla: PLANTILLA,
      enviado_en: new Date(),
    });
    enviados += 1;
  }
  return { enviados, omitidos };
}

module.exports = {
  PLANTILLA,
  recordatorioMes,
  inicioDeMes,
};
