const { Pedido } = require('../models');
const { Op } = require('sequelize');

/**
 * Job que verifica y marca como entregados los pedidos cuya fecha de entrega ya pasó
 * Se ejecuta cada hora
 */
async function autoEntregarPedidos() {
  try {
    const ahora = new Date();
    
    // Buscar pedidos que:
    // 1. Tienen fecha_entrega_estimada
    // 2. La fecha de entrega ya pasó (es menor o igual a ahora)
    // 3. Están en estado "pendiente"
    // 4. No están dados de baja
    const pedidosPendientes = await Pedido.findAll({
      where: {
        fecha_entrega_estimada: {
          [Op.not]: null,
          [Op.lte]: ahora
        },
        estado: 'pendiente',
        baja_logica: false
      }
    });

    if (pedidosPendientes.length === 0) {
      console.log(`[${new Date().toISOString()}] Auto-entregar pedidos: No hay pedidos pendientes de entregar.`);
      return { actualizados: 0, pedidos: [] };
    }

    const pedidosActualizados = [];
    
    // Marcar cada pedido como entregado
    for (const pedido of pedidosPendientes) {
      try {
        await pedido.entregar();
        pedidosActualizados.push({
          id: pedido.id,
          numero_pedido: pedido.numero_pedido,
          fecha_entrega_estimada: pedido.fecha_entrega_estimada
        });
        console.log(`[${new Date().toISOString()}] Pedido #${pedido.numero_pedido} (ID: ${pedido.id}) marcado como entregado automáticamente.`);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error al marcar pedido #${pedido.numero_pedido} (ID: ${pedido.id}) como entregado:`, error.message);
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

