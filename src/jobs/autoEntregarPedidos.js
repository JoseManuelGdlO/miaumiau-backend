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
 * Compara si una fecha ya pasó en una zona horaria específica
 * @param {Date} fechaEntregaUTC - Fecha de entrega estimada (almacenada en UTC en la BD)
 * @param {string} timezone - Zona horaria IANA de la ciudad
 * @returns {boolean} - true si la fecha ya pasó en esa zona horaria
 */
function fechaYaPaso(fechaEntregaUTC, timezone) {
  const ahoraUTC = new Date();
  
  // Obtener ambas fechas en la zona horaria local de la ciudad
  const fechaEntregaLocal = getDateComponentsInTimezone(fechaEntregaUTC, timezone);
  const ahoraLocal = getDateComponentsInTimezone(ahoraUTC, timezone);
  
  // Comparar directamente los componentes de fecha/hora en la zona horaria local
  // Crear strings comparables: YYYYMMDDHHmmss
  const fechaEntregaStr = `${fechaEntregaLocal.year}${String(fechaEntregaLocal.month).padStart(2, '0')}${String(fechaEntregaLocal.day).padStart(2, '0')}${String(fechaEntregaLocal.hour).padStart(2, '0')}${String(fechaEntregaLocal.minute).padStart(2, '0')}${String(fechaEntregaLocal.second).padStart(2, '0')}`;
  const ahoraStr = `${ahoraLocal.year}${String(ahoraLocal.month).padStart(2, '0')}${String(ahoraLocal.day).padStart(2, '0')}${String(ahoraLocal.hour).padStart(2, '0')}${String(ahoraLocal.minute).padStart(2, '0')}${String(ahoraLocal.second).padStart(2, '0')}`;
  
  // Log para debug
  console.log(`[DEBUG] Comparando fechas en timezone ${timezone}:`);
  console.log(`  Fecha entrega (UTC): ${fechaEntregaUTC.toISOString()}`);
  console.log(`  Fecha entrega (local): ${fechaEntregaLocal.year}-${String(fechaEntregaLocal.month).padStart(2, '0')}-${String(fechaEntregaLocal.day).padStart(2, '0')} ${String(fechaEntregaLocal.hour).padStart(2, '0')}:${String(fechaEntregaLocal.minute).padStart(2, '0')}:${String(fechaEntregaLocal.second).padStart(2, '0')}`);
  console.log(`  Fecha entrega (str): ${fechaEntregaStr}`);
  console.log(`  Ahora (UTC): ${ahoraUTC.toISOString()}`);
  console.log(`  Ahora (local): ${ahoraLocal.year}-${String(ahoraLocal.month).padStart(2, '0')}-${String(ahoraLocal.day).padStart(2, '0')} ${String(ahoraLocal.hour).padStart(2, '0')}:${String(ahoraLocal.minute).padStart(2, '0')}:${String(ahoraLocal.second).padStart(2, '0')}`);
  console.log(`  Ahora (str): ${ahoraStr}`);
  console.log(`  Resultado: ${fechaEntregaStr <= ahoraStr ? 'YA PASÓ' : 'AÚN NO PASA'}`);
  
  // Comparar: si fechaEntrega <= ahora, entonces ya pasó
  return fechaEntregaStr <= ahoraStr;
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
          required: false // Cambiar a false para incluir pedidos sin ciudad (aunque deberían tenerla)
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
        
        if (!ciudad) {
          console.log(`[${new Date().toISOString()}] Pedido #${pedido.numero_pedido} (ID: ${pedido.id}) no tiene ciudad asociada, saltando...`);
          continue;
        }
        
        const timezone = ciudad?.timezone || 'America/Mexico_City'; // Default si no tiene timezone
        
        console.log(`[${new Date().toISOString()}] Procesando pedido #${pedido.numero_pedido} (ID: ${pedido.id}):`);
        console.log(`  Estado: ${pedido.estado}`);
        console.log(`  Ciudad: ${ciudad.nombre} (${timezone})`);
        console.log(`  Fecha entrega estimada: ${pedido.fecha_entrega_estimada}`);
        
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
          console.log(`[${new Date().toISOString()}] ✅ Pedido #${pedido.numero_pedido} (ID: ${pedido.id}) de ${ciudad.nombre} (${timezone}) marcado como entregado automáticamente.`);
        } else {
          console.log(`[${new Date().toISOString()}] ⏳ Pedido #${pedido.numero_pedido} (ID: ${pedido.id}) aún no ha pasado su fecha de entrega.`);
        }
      } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ Error al procesar pedido #${pedido.numero_pedido} (ID: ${pedido.id}):`, error.message);
        console.error(error.stack);
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

