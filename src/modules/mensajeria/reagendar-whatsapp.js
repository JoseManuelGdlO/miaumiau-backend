const { Op } = require('sequelize');
const db = require('../../models');
const { dayKey } = require('../app-repartidor/domain');
const { quiereReagendar, proximosDias } = require('../app-repartidor/aviso-siguiente');
const { reagendar } = require('../call-center/service');
const { formatPhoneForWhatsApp } = require('../../services/whatsappWindowService');
const { sendWhatsAppInteractive, sendWhatsAppMessage } = require('../../utils/whatsapp');
const { Logger } = require('../../utils/logger');

const log = new Logger('ReagendarWhatsApp');
const ZONE = 'America/Mexico_City';
const LINEA = '986416624552272';

function textoDe(message) {
  return message?.text?.body
    || message?.interactive?.list_reply?.id
    || message?.interactive?.button_reply?.id
    || message?.button?.payload
    || message?.button?.text
    || '';
}

function listaDeFechas(dias) {
  return {
    type: 'list',
    body: { text: 'Elige el día para recibir tu pedido.' },
    action: {
      button: 'Ver fechas',
      sections: [{
        title: 'Próximos días',
        rows: dias.map((fecha) => ({
          id: `reagendar:${fecha}`,
          title: fecha,
        })),
      }],
    },
  };
}

async function pedidoAbierto(telefono) {
  const ultimos = String(telefono || '').replace(/\D/g, '').slice(-10);
  if (ultimos.length < 10) return null;
  const hoy = dayKey(new Date(), ZONE);
  const paradas = await db.RutaPedido.findAll({
    include: [{
      model: db.Pedido,
      as: 'pedido',
      required: true,
      where: {
        baja_logica: false,
        estado: { [Op.notIn]: ['entregado', 'cancelado', 'no_entregado'] },
      },
      include: [{ model: db.Cliente, as: 'cliente', required: false }],
    }, {
      model: db.Ruta,
      as: 'ruta',
      required: true,
      where: { fecha_ruta: hoy, baja_logica: false, estado: { [Op.ne]: 'cancelada' } },
    }],
  });
  return paradas.find((parada) => {
    const pedido = parada.pedido;
    const tel = `${pedido.telefono_referencia || ''} ${pedido.cliente?.telefono || ''}`;
    return tel.replace(/\D/g, '').endsWith(ultimos);
  })?.pedido || null;
}

async function reiniciarConversacion(telefono) {
  const ultimos = String(telefono || '').replace(/\D/g, '').slice(-10);
  const conversacion = await db.Conversacion.findOne({
    where: { from: { [Op.like]: `%${ultimos}` } },
    order: [['updated_at', 'DESC']],
  });
  if (conversacion?.update) {
    await conversacion.update({ status: 'activa', id_pedido: null });
  }
}

async function atenderMensaje(message, phoneNumberId) {
  if (!message || message.type === 'image') return;
  const texto = String(textoDe(message));
  const telefono = formatPhoneForWhatsApp(message.from);
  if (!telefono) return;
  const linea = phoneNumberId || LINEA;
  const fechaElegida = texto.startsWith('reagendar:') ? texto.slice('reagendar:'.length) : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaElegida)) {
    const pedido = await pedidoAbierto(telefono);
    if (!pedido) return;
    await reagendar({
      pedidoId: pedido.id,
      pedido,
      fecha: fechaElegida,
      motivo: 'Cliente por WhatsApp',
      usuario: { nombre_completo: 'Cliente' },
    });
    await reiniciarConversacion(telefono);
    await sendWhatsAppMessage(telefono, `Listo. Tu pedido quedó para el ${fechaElegida}.`, linea);
    return;
  }
  if (!quiereReagendar(texto)) return;
  const pedido = await pedidoAbierto(telefono);
  if (!pedido) return;
  await sendWhatsAppInteractive(telefono, linea, listaDeFechas(proximosDias()));
}

async function atenderEntrada(value) {
  const linea = value?.metadata?.phone_number_id;
  for (const message of value?.messages || []) {
    try {
      await atenderMensaje(message, linea);
    } catch (error) {
      log.warn('no se pudo atender el mensaje', { message: error.message });
    }
  }
}

module.exports = {
  atenderEntrada,
  atenderMensaje,
  textoDe,
  listaDeFechas,
};
