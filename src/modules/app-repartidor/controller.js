const { City } = require('../../models');
const { dayKey } = require('./domain');
const service = require('./service');

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

async function handle(req, res, run) {
  try {
    const data = await run();
    if (data && data.statusCode && data.statusCode !== 200) {
      return res.status(data.statusCode).json({
        success: false,
        message: data.message || 'No se pudo completar la solicitud',
      });
    }
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function me(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.perfil(depsFrom(req, { fecha, timezone }));
  });
}

async function jornada(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.obtenerJornada(depsFrom(req, { fecha, timezone }));
  });
}

async function replaceCarga(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.replaceCarga(depsFrom(req, {
      fecha,
      timezone,
      lineas: req.body.lineas || req.body.cargas || [],
    }));
  });
}

async function solicitarValidacion(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.solicitarValidacion(depsFrom(req, { fecha, timezone }));
  });
}

async function leerSolicitud(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.leerSolicitud(depsFrom(req, {
      fecha,
      timezone,
      notificacionId: req.params.notificacionId,
    }));
  });
}

async function pedidos(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.listarPedidos(depsFrom(req, { fecha, timezone }));
  });
}

async function pedido(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.detallePedido(depsFrom(req, { fecha, timezone }));
  });
}

async function llegada(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.llegada(depsFrom(req, { fecha, timezone }));
  });
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
  });
}

async function noEntregar(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.noEntregar(depsFrom(req, { fecha, timezone }));
  });
}

async function codigo(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.validarCodigo(depsFrom(req, {
      fecha,
      timezone,
      codigo: req.body.codigo,
    }));
  });
}

async function productos(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.ajustarProductos(depsFrom(req, {
      fecha,
      timezone,
      items: req.body.items || req.body.productos || req.body.lineas || [],
    }));
  });
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
  });
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
  });
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
  });
}

async function estadisticas(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.estadisticas(depsFrom(req, { fecha, timezone }));
  });
}

async function logros(req, res) {
  return handle(req, res, async () => {
    const { fecha, timezone } = await fechaDeHoy(req);
    return service.logros(depsFrom(req, { fecha, timezone }));
  });
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
