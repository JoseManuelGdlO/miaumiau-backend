const { Pedido } = require('../models');
const { reencolarNoEntregados } = require('../modules/pedidos/reencolar');

async function reencolarAyer() {
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  return reencolarNoEntregados({ Pedido, fecha });
}

module.exports = reencolarAyer;
