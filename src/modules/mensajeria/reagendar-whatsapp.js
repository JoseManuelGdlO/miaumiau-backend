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

function elegirLinea(lineas, { conversacionId, telefonoCiudad, defecto } = {}) {
  if (conversacionId) return conversacionId;
  const digitos = String(telefonoCiudad || '').replace(/\D/g, '').slice(-10);
  const coinciden = digitos.length >= 10
    ? (lineas || []).filter((row) => String(row.telefono || '').replace(/\D/g, '').endsWith(digitos) && row.phoneid)
    : [];
  if (coinciden.length) return coinciden[0].phoneid;
  return defecto || LINEA;
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

async function pedidoDeHoy(telefono, estados) {
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
        estado: estados,
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

async function pedidoAbierto(telefono) {
  return pedidoDeHoy(telefono, { [Op.notIn]: ['entregado', 'cancelado', 'no_entregado'] });
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
  if (texto === 'ok_listo') {
    await sendWhatsAppMessage(telefono, 'Perfecto. Te esperamos con el pedido.', linea);
    return;
  }
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
  const nuevaDireccion = texto.match(/^direcci[oó]n\s*:\s*(.+)$/i);
  if (/cambiar direcci[oó]n/i.test(texto) && !nuevaDireccion) {
    await sendWhatsAppMessage(telefono, 'Escribe dirección: y después la calle completa.', linea);
    return;
  }
  if (nuevaDireccion && nuevaDireccion[1].trim().length >= 10) {
    const pedido = await pedidoAbierto(telefono);
    if (!pedido) {
      await sendWhatsAppMessage(telefono, 'No encuentro un pedido abierto para cambiar la dirección.', linea);
      return;
    }
    await pedido.update({ direccion_entrega: nuevaDireccion[1].trim().slice(0, 500) });
    await sendWhatsAppMessage(telefono, 'Listo. La entrega queda en la dirección que escribiste.', linea);
    return;
  }
  const calificacion = texto.match(/^calificar:([1-5])$/);
  if (calificacion) {
    const pedido = await pedidoDeHoy(telefono, 'entregado');
    if (!pedido) return;
    const previas = String(pedido.notas || '');
    const nota = `Calificación del servicio: ${calificacion[1]}`;
    await pedido.update({ notas: (previas.includes(nota) ? previas : `${previas ? `${previas}\n` : ''}${nota}`).slice(0, 1000) });
    await sendWhatsAppMessage(telefono, 'Gracias. Si quieres, escribe un comentario de la entrega.', linea);
    return;
  }
  if (texto.length >= 2 && texto !== 'no_puedo' && !quiereReagendar(texto) && !/cambiar direcci/i.test(texto)) {
    const pedido = await pedidoDeHoy(telefono, 'entregado');
    const previas = String(pedido?.notas || '');
    if (pedido && /Calificación del servicio: [1-5]$/.test(previas) && !previas.includes('Comentario:')) {
      await pedido.update({ notas: `${previas}\nComentario: ${texto.trim().slice(0, 200)}`.slice(0, 1000) });
      await sendWhatsAppMessage(telefono, 'Quedó registrado tu comentario.', linea);
      return;
    }
  }
  if (texto !== 'no_puedo' && !quiereReagendar(texto)) return;
  const pedido = await pedidoAbierto(telefono);
  if (!pedido) return;
  await sendWhatsAppInteractive(telefono, linea, listaDeFechas(proximosDias()));
}

const AVISO_NADIE = 'Intentamos entregar tu pedido pero no fue posible porque no había nadie / no contestaron. Tu entrega ha sido reprogramada.';

async function avisarNoEncontrado({ telefono, linea, send } = {}) {
  if (!telefono || !linea) return false;
  const enviar = send || sendWhatsAppMessage;
  const result = await enviar(telefono, AVISO_NADIE, linea);
  return Boolean(result?.success);
}

function listaCalificacion(numero) {
  const cual = numero ? ` ${numero}` : '';
  return {
    type: 'list',
    body: { text: `Tu pedido${cual} fue entregado. Califica el servicio de 1 a 5 estrellas. Si quieres, después escribe un comentario.` },
    action: {
      button: 'Calificar',
      sections: [{
        title: 'Estrellas',
        rows: [1, 2, 3, 4, 5].map((n) => ({ id: `calificar:${n}`, title: `${'★'.repeat(n)}` })),
      }],
    },
  };
}

async function avisarCalificar({ telefono, linea, numero, send } = {}) {
  if (!telefono || !linea) return false;
  const enviar = send || sendWhatsAppInteractive;
  const result = await enviar(telefono, linea, listaCalificacion(numero));
  return Boolean(result?.success);
}

async function avisarReagendar({ telefono, linea, send } = {}) {
  if (!telefono || !linea) return false;
  const enviar = send || sendWhatsAppInteractive;
  const result = await enviar(telefono, linea, listaDeFechas(proximosDias()));
  return Boolean(result?.success);
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
  avisarReagendar,
  avisarCalificar,
  avisarNoEncontrado,
  elegirLinea,
  textoDe,
  listaDeFechas,
};
