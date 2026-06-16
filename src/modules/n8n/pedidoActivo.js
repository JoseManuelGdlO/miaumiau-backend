const { Pedido, Cliente } = require('../../models');
const { Op } = require('sequelize');

const ESTADOS_PEDIDO_ACTIVO = ['pendiente', 'en_camino'];

const normalizePhone = (value) => {
  if (!value) return null;
  const normalized = String(value).replace(/\D/g, '');
  return normalized || null;
};

const phonesMatch = (phoneA, phoneB) => {
  const a = normalizePhone(phoneA);
  const b = normalizePhone(phoneB);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.endsWith(b) || b.endsWith(a);
};

const findClienteByTelefono = async (telefonoRaw) => {
  const telefonoNormalizado = normalizePhone(telefonoRaw);
  if (!telefonoNormalizado) return null;

  return Cliente.findOne({
    where: {
      telefono: telefonoNormalizado,
      isActive: true,
    },
  });
};

const toPedidoResumen = (pedido) => ({
  id: pedido.id,
  numero_pedido: pedido.numero_pedido,
  estado: pedido.estado,
});

const findPedidoActivoByClienteId = async (clienteId) => {
  return Pedido.findOne({
    where: {
      fkid_cliente: clienteId,
      baja_logica: false,
      estado: { [Op.in]: ESTADOS_PEDIDO_ACTIVO },
    },
    order: [['fecha_pedido', 'DESC']],
  });
};

const findPedidoActivoByTelefonoReferencia = async (telefonoNormalizado) => {
  const pedidos = await Pedido.findAll({
    where: {
      baja_logica: false,
      estado: { [Op.in]: ESTADOS_PEDIDO_ACTIVO },
      telefono_referencia: { [Op.ne]: null },
    },
    order: [['fecha_pedido', 'DESC']],
    limit: 20,
  });

  return pedidos.find((pedido) =>
    phonesMatch(pedido.telefono_referencia, telefonoNormalizado)
  ) || null;
};

const findPedidoActivoById = async (pedidoId) => {
  if (!pedidoId) return null;

  const pedido = await Pedido.findOne({
    where: {
      id: pedidoId,
      baja_logica: false,
      estado: { [Op.in]: ESTADOS_PEDIDO_ACTIVO },
    },
  });

  return pedido;
};

const findPedidoActivoPorTelefono = async (telefonoRaw, pedidoId = null) => {
  const telefonoNormalizado = normalizePhone(telefonoRaw);
  if (!telefonoNormalizado) {
    return { pedido: null, telefonoNormalizado: null };
  }

  if (pedidoId) {
    const pedidoPorId = await findPedidoActivoById(pedidoId);
    if (pedidoPorId) {
      return { pedido: pedidoPorId, telefonoNormalizado };
    }
  }

  const cliente = await findClienteByTelefono(telefonoRaw);
  if (cliente) {
    const pedidoPorCliente = await findPedidoActivoByClienteId(cliente.id);
    if (pedidoPorCliente) {
      return { pedido: pedidoPorCliente, telefonoNormalizado };
    }
  }

  const pedidoPorReferencia = await findPedidoActivoByTelefonoReferencia(telefonoNormalizado);
  return { pedido: pedidoPorReferencia, telefonoNormalizado };
};

module.exports = {
  ESTADOS_PEDIDO_ACTIVO,
  normalizePhone,
  phonesMatch,
  findClienteByTelefono,
  findPedidoActivoPorTelefono,
  toPedidoResumen,
};
