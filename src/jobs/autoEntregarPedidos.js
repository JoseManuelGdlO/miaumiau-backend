const { Pedido, City } = require('../models');
const { Op } = require('sequelize');

/**
 * Obtiene los componentes de fecha/hora en una zona horaria específica
 * @param {Date} date - Fecha en UTC
 * @param {string} timezone - Zona horaria IANA (ej: 'America/Mexico_City')
 * @returns {Object} - Objeto con año, mes, día, hora, minuto, segundo en la zona horaria local
 */
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

/**
 * Compara solo la fecha (día) de entrega con la fecha actual en una zona horaria.
 * @param {Date} fechaEntregaUTC - Fecha de entrega estimada (almacenada en UTC en la BD)
 * @param {string} timezone - Zona horaria IANA de la ciudad
 * @returns {'past'|'today'|'future'} - 'past' si la fecha ya pasó, 'today' si es hoy, 'future' si es futura
 */
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

/**
 * Job que verifica y marca pedidos según la fecha de entrega (solo día, sin hora).
 * - Fecha de entrega ya pasada → estado "entregado"
 * - Fecha de entrega es hoy → estado "en_camino" (si estaba pendiente)
 * - Estado "confirmado" → no se modifica
 * Se ejecuta periódicamente y considera la zona horaria de cada ciudad.
 */
async function autoEntregarPedidos() {
  try {
    // Buscar pedidos que tienen fecha_entrega_estimada, están en pendiente o en_camino, y no están dados de baja
    const pedidosAProcesar = await Pedido.findAll({
      where: {
        fecha_entrega_estimada: { [Op.not]: null },
        estado: { [Op.in]: ['pendiente', 'en_camino'] },
        baja_logica: false
      },
      include: [
        {
          model: City,
          as: 'ciudad',
          attributes: ['id', 'nombre', 'timezone'],
          required: false
        }
      ]
    });

    if (pedidosAProcesar.length === 0) {
      console.log(`[${new Date().toISOString()}] Auto-entregar pedidos: No hay pedidos a procesar.`);
      return { actualizados: 0, pedidos: [] };
    }

    const pedidosActualizados = [];

    for (const pedido of pedidosAProcesar) {
      try {
        const ciudad = pedido.ciudad;

        if (!ciudad) {
          console.log(`[${new Date().toISOString()}] Pedido #${pedido.numero_pedido} (ID: ${pedido.id}) no tiene ciudad asociada, saltando.`);
          continue;
        }

        if (pedido.estado === 'confirmado') {
          console.log(`[${new Date().toISOString()}] Pedido #${pedido.numero_pedido} (ID: ${pedido.id}) en estado confirmado, no se modifica.`);
          continue;
        }

        const timezone = ciudad?.timezone || 'America/Mexico_City';

        console.log(`[${new Date().toISOString()}] Procesando pedido #${pedido.numero_pedido} (ID: ${pedido.id}): estado=${pedido.estado}, ciudad=${ciudad.nombre} (${timezone}), fecha_entrega_estimada=${pedido.fecha_entrega_estimada}`);

        const resultadoFecha = compararFechaEntregaSoloDia(pedido.fecha_entrega_estimada, timezone);

        if (resultadoFecha === 'past') {
          await pedido.entregar();
          pedidosActualizados.push({
            id: pedido.id,
            numero_pedido: pedido.numero_pedido,
            fecha_entrega_estimada: pedido.fecha_entrega_estimada,
            ciudad: ciudad.nombre,
            timezone,
            nuevo_estado: 'entregado'
          });
          console.log(`[${new Date().toISOString()}] Pedido #${pedido.numero_pedido} (ID: ${pedido.id}) de ${ciudad.nombre} (${timezone}) marcado como entregado (fecha de entrega ya pasó).`);
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
          console.log(`[${new Date().toISOString()}] Pedido #${pedido.numero_pedido} (ID: ${pedido.id}) de ${ciudad.nombre} (${timezone}) marcado como en_camino (fecha de entrega es hoy).`);
        } else if (resultadoFecha === 'today' && pedido.estado === 'en_camino') {
          console.log(`[${new Date().toISOString()}] Pedido #${pedido.numero_pedido} (ID: ${pedido.id}) ya está en_camino y la fecha es hoy, sin cambios.`);
        } else {
          console.log(`[${new Date().toISOString()}] Pedido #${pedido.numero_pedido} (ID: ${pedido.id}) fecha de entrega futura, sin cambios.`);
        }
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error al procesar pedido #${pedido.numero_pedido} (ID: ${pedido.id}):`, error.message);
        console.error(error.stack);
      }
    }

    console.log(`[${new Date().toISOString()}] Auto-entregar pedidos: ${pedidosActualizados.length} pedido(s) actualizado(s).`);

    return {
      actualizados: pedidosActualizados.length,
      pedidos: pedidosActualizados
    };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en job auto-entregar pedidos:`, error);
    throw error;
  }
}

module.exports = autoEntregarPedidos;

