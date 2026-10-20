const { Op } = require('sequelize');

function fechaClave(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function paradaAbierta(parada) {
  const pedido = parada?.pedido;
  if (pedido && (pedido.baja_logica || ['cancelado', 'entregado', 'no_entregado'].includes(pedido.estado))) {
    return false;
  }
  return parada?.estado_entrega !== 'entregado' && parada?.estado_entrega !== 'fallido';
}

async function repartoBloqueado(db, repartidorId, fecha) {
  if (repartidorId == null || repartidorId === '') return false;
  if (typeof db?.JornadaRepartidor?.findOne !== 'function') return false;
  if (typeof db?.Ruta?.findAll !== 'function') return false;
  const dia = fechaClave(fecha);
  if (!dia) return false;
  const jornada = await db.JornadaRepartidor.findOne({
    where: { fkid_repartidor: repartidorId, fecha: dia },
  });
  if (!jornada || jornada.comprobante_deposito_path) return false;
  const rutas = await db.Ruta.findAll({
    where: {
      fkid_repartidor: repartidorId,
      fecha_ruta: dia,
      baja_logica: false,
      estado: { [Op.ne]: 'cancelada' },
    },
    include: [{
      model: db.RutaPedido,
      as: 'pedidos',
      required: false,
      include: db.Pedido ? [{ model: db.Pedido, as: 'pedido', required: false }] : [],
    }],
  });
  const paradas = rutas.flatMap((ruta) => ruta.pedidos || []);
  if (!paradas.length) return false;
  return paradas.every((parada) => !paradaAbierta(parada));
}

module.exports = { repartoBloqueado, paradaAbierta, fechaClave };
