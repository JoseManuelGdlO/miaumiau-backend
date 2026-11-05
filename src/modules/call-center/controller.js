const service = require('./service');
const { getHub } = require('../realtime');
const { Logger } = require('../../utils/logger');

const log = new Logger('CallCenter');
const MUTATIONS = new Set(['aprobar', 'extras', 'atender', 'estado', 'reasignar', 'liberarCierre', 'cierreDirecto', 'reagendar', 'cambiarFranja', 'cambiarDireccion', 'moverParada', 'liberarSiguiente', 'subirComprobante', 'anotarComprobante', 'asignarActividad', 'cerrarSinCodigo', 'resolverAyuda', 'guardarContacto', 'responder', 'liberarIntento', 'verCodigo', 'enviarCodigo', 'avisarFalla']);

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
    numeros: req.body?.numeros,
    usuario: req.user,
  }), 'guardarContacto');
}

function liberarCierre(req, res) {
  return handle(res, () => service.liberarCierre(live({
    notificacionId: req.params.id,
    usuario: req.user,
  })), 'liberarCierre');
}

function responder(req, res) {
  return handle(res, () => service.responderRepartidor(live({
    repartidorId: req.params.id,
    texto: req.body?.texto,
  })), 'responder');
}

function cierreDirecto(req, res) {
  return handle(res, () => service.cierreDirecto(live({
    repartidorId: req.params.id,
    usuario: req.user,
  })), 'cierreDirecto');
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

function cambiarDireccion(req, res) {
  return handle(res, () => service.cambiarDireccion({
    pedidoId: req.params.id,
    direccion: req.body?.direccion,
  }), 'cambiarDireccion');
}

function comprobantes(req, res) {
  return handle(res, () => service.listarComprobantes({
    fecha: req.query.fecha || null,
    historico: req.query.historico || null,
  }), 'comprobantes');
}

function corte(req, res) {
  return handle(res, () => service.corteDeRepartidor({
    repartidorId: req.query.repartidorId || req.query.repartidor_id,
    fecha: req.query.fecha || null,
  }), 'corte');
}

function anotarComprobante(req, res) {
  return handle(res, () => service.anotarComprobante({
    pedidoId: req.params.id,
    comentario: req.body?.comentario,
  }), 'anotarComprobante');
}

function subirComprobante(req, res) {
  if (req.fileValidationError) {
    return res.status(422).json({ success: false, message: req.fileValidationError });
  }
  return handle(res, () => service.subirComprobante(live({
    pedidoId: req.params.id,
    file: req.file,
  })), 'subirComprobante');
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

function trazado(req, res) {
  return handle(res, async () => {
    const { Ruta, RutaPedido, Pedido, Repartidor, City, Cliente } = require('../../models');
    const { construirTrazado } = require('../maps/google');
    const ruta = await Ruta.findByPk(req.params.id, {
      include: [
        { model: Repartidor, as: 'repartidor', attributes: ['id', 'nombre_completo', 'lat_actual', 'lng_actual', 'ubicacion_at'] },
        { model: City, as: 'ciudad', attributes: ['id', 'nombre', 'departamento'] },
        {
          model: RutaPedido,
          as: 'pedidos',
          include: [{
            model: Pedido,
            as: 'pedido',
            include: [{ model: Cliente, as: 'cliente', attributes: ['id', 'nombre_completo'] }],
          }],
        },
      ],
    });
    if (!ruta) {
      const error = new Error('Ruta no encontrada');
      error.status = 404;
      throw error;
    }
    return construirTrazado(ruta);
  }, 'trazado');
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

function liberarIntento(req, res) {
  return handle(res, () => service.liberarIntento(live({
    notificacionId: req.params.id,
    usuario: req.user,
  })), 'liberarIntento');
}

function verCodigo(req, res) {
  return handle(res, () => service.verCodigo(live({
    pedidoId: req.params.id,
    usuario: req.user,
  })), 'verCodigo');
}

function enviarCodigo(req, res) {
  return handle(res, () => service.enviarCodigo(live({
    pedidoId: req.params.id,
    usuario: req.user,
  })), 'enviarCodigo');
}

function avisarFalla(req, res) {
  return handle(res, () => service.avisarFalla(live({
    motivo: req.body?.motivo,
    pedidoIds: req.body?.pedido_ids,
    repartidorId: req.body?.repartidor_id,
    usuario: req.user,
  })), 'avisarFalla');
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
  cierreDirecto,
  responder,
  contactos,
  guardarContacto,
  reagendar,
  cambiarFranja,
  moverParada,
  liberarSiguiente,
  velocidad,
  trazado,
  cambiarDireccion,
  comprobantes,
  corte,
  anotarComprobante,
  subirComprobante,
  depositos,
  actividades,
  asignarActividad,
  cerrarSinCodigo,
  resolverAyuda,
  liberarIntento,
  verCodigo,
  enviarCodigo,
  avisarFalla,
};
