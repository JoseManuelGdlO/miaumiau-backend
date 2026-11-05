const { Op } = require('sequelize');
const { Logger } = require('../utils/logger');

const log = new Logger('Job');
const ABIERTOS = ['pendiente', 'confirmado', 'en_preparacion', 'en_camino'];

function getDateComponentsInTimezone(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  return {
    year: parseInt(parts.find(p => p.type === 'year').value),
    month: parseInt(parts.find(p => p.type === 'month').value),
    day: parseInt(parts.find(p => p.type === 'day').value),
    hour: parseInt(parts.find(p => p.type === 'hour').value),
    minute: parseInt(parts.find(p => p.type === 'minute').value),
    second: parseInt(parts.find(p => p.type === 'second').value)
  };
}

function compararFechaEntregaSoloDia(fechaEntregaUTC, timezone) {
  const ahoraUTC = new Date();
  const fechaEntregaLocal = getDateComponentsInTimezone(fechaEntregaUTC, timezone);
  const ahoraLocal = getDateComponentsInTimezone(ahoraUTC, timezone);

  const pad = (n) => String(n).padStart(2, '0');
  const fechaEntregaStrDia = `${fechaEntregaLocal.year}${pad(fechaEntregaLocal.month)}${pad(fechaEntregaLocal.day)}`;
  const ahoraStrDia = `${ahoraLocal.year}${pad(ahoraLocal.month)}${pad(ahoraLocal.day)}`;

  if (fechaEntregaStrDia < ahoraStrDia) return 'past';
  if (fechaEntregaStrDia === ahoraStrDia) return 'today';
  return 'future';
}

function realmenteEntregado(paradas) {
  return (paradas || []).some((parada) => parada.estado_entrega === 'entregado' || parada.codigo_validado_en);
}

async function marcarParadasFallidas(paradas) {
  const ahora = new Date();
  for (const parada of paradas || []) {
    if (!parada || parada.estado_entrega === 'entregado' || parada.estado_entrega === 'fallido') continue;
    if (typeof parada.update === 'function') {
      await parada.update({ estado_entrega: 'fallido', fecha_entrega_real: ahora });
    } else {
      parada.estado_entrega = 'fallido';
      parada.fecha_entrega_real = ahora;
    }
  }
}

async function marcarNoEntregado(pedido) {
  if (typeof pedido.noEntregar === 'function') await pedido.noEntregar();
  else if (typeof pedido.update === 'function') await pedido.update({ estado: 'no_entregado', fecha_entrega_real: null });
  else {
    pedido.estado = 'no_entregado';
    pedido.fecha_entrega_real = null;
  }
  await marcarParadasFallidas(pedido.rutas);
}

async function autoEntregarPedidos(deps = {}) {
  try {
    const { Pedido } = deps.models || require('../models');
    const pedidosAProcesar = await Pedido.findAll({
      where: {
        fecha_entrega_estimada: { [Op.not]: null },
        estado: { [Op.in]: [...ABIERTOS, 'entregado'] },
        baja_logica: false
      },
      include: [
        { association: 'ciudad', attributes: ['id', 'nombre', 'timezone'], required: false },
        { association: 'rutas', required: false }
      ]
    });

    if (pedidosAProcesar.length === 0) {
      log.info('Auto-cerrar pedidos: no hay pedidos a procesar.');
      return { actualizados: 0, pedidos: [] };
    }

    const pedidosActualizados = [];

    for (const pedido of pedidosAProcesar) {
      try {
        const ciudad = pedido.ciudad;
        if (!ciudad) continue;

        const timezone = ciudad.timezone || 'America/Mexico_City';
        const resultadoFecha = compararFechaEntregaSoloDia(pedido.fecha_entrega_estimada, timezone);

        if (resultadoFecha === 'past') {
          if (pedido.estado === 'entregado' && realmenteEntregado(pedido.rutas)) continue;
          await marcarNoEntregado(pedido);
          pedidosActualizados.push({
            id: pedido.id,
            numero_pedido: pedido.numero_pedido,
            fecha_entrega_estimada: pedido.fecha_entrega_estimada,
            ciudad: ciudad.nombre,
            timezone,
            nuevo_estado: 'no_entregado'
          });
          log.debug(`Pedido #${pedido.numero_pedido} (ID: ${pedido.id}) de ${ciudad.nombre} marcado como no entregado (el día pasó sin completar).`);
        } else if (resultadoFecha === 'today' && pedido.estado === 'pendiente') {
          await pedido.enviar();
          pedidosActualizados.push({
            id: pedido.id,
            numero_pedido: pedido.numero_pedido,
            fecha_entrega_estimada: pedido.fecha_entrega_estimada,
            ciudad: ciudad.nombre,
            timezone,
            nuevo_estado: 'en_camino'
          });
        }
      } catch (error) {
        log.error(`Error al procesar pedido #${pedido.numero_pedido} (ID: ${pedido.id})`, { message: error.message, stack: error.stack });
      }
    }

    log.info(`Auto-cerrar pedidos: ${pedidosActualizados.length} pedido(s) actualizado(s).`);

    return {
      actualizados: pedidosActualizados.length,
      pedidos: pedidosActualizados
    };
  } catch (error) {
    log.error('Error en job auto-cerrar pedidos', { message: error.message, stack: error.stack });
    throw error;
  }
}

module.exports = autoEntregarPedidos;
module.exports.compararFechaEntregaSoloDia = compararFechaEntregaSoloDia;
module.exports.realmenteEntregado = realmenteEntregado;
