const { City } = require('../../models');
const { dayKey } = require('./domain');
const service = require('./service');
const { Logger } = require('../../utils/logger');

const log = new Logger('AppRepartidor');
const MUTATIONS = new Set([
  'replaceCarga',
  'solicitarValidacion',
  'llegada',
  'solicitarLlamada',
  'noEntregar',
  'codigo',
  'productos',
  'entregar',
  'caja',
  'soporte',
]);

async function fechaDeHoy(req) {
  let timezone = req.repartidor?.ciudad?.timezone;
  if (!timezone && req.repartidor?.fkid_ciudad) {
    const ciudad = await City.findByPk(req.repartidor.fkid_ciudad);
    timezone = ciudad?.timezone;
  }
  return { fecha: dayKey(new Date(), timezone), timezone };
}

function depsFrom(req, extra = {}) {
  return {
    repartidorId: req.repartidorId,
    repartidor: req.repartidor,
    pedidoId: req.params.id,
    ...extra,
  };
}

async function handle(req, res, run, action) {
  try {
    const data = await run();
    if (data && data.statusCode && data.statusCode !== 200) {
      const status = data.statusCode;
      if (status >= 500) log.error(`${action} falló`, { message: data.message });
      else log.warn(`${action} rechazado`, { status, reason: data.message || 'rechazado' });
      return res.status(status).json({
        success: false,
        message: data.message || 'No se pudo completar la solicitud',
      });
    }
    if (MUTATIONS.has(action)) log.info(action, { id: req.params && req.params.id });
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) log.error(`${action} falló`, { message: err.message });
    else log.warn(`${action} rechazado`, { status, reason: err.message });
    return res.status(status).json({ success: false, message: err.message });
  }
}

async function me(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.perfil(depsFrom(req, { fecha, timezone }));
  }, 'me');
}

async function jornada(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.obtenerJornada(depsFrom(req, { fecha, timezone }));
  }, 'jornada');
}

async function replaceCarga(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.replaceCarga(depsFrom(req, {
      fecha,
      timezone,
      lineas: req.body.lineas || req.body.cargas || [],
    }));
  }, 'replaceCarga');
}

async function solicitarValidacion(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.solicitarValidacion(depsFrom(req, { fecha, timezone }));
  }, 'solicitarValidacion');
}

async function leerSolicitud(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.leerSolicitud(depsFrom(req, {
      fecha,
      timezone,
      notificacionId: req.params.notificacionId,
    }));
  }, 'leerSolicitud');
}

async function pedidos(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.listarPedidos(depsFrom(req, { fecha, timezone }));
  }, 'pedidos');
}

async function pedido(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.detallePedido(depsFrom(req, { fecha, timezone }));
  }, 'pedido');
}

async function llegada(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.llegada(depsFrom(req, { fecha, timezone }));
  }, 'llegada');
}

async function solicitarLlamada(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.crearSoporte(depsFrom(req, {
      fecha,
      timezone,
      motivo: 'llamada',
      pedidoId: req.params.id,
    }));
  }, 'solicitarLlamada');
}

async function noEntregar(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.noEntregar(depsFrom(req, { fecha, timezone }));
  }, 'noEntregar');
}

async function codigo(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.validarCodigo(depsFrom(req, {
      fecha,
      timezone,
      codigo: req.body.codigo,
    }));
  }, 'codigo');
}

async function productos(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.ajustarProductos(depsFrom(req, {
      fecha,
      timezone,
      items: req.body.items || req.body.productos || req.body.lineas || [],
    }));
  }, 'productos');
}

async function entregar(req, res) {
  return handle(req, res, async () => {
    if (req.fileValidationError) {
      const err = Object.assign(new Error(req.fileValidationError), { status: 422 });
      throw err;
    }
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.entregar(depsFrom(req, {
      fecha,
      timezone,
      metodo: req.body.metodo,
      monto_efectivo: req.body.monto_efectivo,
      monto_transferencia: req.body.monto_transferencia,
      efectivo: req.body.efectivo,
      transferencia: req.body.transferencia,
      file: req.file,
    }));
  }, 'entregar');
}

async function caja(req, res) {
  return handle(req, res, async () => {
    if (req.fileValidationError) {
      const err = Object.assign(new Error(req.fileValidationError), { status: 422 });
      throw err;
    }
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.registrarCaja(depsFrom(req, {
      fecha,
      timezone,
      efectivo: req.body.efectivo,
      file: req.file,
    }));
  }, 'caja');
}

async function soporte(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.crearSoporte(depsFrom(req, {
      fecha,
      timezone,
      motivo: req.body.motivo,
      pedidoId: req.body.pedido_id || req.body.pedidoId,
    }));
  }, 'soporte');
}

async function estadisticas(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.estadisticas(depsFrom(req, { fecha, timezone }));
  }, 'estadisticas');
}

async function logros(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.logros(depsFrom(req, { fecha, timezone }));
  }, 'logros');
}

module.exports = {
  me,
  jornada,
  replaceCarga,
  solicitarValidacion,
  leerSolicitud,
  pedidos,
  pedido,
  llegada,
  solicitarLlamada,
  noEntregar,
  codigo,
  productos,
  entregar,
  caja,
  soporte,
  estadisticas,
  logros,
};
