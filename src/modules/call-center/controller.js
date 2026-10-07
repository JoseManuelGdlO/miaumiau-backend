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
  return handle(res, () => service.atender({
    notificacionId: req.params.id,
    nota: req.body?.nota,
  }));
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
  return handle(res, () => service.reasignar({
    pedidoId: req.params.id,
    repartidorId: req.body?.fkid_repartidor,
  }));
}

module.exports = { solicitudes, solicitud, aprobar, atender, pedidos, estado, repartidores, reasignar };
