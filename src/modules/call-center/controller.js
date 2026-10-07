const service = require('./service');

async function handle(res, run) {
  try {
    const data = await run();
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'No se pudo completar la solicitud',
    });
  }
}

function solicitudes(req, res) {
  return handle(res, () => service.listarSolicitudes({}));
}

function solicitud(req, res) {
  return handle(res, () => service.detalleSolicitud({ notificacionId: req.params.id }));
}

function aprobar(req, res) {
  return handle(res, () => service.aprobar({ notificacionId: req.params.id }));
}

function atender(req, res) {
  return handle(res, async () => {
    const db = require('../../models');
    const notificacion = await db.Notificacion.findByPk(req.params.id);
    let timezone = 'America/Mexico_City';
    const pedidoId = notificacion?.datos?.pedido_id;
    if (pedidoId) {
      const pedido = await db.Pedido.findByPk(pedidoId, { include: [{ association: 'ciudad' }] });
      timezone = pedido?.ciudad?.timezone || timezone;
      return service.atender({ notificacion, pedido, nota: req.body?.nota, timezone });
    }
    return service.atender({ notificacion, nota: req.body?.nota, timezone });
  });
}

function pedidos(req, res) {
  return handle(res, () => service.listarPedidos({
    ciudadId: req.query.ciudadId || null,
    repartidorId: req.query.repartidorId || null,
  }));
}

function estado(req, res) {
  return handle(res, () => service.cambiarEstado({
    pedidoId: req.params.id,
    estado: req.body?.estado,
  }));
}

function repartidores(req, res) {
  return handle(res, () => service.listarRepartidores({ ciudadId: req.query.ciudadId }));
}

function reasignar(req, res) {
  return handle(res, async () => {
    const db = require('../../models');
    const { dayKey } = require('../app-repartidor/domain');
    const rutaPedido = await db.RutaPedido.findOne({
      where: { fkid_pedido: req.params.id },
      include: [
        { association: 'pedido' },
        { association: 'ruta', include: [{ association: 'ciudad' }] },
      ],
    });
    const repartidor = await db.Repartidor.findByPk(req.body?.fkid_repartidor);
    const zone = rutaPedido?.ruta?.ciudad?.timezone || 'America/Mexico_City';
    return service.reasignar({
      rutaPedido,
      repartidor,
      fechaHoy: dayKey(new Date(), zone),
    });
  });
}

module.exports = { solicitudes, solicitud, aprobar, atender, pedidos, estado, repartidores, reasignar };
