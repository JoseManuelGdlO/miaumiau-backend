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
 * Obtiene el offset en milisegundos de una zona horaria para una fecha específica
 * @param {Date} date - Fecha de referencia
 * @param {string} timezone - Zona horaria IANA
 * @returns {number} - Offset en milisegundos (UTC - local)
 */
function getTimezoneOffset(date, timezone) {
  // Crear dos formatters: uno para UTC y otro para la zona horaria
  const utcFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Obtener las partes de ambas representaciones
  const utcParts = utcFormatter.formatToParts(date);
  const tzParts = tzFormatter.formatToParts(date);
  
  // Crear fechas a partir de las partes
  const utcDate = new Date(
    parseInt(utcParts.find(p => p.type === 'year').value),
    parseInt(utcParts.find(p => p.type === 'month').value) - 1,
    parseInt(utcParts.find(p => p.type === 'day').value),
    parseInt(utcParts.find(p => p.type === 'hour').value),
    parseInt(utcParts.find(p => p.type === 'minute').value),
    parseInt(utcParts.find(p => p.type === 'second').value)
  );
  
  const tzDate = new Date(
    parseInt(tzParts.find(p => p.type === 'year').value),
    parseInt(tzParts.find(p => p.type === 'month').value) - 1,
    parseInt(tzParts.find(p => p.type === 'day').value),
    parseInt(tzParts.find(p => p.type === 'hour').value),
    parseInt(tzParts.find(p => p.type === 'minute').value),
    parseInt(tzParts.find(p => p.type === 'second').value)
  );
  
  // El offset es la diferencia entre UTC y la zona horaria local
  return utcDate.getTime() - tzDate.getTime();
}

/**
 * Convierte una fecha/hora local de una zona horaria específica a UTC
 * @param {Object} dateComponents - Objeto con año, mes, día, hora, minuto, segundo
 * @param {string} timezone - Zona horaria IANA (ej: 'America/Mexico_City')
 * @returns {Date} - Fecha en UTC
 */
function localToUTC(dateComponents, timezone) {
  // Crear la fecha local
  const localDate = new Date(
    dateComponents.year,
    dateComponents.month - 1, // Mes es 0-indexed
    dateComponents.day,
    dateComponents.hour,
    dateComponents.minute,
    dateComponents.second
  );
  
  // Obtener el offset de la zona horaria para esta fecha
  const offset = getTimezoneOffset(localDate, timezone);
  
  // Ajustar por el offset para obtener UTC
  return new Date(localDate.getTime() + offset);
}

/**
 * Compara si una fecha ya pasó en una zona horaria específica usando UTC
 * @param {Date} fechaEntregaUTC - Fecha de entrega estimada (almacenada en UTC en la BD)
 * @param {string} timezone - Zona horaria IANA de la ciudad
 * @returns {boolean} - true si la fecha ya pasó en esa zona horaria
 */
function fechaYaPaso(fechaEntregaUTC, timezone) {
  const ahoraUTC = new Date();
  
  // Obtener ambas fechas en la zona horaria local de la ciudad
  const fechaEntregaLocal = getDateComponentsInTimezone(fechaEntregaUTC, timezone);
  const ahoraLocal = getDateComponentsInTimezone(ahoraUTC, timezone);
  
  // Convertir ambas fechas locales a UTC para comparar
  const fechaEntregaEnUTC = localToUTC(fechaEntregaLocal, timezone);
  const ahoraEnUTC = localToUTC(ahoraLocal, timezone);
  
  // Comparar en UTC usando timestamps: si fechaEntrega <= ahora, entonces ya pasó
  return fechaEntregaEnUTC.getTime() <= ahoraEnUTC.getTime();
}

/**
 * Job que verifica y marca como entregados los pedidos cuya fecha de entrega ya pasó
 * Se ejecuta cada hora y considera la zona horaria de cada ciudad
 */
async function autoEntregarPedidos() {
  try {
    // Buscar pedidos que:
    // 1. Tienen fecha_entrega_estimada
    // 2. Están en estado "pendiente"
    // 3. No están dados de baja
    const pedidosPendientes = await Pedido.findAll({
      where: {
        fecha_entrega_estimada: {
          [Op.not]: null
        },
        estado: 'pendiente',
        baja_logica: false
      },
      include: [
        {
          model: City,
          as: 'ciudad',
          attributes: ['id', 'nombre', 'timezone'],
          required: true
        }
      ]
    });

    if (pedidosPendientes.length === 0) {
      console.log(`[${new Date().toISOString()}] Auto-entregar pedidos: No hay pedidos pendientes de entregar.`);
      return { actualizados: 0, pedidos: [] };
    }

    const pedidosActualizados = [];
    
    // Verificar cada pedido usando la zona horaria de su ciudad
    for (const pedido of pedidosPendientes) {
      try {
        const ciudad = pedido.ciudad;
        const timezone = ciudad?.timezone || 'America/Mexico_City'; // Default si no tiene timezone
        
        // Verificar si la fecha de entrega ya pasó en la zona horaria de la ciudad
        if (fechaYaPaso(pedido.fecha_entrega_estimada, timezone)) {
          await pedido.entregar();
          pedidosActualizados.push({
            id: pedido.id,
            numero_pedido: pedido.numero_pedido,
            fecha_entrega_estimada: pedido.fecha_entrega_estimada,
            ciudad: ciudad.nombre,
            timezone: timezone
          });
          console.log(`[${new Date().toISOString()}] Pedido #${pedido.numero_pedido} (ID: ${pedido.id}) de ${ciudad.nombre} (${timezone}) marcado como entregado automáticamente.`);
        }
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error al procesar pedido #${pedido.numero_pedido} (ID: ${pedido.id}):`, error.message);
      }
    }

    console.log(`[${new Date().toISOString()}] Auto-entregar pedidos: ${pedidosActualizados.length} pedido(s) marcado(s) como entregado(s).`);
    
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

