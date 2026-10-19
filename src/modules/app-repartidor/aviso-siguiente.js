const { Op } = require('sequelize');
const { Logger } = require('../../utils/logger');
const { dayKey } = require('./domain');
const { phoneOf } = require('../call-center/domain');
const { formatPhoneForWhatsApp } = require('../../services/whatsappWindowService');
const { sendWhatsAppTemplate, sendWhatsAppInteractive, WHATSAPP_TEMPLATE_LANGUAGE } = require('../../utils/whatsapp');

const log = new Logger('AvisoSiguiente');
const TEMPLATE = 'pedido_siguiente';
const ZONE = 'America/Mexico_City';

function abierto(parada) {
  const entrega = parada?.estado_entrega;
  const pedido = parada?.pedido;
  if (!pedido || pedido.baja_logica || pedido.estado === 'cancelado') return false;
  if (['entregado', 'no_entregado'].includes(pedido.estado)) return false;
  return entrega !== 'entregado' && entrega !== 'fallido';
}

function punto(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function minutosEntre(origen, destino, apiKey, httpGet) {
  if (!apiKey || !origen || !destino) return null;
  const get = httpGet || require('axios').get;
  const response = await get('https://maps.googleapis.com/maps/api/distancematrix/json', {
    params: {
      origins: `${origen.lat},${origen.lng}`,
      destinations: `${destino.lat},${destino.lng}`,
      key: apiKey,
      mode: 'driving',
    },
  });
  const element = response.data?.rows?.[0]?.elements?.[0];
  if (element?.status !== 'OK') return null;
  const seconds = Number(element.duration?.value);
  if (!Number.isFinite(seconds) || seconds < 1) return null;
  return Math.max(1, Math.round(seconds / 60));
}

function componentes(nombre, minutos) {
  return [{
    type: 'body',
    parameters: [
      { type: 'text', text: String(nombre).slice(0, 60) },
      { type: 'text', text: String(minutos) },
    ],
  }];
}

function menuDeSiguiente(nombre, minutos) {
  const quien = String(nombre || 'cliente').slice(0, 40);
  const texto = minutos
    ? `${quien}, tu pedido llega en ${minutos} min. ¿Puedes recibirlo?`
    : `${quien}, tu pedido va en camino. ¿Puedes recibirlo?`;
  return {
    type: 'button',
    body: { text: texto },
    action: {
      buttons: [
        { type: 'reply', reply: { id: 'ok_listo', title: 'Ok, listo' } },
        { type: 'reply', reply: { id: 'no_puedo', title: 'No puedo' } },
      ],
    },
  };
}

async function avisarSiguiente(deps, origen) {
  if (process.env.NODE_ENV === 'test' && !deps.avisarSiguiente) return { enviado: false };
  const db = deps.getModels(deps);
  if (typeof db.Ruta?.findAll !== 'function') return { enviado: false };
  const rutas = await db.Ruta.findAll({
    where: {
      fkid_repartidor: deps.repartidorId,
      fecha_ruta: deps.fecha,
      baja_logica: false,
      estado: { [Op.ne]: 'cancelada' },
    },
    include: [{
      model: db.RutaPedido,
      as: 'pedidos',
      include: [{
        model: db.Pedido,
        as: 'pedido',
        required: false,
        include: [{ model: db.Cliente, as: 'cliente', attributes: ['id', 'nombre_completo', 'telefono'], required: false }],
      }],
    }],
  });
  const paradas = rutas.flatMap((ruta) => ruta.pedidos || [])
    .filter((parada) => abierto(parada) && parada.liberado_en)
    .sort((a, b) => (Number(a.orden_entrega) || 0) - (Number(b.orden_entrega) || 0));
  const siguiente = (deps.paradaId
    ? paradas.find((parada) => Number(parada.id) === Number(deps.paradaId))
    : null) || paradas.find((parada) => !parada.aviso_siguiente_en);
  if (!siguiente || siguiente.aviso_siguiente_en) return { enviado: false };
  const destino = punto(siguiente);
  const desde = punto(origen);
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const minutos = await minutosEntre(desde, destino, apiKey, deps.httpGet);
  if (minutos != null && typeof siguiente.update === 'function') {
    siguiente.tiempo_estimado_entrega = minutos;
    await siguiente.update({ tiempo_estimado_entrega: minutos });
  }
  const pedido = siguiente.pedido;
  const telefono = formatPhoneForWhatsApp(phoneOf(pedido));
  if (!telefono) {
    log.info('aviso omitido: sin teléfono', { pedidoId: pedido?.id });
    return { enviado: false };
  }
  const nombre = pedido.cliente?.nombre_completo || 'cliente';
  const linea = deps.lineaWhatsApp || (await deps.lineaDelCliente?.(deps, pedido));
  const sendMenu = deps.sendWhatsAppInteractive || sendWhatsAppInteractive;
  const menu = await sendMenu(telefono, linea, menuDeSiguiente(nombre, minutos));
  let enviado = Boolean(menu?.success);
  if (!enviado && minutos != null) {
    const send = deps.sendWhatsAppTemplate || sendWhatsAppTemplate;
    const plantilla = await send(telefono, linea, TEMPLATE, {
      languageCode: WHATSAPP_TEMPLATE_LANGUAGE,
      components: componentes(nombre, minutos),
    });
    enviado = Boolean(plantilla?.success);
  }
  if (!enviado) {
    log.warn('aviso no enviado', { pedidoId: pedido.id });
    return { enviado: false, minutos: minutos || null };
  }
  if (typeof siguiente.update === 'function') {
    await siguiente.update({ aviso_siguiente_en: new Date() });
  }
  return { enviado: true, minutos: minutos || null };
}

function quiereReagendar(texto) {
  const limpio = String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return limpio.includes('no puedo') || limpio.includes('reagendar') || limpio.includes('otro dia');
}

function proximosDias(ahora = new Date()) {
  const dias = [];
  for (let salto = 1; salto <= 3; salto += 1) {
    const cursor = new Date(ahora.getTime() + salto * 24 * 60 * 60 * 1000);
    dias.push(dayKey(cursor, ZONE));
  }
  return dias;
}

module.exports = {
  TEMPLATE,
  abierto,
  minutosEntre,
  avisarSiguiente,
  menuDeSiguiente,
  quiereReagendar,
  proximosDias,
  componentes,
};
