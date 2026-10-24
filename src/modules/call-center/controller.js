const service = require('./service');
const { getHub } = require('../realtime');
const { Logger } = require('../../utils/logger');

const log = new Logger('CallCenter');
const MUTATIONS = new Set(['aprobar', 'extras', 'atender', 'estado', 'reasignar', 'liberarCierre', 'reagendar', 'cambiarFranja', 'moverParada', 'liberarSiguiente', 'subirComprobante', 'asignarActividad', 'cerrarSinCodigo', 'resolverAyuda', 'guardarContacto']);

function live(extra) {
  return {
    ...extra,
    notify: (repartidorId, event) => getHub().notify(repartidorId, event),
  };
}

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

function cargasValidadas(req, res) {
  return handle(res, () => service.listarCargasValidadas({}), 'cargasValidadas');
}

function solicitud(req, res) {
  return handle(res, () => service.detalleSolicitud({ notificacionId: req.params.id }), 'solicitud');
}

function aprobar(req, res) {
  return handle(res, () => service.aprobar(live({
    notificacionId: req.params.id,
    usuario: req.user,
  })), 'aprobar');
}

function extras(req, res) {
  return handle(res, () => service.guardarExtras(live({
    notificacionId: req.params.id,
    lineas: req.body?.lineas || [],
  })), 'extras');
}

function inventario(req, res) {
  return handle(res, () => service.buscarInventario({ q: req.query.q }), 'inventario');
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
  return handle(res, () => service.cambiarEstado(live({
    pedidoId: req.params.id,
    estado: req.body?.estado,
  })), 'estado');
}

function repartidores(req, res) {
  return handle(res, () => service.listarRepartidores({ ciudadId: req.query.ciudadId }), 'repartidores');
}

function contactos(req, res) {
  return handle(res, () => service.listarContactos({}), 'contactos');
}

function guardarContacto(req, res) {
  return handle(res, () => service.guardarContacto({
    usuarioId: req.params.usuarioId,
    telefono: req.body?.telefono,
    repartidorIds: req.body?.repartidor_ids,
    usuario: req.user,
  }), 'guardarContacto');
}

function liberarCierre(req, res) {
  return handle(res, () => service.liberarCierre(live({
    notificacionId: req.params.id,
    usuario: req.user,
  })), 'liberarCierre');
}

function reagendar(req, res) {
  return handle(res, () => service.reagendar(live({
    pedidoId: req.params.id,
    fecha: req.body?.fecha,
    motivo: req.body?.motivo,
    usuario: req.user,
  })), 'reagendar');
}

function liberarSiguiente(req, res) {
  return handle(res, () => service.liberarSiguiente(live({
    pedidoId: req.params.id,
  })), 'liberarSiguiente');
}

function comprobantes(req, res) {
  return handle(res, () => service.listarComprobantes({}), 'comprobantes');
}

function subirComprobante(req, res) {
  if (req.fileValidationError) {
    return res.status(422).json({ success: false, message: req.fileValidationError });
  }
  return handle(res, () => service.subirComprobante({
    pedidoId: req.params.id,
    file: req.file,
  }), 'subirComprobante');
}

function depositos(req, res) {
  return handle(res, () => service.listarDepositos({}), 'depositos');
}

function actividades(req, res) {
  return handle(res, () => service.listarActividadesDisponibles({
    ciudadId: req.query.ciudadId || null,
  }), 'actividades');
}

function asignarActividad(req, res) {
  return handle(res, () => service.asignarActividad(live({
    pedidoId: req.body?.pedido_id,
    repartidorId: req.body?.fkid_repartidor,
  })), 'asignarActividad');
}

function velocidad(req, res) {
  return handle(res, async () => {
    const { resumenVelocidad } = require('../app-repartidor/service');
    const fecha = await service.fechaDeHoy({});
    return resumenVelocidad({ fecha });
  }, 'velocidad');
}

function cambiarFranja(req, res) {
  return handle(res, () => service.cambiarFranja(live({
    pedidoId: req.params.id,
    franja: req.body?.franja,
    alcance: req.body?.alcance,
  })), 'cambiarFranja');
}

function moverParada(req, res) {
  return handle(res, () => service.moverParada(live({
    pedidoId: req.params.id,
    direccion: req.body?.direccion,
  })), 'moverParada');
}

function resolverAyuda(req, res) {
  return handle(res, () => service.resolverAyuda(live({
    notificacionId: req.params.id,
    accion: req.body?.accion,
    receptor: req.body?.receptor,
    usuario: req.user,
  })), 'resolverAyuda');
}

function cerrarSinCodigo(req, res) {
  return handle(res, () => service.cerrarSinCodigo(live({
    pedidoId: req.params.id,
    motivo: req.body?.motivo,
    usuario: req.user,
  })), 'cerrarSinCodigo');
}

function reasignar(req, res) {
  return handle(res, () => service.reasignar(live({
    pedidoId: req.params.id,
    repartidorId: req.body?.fkid_repartidor,
  })), 'reasignar');
}

module.exports = {
  solicitudes,
  cargasValidadas,
  solicitud,
  aprobar,
  extras,
  inventario,
  atender,
  pedidos,
  estado,
  repartidores,
  reasignar,
  liberarCierre,
  contactos,
  guardarContacto,
  reagendar,
  cambiarFranja,
  moverParada,
  liberarSiguiente,
  velocidad,
  comprobantes,
  subirComprobante,
  depositos,
  actividades,
  asignarActividad,
  cerrarSinCodigo,
  resolverAyuda,
};
