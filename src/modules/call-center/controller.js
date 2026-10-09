const service = require('./service');
const { Logger } = require('../../utils/logger');

const log = new Logger('CallCenter');
const MUTATIONS = new Set(['aprobar', 'atender', 'estado', 'reasignar']);

async function handle(res, run, action) {
  try {
    const data = await run();
    if (MUTATIONS.has(action)) log.info(action);
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) log.error(`${action} falló`, { message: err.message });
    else log.warn(`${action} rechazado`, { status, reason: err.message });
    return res.status(status).json({
      success: false,
      message: err.message || 'No se pudo completar la solicitud',
    });
  }
}

function solicitudes(req, res) {
  return handle(res, () => service.listarSolicitudes({}), 'solicitudes');
}

function solicitud(req, res) {
  return handle(res, () => service.detalleSolicitud({ notificacionId: req.params.id }), 'solicitud');
}

function aprobar(req, res) {
  return handle(res, () => service.aprobar({ notificacionId: req.params.id }), 'aprobar');
}

function atender(req, res) {
  return handle(res, () => service.atender({
    notificacionId: req.params.id,
    nota: req.body?.nota,
  }), 'atender');
}

function pedidos(req, res) {
  return handle(res, () => service.listarPedidos({
    ciudadId: req.query.ciudadId || null,
    repartidorId: req.query.repartidorId || null,
  }), 'pedidos');
}

function estado(req, res) {
  return handle(res, () => service.cambiarEstado({
    pedidoId: req.params.id,
    estado: req.body?.estado,
  }), 'estado');
}

function repartidores(req, res) {
  return handle(res, () => service.listarRepartidores({ ciudadId: req.query.ciudadId }), 'repartidores');
}

function reasignar(req, res) {
  return handle(res, () => service.reasignar({
    pedidoId: req.params.id,
    repartidorId: req.body?.fkid_repartidor,
  }), 'reasignar');
}

module.exports = { solicitudes, solicitud, aprobar, atender, pedidos, estado, repartidores, reasignar };
