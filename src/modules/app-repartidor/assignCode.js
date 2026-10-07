const { buildDeliveryCode } = require('./domain');

async function ensureDeliveryCode(pedido) {
  if (!pedido || pedido.codigo_entrega) return pedido;
  pedido.codigo_entrega = buildDeliveryCode();
  await pedido.save();
  return pedido;
}

module.exports = { ensureDeliveryCode };
