const { Op, literal } = require('sequelize');
const { dayKey } = require('../app-repartidor/domain');
const {
  approveCheck,
  attendCheck,
  appendNota,
  stamp,
  NOTE_LIMIT,
  transition,
  reassignCheck,
  isOpenSolicitud,
  toSolicitudResumen,
  toSolicitudDetalle,
  toPedidoDia,
  toRepartidorOpcion,
  ACTIVE,
} = require('./domain');
const { Logger } = require('../../utils/logger');

const log = new Logger('CallCenter');

const STOCK_ON_CANCEL = ['pendiente', 'confirmado'];
const DEFAULT_ZONE = 'America/Mexico_City';

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function getModels(deps = {}) {
  return deps.models || require('../../models');
}

function txOpts(t) {
  return t ? { transaction: t } : {};
}

async function withTx(deps, fn) {
  if (deps.transaction) return deps.transaction(fn);
  const db = getModels(deps);
  return db.sequelize.transaction(fn);
}

function lockOpts(t) {
  const opts = txOpts(t);
  if (t && t.LOCK && t.LOCK.UPDATE) opts.lock = t.LOCK.UPDATE;
  return opts;
}

async function lockRow(model, current, injected, t) {
  if (!current) return current;
  if (injected && !(t && t.LOCK && t.LOCK.UPDATE)) return current;
  if (!model || typeof model.findByPk !== 'function' || current.id == null) return current;
  return model.findByPk(current.id, lockOpts(t));
}

function fechaKey(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function rowIsLiveToday(row, now) {
  const ruta = row?.ruta;
  if (!ruta || ruta.baja_logica) return false;
  const zone = ruta.ciudad?.timezone || DEFAULT_ZONE;
  return fechaKey(ruta.fecha_ruta) === dayKey(now, zone);
}

async function runSaveInTx(instance, t, run) {
  if (!t || !instance || typeof instance.save !== 'function') return run();
  const original = instance.save;
  instance.save = function saveInTx(opts = {}) {
    return original.call(this, { ...(opts || {}), transaction: t });
  };
  try {
    return await run();
  } finally {
    instance.save = original;
  }
}

async function findRutaDeHoy(deps, pedidoId, t) {
  const db = getModels(deps);
  const now = deps.now || new Date();
  const rows = await db.RutaPedido.findAll({
    where: { fkid_pedido: pedidoId },
    include: [
      {
        association: 'ruta',
        required: true,
        where: { baja_logica: false },
        include: [{ association: 'ciudad', required: false }],
      },
      { association: 'pedido', required: false },
    ],
    ...txOpts(t),
  });
  const live = rows.filter((row) => rowIsLiveToday(row, now));
  live.sort((a, b) => Number(b.id) - Number(a.id));
  return live[0] || null;
}

function openSolicitudWhere() {
  return {
    leida: false,
    [Op.and]: [
      literal(
        "JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.tipo')) IN ('check_in', 'llamada_cliente', 'soporte')"
      ),
      literal(
        "(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.estado_solicitud')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.estado_solicitud')) <> 'cancelada')"
      ),
    ],
  };
}

async function restaurarStockCancelacion(deps, pedido, t) {
  if (!STOCK_ON_CANCEL.includes(pedido.estado)) return;
  const db = getModels(deps);
  const productosPedido = await db.ProductoPedido.findAll({
    where: { fkid_pedido: pedido.id, baja_logica: false },
    include: [{ model: db.Inventario, as: 'producto', required: false }],
    ...txOpts(t),
  });
  const paquetesPedido = await db.PaquetePedido.findAll({
    where: { fkid_pedido: pedido.id },
    include: [{ model: db.Paquete, as: 'paquete', required: false }],
    ...txOpts(t),
  });

  const productosPorPaquete = {};
  for (const paquetePedido of paquetesPedido) {
    if (!paquetePedido.fkid_paquete) continue;
    const productosPaquete = await db.ProductoPaquete.findAll({
      where: { fkid_paquete: paquetePedido.fkid_paquete },
      ...txOpts(t),
    });
    for (const productoPaquete of productosPaquete) {
      const cantidadTotal = paquetePedido.cantidad * productoPaquete.cantidad;
      if (!productosPorPaquete[productoPaquete.fkid_producto]) {
        productosPorPaquete[productoPaquete.fkid_producto] = 0;
      }
      productosPorPaquete[productoPaquete.fkid_producto] += cantidadTotal;
    }
  }

  for (const productoPedido of productosPedido) {
    if (!productoPedido.fkid_producto) continue;
    const producto = productoPedido.producto;
    if (!producto) continue;
    const cantidadARestaurar = productoPedido.cantidad;
    if (cantidadARestaurar > 0) {
      try {
        await runSaveInTx(producto, t, () => producto.restaurarStock(cantidadARestaurar));
      } catch (error) {
        log.error(`Error al restaurar stock del producto ${producto.id}`, { message: error.message });
      }
    }
  }

  for (const [productoId, cantidadTotal] of Object.entries(productosPorPaquete)) {
    const producto = await db.Inventario.findByPk(productoId, txOpts(t));
    if (producto && cantidadTotal > 0) {
      try {
        await runSaveInTx(producto, t, () => producto.restaurarStock(cantidadTotal));
      } catch (error) {
        log.error(`Error al restaurar stock del producto ${producto.id} desde paquetes`, { message: error.message });
      }
    }
  }
}

async function aprobar(deps = {}) {
  const db = getModels(deps);
  const notificacion = deps.notificacion || await db.Notificacion.findByPk(deps.notificacionId);
  if (!notificacion) fail(404, 'Solicitud no encontrada');
  const datos = notificacion.datos || {};
  const jornada = deps.jornada || await db.JornadaRepartidor.findOne({
    where: { fkid_notificacion: notificacion.id },
  });
  const check = approveCheck({
    tipo: datos.tipo,
    leida: notificacion.leida,
    estadoSolicitud: datos.estado_solicitud,
    jornadaEstado: jornada?.estado,
    vigente: Boolean(jornada && Number(jornada.fkid_notificacion) === Number(notificacion.id)),
  });
  if (!check.ok) fail(check.statusCode, check.message);
  await notificacion.update({ leida: true });
  return { atendida: true };
}

async function zonaDelPedido(deps, db, pedido, t) {
  if (deps.timezone) return deps.timezone;
  if (pedido?.ciudad?.timezone) return pedido.ciudad.timezone;
  if (pedido?.fkid_ciudad && db.City?.findByPk) {
    const city = await db.City.findByPk(pedido.fkid_ciudad, txOpts(t));
    if (city?.timezone) return city.timezone;
  }
  return DEFAULT_ZONE;
}

async function atender(deps = {}) {
  const db = getModels(deps);
  return withTx(deps, async (t) => {
    const notificacion = deps.notificacion
      || await db.Notificacion.findByPk(deps.notificacionId, lockOpts(t));
    if (!notificacion) fail(404, 'Solicitud no encontrada');
    const datos = { ...(notificacion.datos || {}) };
    const check = attendCheck({
      tipo: datos.tipo,
      leida: notificacion.leida,
      estadoSolicitud: datos.estado_solicitud,
    });
    if (!check.ok) fail(check.statusCode, check.message);
    const note = String(deps.nota || '').trim();
    const pedidoId = datos.pedido_id ? Number(datos.pedido_id) : null;

    if (note && pedidoId) {
      const pedido = deps.pedido || await db.Pedido.findByPk(pedidoId, lockOpts(t));
      if (!pedido) fail(404, 'Pedido no encontrado');
      const zone = await zonaDelPedido(deps, db, pedido, t);
      const written = appendNota(pedido.notas, note, stamp(deps.now || new Date(), zone));
      if (!written.ok) fail(written.statusCode, written.message);
      if (written.changed) await pedido.update({ notas: written.notas }, txOpts(t));
    } else if (note) {
      if (note.length > NOTE_LIMIT) fail(422, 'La nota supera 1000 caracteres');
      datos.nota = note;
    }
    await notificacion.update({ leida: true, datos }, txOpts(t));
    return { atendida: true };
  });
}

async function cambiarEstado(deps = {}) {
  const db = getModels(deps);
  const pedido = deps.pedido || await db.Pedido.findByPk(deps.pedidoId);
  if (!pedido || pedido.baja_logica) fail(404, 'Pedido no encontrado');
  const decision = transition(pedido.estado, deps.estado);
  if (!decision.ok) fail(decision.statusCode, decision.message);

  let rutaPedido = null;
  if (decision.route) {
    rutaPedido = deps.rutaPedido || await findRutaDeHoy(deps, pedido.id);
    if (!rutaPedido) fail(409, 'Ese pedido no está en una ruta de hoy');
  }

  return withTx(deps, async (t) => {
    const lockedPedido = await lockRow(db.Pedido, pedido, Boolean(deps.pedido), t);
    if (!lockedPedido || lockedPedido.baja_logica) fail(404, 'Pedido no encontrado');
    const fresh = transition(lockedPedido.estado, deps.estado);
    if (!fresh.ok) fail(fresh.statusCode, fresh.message);

    let lockedStop = rutaPedido;
    if (fresh.route) {
      lockedStop = await lockRow(db.RutaPedido, rutaPedido, Boolean(deps.rutaPedido), t);
      if (!lockedStop) fail(409, 'Ese pedido no está en una ruta de hoy');
    }

    if (deps.estado === 'cancelado') await restaurarStockCancelacion(deps, lockedPedido, t);
    await runSaveInTx(lockedPedido, t, () => lockedPedido[fresh.method]());
    if (fresh.route) {
      const patch = { estado_entrega: fresh.route.estado_entrega };
      if (fresh.route.fecha_entrega_real) patch.fecha_entrega_real = deps.now || new Date();
      await lockedStop.update(patch, txOpts(t));
    }
    return { id: lockedPedido.id, estado: deps.estado };
  });
}

async function reasignar(deps = {}) {
  const db = getModels(deps);
  const rutaPedido = deps.rutaPedido || await findRutaDeHoy(deps, deps.pedidoId);
  if (!rutaPedido) fail(409, 'Ese pedido no está en una ruta de hoy');
  const pedido = rutaPedido.pedido;
  const ruta = rutaPedido.ruta;
  if (!pedido || !ruta) fail(404, 'Pedido no encontrado');
  if (deps.rutaPedido && fechaKey(ruta.fecha_ruta) !== String(deps.fechaHoy)) {
    fail(409, 'Ese pedido no está en una ruta de hoy');
  }
  const driver = deps.repartidor || await db.Repartidor.findByPk(deps.repartidorId);
  const check = reassignCheck({
    pedidoEstado: pedido.estado,
    sameDriver: driver ? Number(ruta.fkid_repartidor) === Number(driver.id) : false,
    driverFound: Boolean(driver),
    sameCity: Boolean(driver) && Number(driver.fkid_ciudad) === Number(ruta.fkid_ciudad),
    driverEstado: driver?.estado,
    bajaLogica: Boolean(driver?.baja_logica),
  });
  if (!check.ok) fail(check.statusCode, check.message);

  return withTx(deps, async (t) => {
    const lockedPedido = await lockRow(db.Pedido, pedido, Boolean(deps.rutaPedido), t);
    const lockedStop = await lockRow(db.RutaPedido, rutaPedido, Boolean(deps.rutaPedido), t);
    const lockedRuta = await lockRow(db.Ruta, ruta, Boolean(deps.rutaPedido), t);
    if (!lockedPedido || lockedPedido.baja_logica) fail(404, 'Pedido no encontrado');
    if (!lockedStop || !lockedRuta || lockedRuta.baja_logica) {
      fail(409, 'Ese pedido no está en una ruta de hoy');
    }
    if (deps.fechaHoy != null && fechaKey(lockedRuta.fecha_ruta) !== String(deps.fechaHoy)) {
      fail(409, 'Ese pedido no está en una ruta de hoy');
    }
    const fresh = reassignCheck({
      pedidoEstado: lockedPedido.estado,
      sameDriver: driver ? Number(lockedRuta.fkid_repartidor) === Number(driver.id) : false,
      driverFound: Boolean(driver),
      sameCity: Boolean(driver) && Number(driver.fkid_ciudad) === Number(lockedRuta.fkid_ciudad),
      driverEstado: driver?.estado,
      bajaLogica: Boolean(driver?.baja_logica),
    });
    if (!fresh.ok) fail(fresh.statusCode, fresh.message);

    let destino = deps.rutaDestino || null;
    let creada = false;
    if (!destino) {
      const rows = await db.Ruta.findAll({
        where: {
          fkid_repartidor: driver.id,
          fkid_ciudad: lockedRuta.fkid_ciudad,
          fecha_ruta: lockedRuta.fecha_ruta,
          baja_logica: false,
        },
        order: [['id', 'ASC']],
        ...lockOpts(t),
      });
      destino = rows.find((row) => row.estado !== 'cancelada') || null;
      if (destino) destino = await lockRow(db.Ruta, destino, Boolean(deps.rutaDestino), t);
    } else {
      destino = await lockRow(db.Ruta, destino, true, t);
    }
    if (!destino) {
      const nombre = `Call Center ${lockedRuta.fecha_ruta} ${driver.nombre_completo}`.slice(0, 100);
      destino = await db.Ruta.create({
        nombre_ruta: nombre,
        fecha_ruta: lockedRuta.fecha_ruta,
        fkid_ciudad: lockedRuta.fkid_ciudad,
        fkid_repartidor: driver.id,
        estado: 'planificada',
        total_pedidos: 0,
        total_entregados: 0,
        distancia_estimada: 0,
        tiempo_estimado: 0,
      }, txOpts(t));
      creada = true;
    }
    const siblings = deps.destPedidos || await db.RutaPedido.findAll({
      where: { fkid_ruta: destino.id },
      ...lockOpts(t),
    });
    const maxOrden = siblings.reduce((max, row) => Math.max(max, Number(row.orden_entrega) || 0), 0);
    const orden = maxOrden + 1;
    await lockedStop.update({
      fkid_ruta: destino.id,
      orden_entrega: orden,
      estado_entrega: 'pendiente',
      llego_en: null,
      codigo_validado_en: null,
    }, txOpts(t));
    await lockedRuta.update({ total_pedidos: Math.max(0, Number(lockedRuta.total_pedidos) - 1) }, txOpts(t));
    await destino.update({ total_pedidos: Number(destino.total_pedidos) + 1 }, txOpts(t));
    return { ruta_id: destino.id, creada, orden_entrega: orden };
  });
}

async function fechaDeHoy(deps) {
  let zone = DEFAULT_ZONE;
  if (deps.ciudadId) {
    const db = getModels(deps);
    const city = deps.city || await db.City.findByPk(deps.ciudadId);
    zone = city?.timezone || zone;
  }
  return dayKey(deps.now || new Date(), zone);
}

async function listarSolicitudes(deps = {}) {
  const db = getModels(deps);
  const rows = deps.rows || await db.Notificacion.findAll({
    where: openSolicitudWhere(),
    order: [['id', 'DESC']],
  });
  const open = rows.filter(isOpenSolicitud);
  const result = [];
  for (const row of open) {
    const datos = row.datos || {};
    const repartidor = datos.repartidor_id
      ? await db.Repartidor.findByPk(datos.repartidor_id, { attributes: ['id', 'nombre_completo'] })
      : null;
    let numero = null;
    if (datos.pedido_id) {
      const pedido = await db.Pedido.findByPk(datos.pedido_id, { attributes: ['numero_pedido'] });
      numero = pedido?.numero_pedido || null;
    }
    result.push(toSolicitudResumen(row, repartidor, numero));
  }
  return result;
}

async function detalleSolicitud(deps = {}) {
  const db = getModels(deps);
  const notificacion = deps.notificacion || await db.Notificacion.findByPk(deps.notificacionId);
  if (!notificacion || !isOpenSolicitud(notificacion)) fail(404, 'Solicitud no encontrada');
  const datos = notificacion.datos || {};
  const repartidor = datos.repartidor_id
    ? await db.Repartidor.findByPk(datos.repartidor_id, { attributes: ['id', 'nombre_completo'] })
    : null;
  let cargas = [];
  let pedido = null;
  if (datos.tipo === 'check_in' && datos.jornada_id) {
    const jornada = await db.JornadaRepartidor.findByPk(datos.jornada_id, { include: [{ association: 'cargas' }] });
    cargas = jornada?.cargas || [];
  }
  if (datos.pedido_id) {
    pedido = await db.Pedido.findByPk(datos.pedido_id, {
      attributes: { exclude: ['codigo_entrega'] },
      include: [{ association: 'cliente', attributes: ['id', 'nombre_completo', 'telefono'] }],
    });
  }
  return toSolicitudDetalle({ notificacion, repartidor, cargas, pedido });
}

async function listarPedidos(deps = {}) {
  const db = getModels(deps);
  const fecha = deps.fecha || await fechaDeHoy(deps);
  const rutaWhere = { fecha_ruta: fecha, baja_logica: false };
  if (deps.ciudadId) rutaWhere.fkid_ciudad = deps.ciudadId;
  if (deps.repartidorId) rutaWhere.fkid_repartidor = deps.repartidorId;
  const rows = await db.RutaPedido.findAll({
    include: [
      { association: 'pedido', required: true, where: { baja_logica: false }, include: [{ association: 'cliente' }] },
      { association: 'ruta', required: true, where: rutaWhere, include: [{ association: 'repartidor' }] },
    ],
    order: [['orden_entrega', 'ASC']],
  });
  return rows.map((row) => toPedidoDia({ pedido: row.pedido, rutaPedido: row, ruta: row.ruta }));
}

async function listarRepartidores(deps = {}) {
  if (deps.ciudadId == null || deps.ciudadId === '') fail(422, 'La ciudad es obligatoria');
  const db = getModels(deps);
  const rows = await db.Repartidor.findAll({
    where: { fkid_ciudad: deps.ciudadId, estado: { [Op.in]: ACTIVE }, baja_logica: false },
    attributes: ['id', 'nombre_completo', 'estado'],
    order: [['nombre_completo', 'ASC']],
  });
  return rows.map(toRepartidorOpcion);
}

module.exports = {
  aprobar,
  atender,
  cambiarEstado,
  reasignar,
  listarSolicitudes,
  detalleSolicitud,
  listarPedidos,
  listarRepartidores,
  fechaDeHoy,
};
