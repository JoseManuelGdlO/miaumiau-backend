const { Op, literal } = require('sequelize');
const { dayKey } = require('../app-repartidor/domain');
const { refrescarCargaEnValidacion, olvidarOrdenRuta, liberarSiguienteParada } = require('../app-repartidor/service');
const { reemplazarSaldo } = require('../app-repartidor/inventario-vehiculo');
const {
  approveCheck,
  reagendarCheck,
  attendCheck,
  appendNota,
  stamp,
  phoneOf,
  NOTE_LIMIT,
  transition,
  reassignCheck,
  isOpenSolicitud,
  sigueHoy,
  esDeHoy,
  isValidatedCheckIn,
  toCargaValidada,
  toSolicitudResumen,
  toSolicitudDetalle,
  toPedidoDia,
  toRepartidorOpcion,
  nombreRol,
  puedeAutorizarExcepcion,
  cierreDirectoCheck,
  normalizarContacto,
  normalizarLineas,
  lineasDeFila,
  comprobantePublicPath,
  ACTIVE,
} = require('./domain');
const { ensureDeliveryCode } = require('../app-repartidor/assignCode');
const { franjaDeHorario } = require('../pedidos/horario');
const { registrarCambio } = require('../historial/service');
const { reencolarNoEntregados, encolarAlDiaSiguiente, soltarParadasAbiertas } = require('../pedidos/reencolar');
const usersWithPermission = require('../../utils/usersWithPermission');
const { Logger } = require('../../utils/logger');

const log = new Logger('CallCenter');

const STOCK_ON_CANCEL = ['pendiente', 'confirmado'];
const DEFAULT_ZONE = 'America/Mexico_City';

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

async function responderRepartidor(deps = {}) {
  const texto = String(deps.texto || '').trim().slice(0, 300);
  if (texto.length < 2) fail(422, 'Escribe el mensaje');
  const id = Number(deps.repartidorId);
  if (!Number.isFinite(id)) fail(422, 'Repartidor inválido');
  // shortcut: el aviso vive solo en el socket, persistir si el repartidor debe verlo al reabrir la app
  await safeNotify(deps, id, { type: 'soporte.mensaje', texto });
  return { enviado: true };
}

async function safeNotify(deps, repartidorId, event) {
  if (typeof deps.notify !== 'function' || repartidorId == null || repartidorId === '') return;
  try {
    await deps.notify(Number(repartidorId), event);
  } catch (error) {
    log.warn('No se pudo avisar al repartidor', { message: error.message });
  }
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
        "JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.tipo')) IN ('check_in', 'llamada_cliente', 'soporte', 'cierre_dia')"
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
  if (jornada?.update) {
    const aprobador = await nombreAprobador(deps);
    await jornada.update({
      validado_por_usuario_id: aprobador.id,
      validado_por_nombre: aprobador.nombre,
    });
  }
  await safeNotify(deps, jornada?.fkid_repartidor, { type: 'solicitud.atendida' });
  await cargarCamioneta(deps, jornada);
  return { atendida: true };
}

async function cargarCamioneta(deps, jornada) {
  if (!jornada || (process.env.NODE_ENV === 'test' && !deps.models)) return;
  const db = getModels(deps);
  if (typeof db.InventarioVehiculo?.destroy !== 'function') return;
  let cargas = jornada.cargas;
  if (!Array.isArray(cargas) && typeof db.JornadaCarga?.findAll === 'function') {
    cargas = await db.JornadaCarga.findAll({ where: { fkid_jornada: jornada.id } });
  }
  if (!Array.isArray(cargas)) return;
  const repartidorId = jornada.fkid_repartidor || (jornada.datos && jornada.datos.repartidor_id);
  if (repartidorId == null) return;
  await reemplazarSaldo(db, {
    repartidorId,
    jornadaId: jornada.id,
    lineas: cargas,
  });
}

async function nombreAprobador(deps) {
  const id = deps.usuario?.id ?? null;
  if (deps.usuario?.nombre_completo) return { id, nombre: deps.usuario.nombre_completo };
  if (!id) return { id: null, nombre: null };
  const db = getModels(deps);
  if (!db.User?.findByPk) return { id, nombre: null };
  const user = await db.User.findByPk(id, { attributes: ['id', 'nombre_completo'] });
  return { id, nombre: user?.nombre_completo || null };
}

async function guardarExtras(deps = {}) {
  const db = getModels(deps);
  const notificacion = deps.notificacion || await db.Notificacion.findByPk(deps.notificacionId);
  if (!notificacion) fail(404, 'Solicitud no encontrada');
  const datos = notificacion.datos || {};
  const jornada = deps.jornada || await db.JornadaRepartidor.findOne({
    where: { fkid_notificacion: notificacion.id },
  });
  const vigente = Boolean(jornada && Number(jornada.fkid_notificacion) === Number(notificacion.id));
  const abierta = datos.tipo === 'check_in'
    && !notificacion.leida
    && datos.estado_solicitud !== 'cancelada'
    && jornada?.estado === 'esperando_call_center'
    && vigente;
  if (!abierta) fail(409, 'Ese check-in ya no admite carga extra');

  const resolved = [];
  for (const line of deps.lineas || []) {
    const cantidad = Number(line.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      fail(422, 'La cantidad del extra no es válida');
    }
    const producto = await db.Inventario.findByPk(line.fkid_producto);
    if (!producto || producto.baja_logica) fail(422, 'Producto extra sin inventario');
    const precio = Number(producto.precio_venta);
    if (!Number.isFinite(precio) || precio < 0) fail(422, 'El producto no tiene precio de venta');
    resolved.push({
      fkid_jornada: jornada.id,
      nombre: producto.nombre,
      fkid_producto: producto.id,
      cantidad,
      precio_unitario: precio,
      es_extra: true,
    });
  }

  const previos = await leerExtras(db, jornada);
  const cambiaron = firmaExtra(previos) !== firmaExtra(resolved);
  await db.JornadaCarga.destroy({ where: { fkid_jornada: jornada.id, es_extra: true } });
  if (resolved.length) await db.JornadaCarga.bulkCreate(resolved);
  if (cambiaron) {
    const datosActuales = { ...(notificacion.datos || {}), espera_reenvio: true };
    if (typeof notificacion.update === 'function') await notificacion.update({ datos: datosActuales });
    else notificacion.datos = datosActuales;
    if (typeof jornada.update === 'function') await jornada.update({ estado: 'borrador' });
    else jornada.estado = 'borrador';
  }
  await safeNotify(deps, jornada?.fkid_repartidor, { type: 'jornada.actualizada' });
  return {
    reenvio: cambiaron,
    cargas: resolved.map((c) => ({
      nombre: c.nombre,
      fkid_producto: c.fkid_producto,
      cantidad: c.cantidad,
      precio_unitario: c.precio_unitario,
      es_extra: true,
    })),
  };
}

function firmaExtra(lines) {
  return (lines || [])
    .map((line) => `${Number(line.fkid_producto)}:${Number(line.cantidad)}`)
    .sort()
    .join('|');
}

async function leerExtras(db, jornada) {
  if (typeof db.JornadaCarga?.findAll === 'function') {
    const rows = await db.JornadaCarga.findAll({
      where: { fkid_jornada: jornada.id, es_extra: true },
    });
    return rows || [];
  }
  return (jornada.cargas || []).filter((line) => line && line.es_extra);
}

async function buscarInventario(deps = {}) {
  const q = String(deps.q || '').trim();
  const db = getModels(deps);
  const where = { baja_logica: false };
  if (q) where.nombre = { [Op.like]: `%${q.replace(/[\\%_]/g, '\\$&')}%` };
  const rows = await db.Inventario.findAll({
    where,
    attributes: ['id', 'nombre', 'precio_venta'],
    limit: q ? 20 : 100,
    order: [['nombre', 'ASC']],
  });
  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    precio_venta: Number(row.precio_venta),
  }));
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

  const repartidorDeRuta = rutaPedido?.ruta?.fkid_repartidor;
  const result = await withTx(deps, async (t) => {
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
    return { id: lockedPedido.id, estado: deps.estado, avisar: Boolean(fresh.route) };
  });
  if (result.avisar) {
    await safeNotify(deps, repartidorDeRuta, {
      type: 'ruta.actualizada',
      pedidoId: Number(deps.pedidoId),
    });
  }
  return { id: result.id, estado: result.estado };
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

  const anterior = ruta?.fkid_repartidor;
  const nuevo = driver?.id;
  const result = await withTx(deps, async (t) => {
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
  const pedidoId = Number(deps.pedidoId);
  const fecha = fechaKey(ruta.fecha_ruta);
  await refrescarFoto(deps, anterior, fecha);
  if (Number(nuevo) !== Number(anterior)) await refrescarFoto(deps, nuevo, fecha);
  await safeNotify(deps, anterior, { type: 'ruta.actualizada', pedidoId });
  if (Number(nuevo) !== Number(anterior)) {
    await safeNotify(deps, nuevo, { type: 'ruta.actualizada', pedidoId });
  }
  return result;
}

async function refrescarFoto(deps, repartidorId, fecha) {
  if (repartidorId == null || repartidorId === '') return;
  try {
    await refrescarCargaEnValidacion({ models: deps.models, repartidorId, fecha });
  } catch (error) {
    log.warn('No se pudo refrescar la carga en validación', { message: error.message });
  }
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
  const hoy = deps.fecha || await fechaDeHoy(deps);
  const open = rows.filter((row) => isOpenSolicitud(row) && sigueHoy(row, hoy));
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
    result.push({ ...toSolicitudResumen(row, repartidor, numero), de_hoy: esDeHoy(row, hoy) });
  }
  return result;
}

async function listarCargasValidadas(deps = {}) {
  const db = getModels(deps);
  const rows = deps.rows || await db.Notificacion.findAll({
    where: {
      leida: true,
      [Op.and]: [
        literal("JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.tipo')) = 'check_in'"),
        literal(
          "(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.estado_solicitud')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.estado_solicitud')) <> 'cancelada')"
        ),
      ],
    },
    order: [['id', 'DESC']],
    limit: 50,
  });
  const result = [];
  for (const row of rows.filter(isValidatedCheckIn)) {
    const datos = row.datos || {};
    const repartidor = datos.repartidor_id
      ? await db.Repartidor.findByPk(datos.repartidor_id, { attributes: ['id', 'nombre_completo'] })
      : null;
    const jornada = datos.jornada_id
      ? await db.JornadaRepartidor.findByPk(datos.jornada_id, { include: [{ association: 'cargas' }] })
      : null;
    result.push(toCargaValidada({ notificacion: row, repartidor, jornada }));
  }
  return result;
}

async function detalleSolicitud(deps = {}) {
  const db = getModels(deps);
  const notificacion = deps.notificacion || await db.Notificacion.findByPk(deps.notificacionId);
  const abierta = isOpenSolicitud(notificacion);
  const yaValidada = isValidatedCheckIn(notificacion);
  if (!notificacion || (!abierta && !yaValidada)) fail(404, 'Solicitud no encontrada');
  const datos = notificacion.datos || {};
  const repartidor = datos.repartidor_id
    ? await db.Repartidor.findByPk(datos.repartidor_id, { attributes: ['id', 'nombre_completo'] })
    : null;
  let cargas = [];
  let pedido = null;
  let dineroEsperado = null;
  let deposito = null;
  let jornada = null;
  if (datos.tipo === 'check_in' && datos.jornada_id) {
    jornada = await db.JornadaRepartidor.findByPk(datos.jornada_id, { include: [{ association: 'cargas' }] });
    cargas = jornada?.cargas || [];
    dineroEsperado = jornada?.dinero_esperado;
  }
  if (datos.tipo === 'cierre_dia' && datos.jornada_id) {
    deposito = await db.JornadaRepartidor.findByPk(datos.jornada_id);
  }
  if (datos.pedido_id) {
    pedido = await db.Pedido.findByPk(datos.pedido_id, {
      attributes: { exclude: ['codigo_entrega'] },
      include: [{ association: 'cliente', attributes: ['id', 'nombre_completo', 'telefono'] }],
    });
  }
  const detalle = {
    ...toSolicitudDetalle({ notificacion, repartidor, cargas, pedido, dineroEsperado, deposito }),
    ya_validada: yaValidada,
  };
  if (datos.tipo === 'check_in') detalle.pedidos = await pedidosDeLaCarga(deps, jornada);
  return detalle;
}

function pedidosDeRutas(rutas) {
  const pedidos = [];
  for (const ruta of rutas || []) {
    if (ruta.baja_logica || ruta.estado === 'cancelada') continue;
    for (const parada of ruta.pedidos || []) {
      const pedido = parada.pedido;
      if (!pedido || pedido.baja_logica || pedido.estado === 'cancelado') continue;
      pedidos.push({
        numero_pedido: pedido.numero_pedido || String(pedido.id || ''),
        cliente: pedido.cliente?.nombre_completo || '',
        productos: (pedido.productos || [])
          .filter((linea) => linea && !linea.baja_logica)
          .map((linea) => ({
            nombre: linea.producto?.nombre || linea.nombre || '',
            cantidad: Number(linea.cantidad) || 0,
          }))
          .filter((linea) => linea.nombre),
      });
    }
  }
  return pedidos;
}

async function pedidosDeLaCarga(deps, jornada) {
  if (!jornada?.fkid_repartidor || !jornada.fecha) return [];
  const db = getModels(deps);
  if (typeof db.Ruta?.findAll !== 'function') return [];
  const rutas = await db.Ruta.findAll({
    where: {
      fkid_repartidor: jornada.fkid_repartidor,
      fecha_ruta: jornada.fecha,
      baja_logica: false,
    },
    include: [{
      association: 'pedidos',
      required: false,
      include: [{
        association: 'pedido',
        required: false,
        include: [
          { association: 'cliente', attributes: ['nombre_completo'], required: false },
          {
            association: 'productos',
            required: false,
            include: [{ association: 'producto', attributes: ['nombre'], required: false }],
          },
        ],
      }],
    }],
  });
  return pedidosDeRutas(rutas);
}

async function listarPedidos(deps = {}) {
  const db = getModels(deps);
  const fecha = deps.fecha || await fechaDeHoy(deps);
  const rutaWhere = { fecha_ruta: fecha, baja_logica: false };
  if (deps.ciudadId) rutaWhere.fkid_ciudad = deps.ciudadId;
  if (deps.repartidorId) rutaWhere.fkid_repartidor = deps.repartidorId;
  const rows = await db.RutaPedido.findAll({
    include: [
      {
        association: 'pedido',
        required: true,
        where: { baja_logica: false },
        include: [
          { association: 'cliente' },
          { association: 'productos', required: false },
          { association: 'cobro_entrega', required: false },
        ],
      },
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

async function liberarCierre(deps = {}) {
  if (!puedeAutorizarExcepcion(deps.usuario?.rol?.nombre)) fail(403, 'Solo un super admin puede aprobar el check-out');
  const db = getModels(deps);
  const notificacion = deps.notificacion || await db.Notificacion.findByPk(deps.notificacionId);
  if (!notificacion) fail(404, 'Solicitud no encontrada');
  const datos = notificacion.datos || {};
  if (datos.tipo !== 'cierre_dia' || notificacion.leida || datos.estado_solicitud === 'cancelada') {
    fail(409, 'Ese cierre ya no se puede liberar');
  }
  const jornada = deps.jornada || await db.JornadaRepartidor.findByPk(datos.jornada_id);
  if (!jornada || jornada.estado !== 'validada' || !jornada.comprobante_deposito_path) {
    fail(409, 'El repartidor todavía no envió el cierre');
  }
  const quien = await nombreAprobador(deps);
  await notificacion.update({ leida: true, datos: { ...datos, estado_solicitud: 'atendida' } });
  if (typeof db.Notificacion?.findAll === 'function') {
    const avisos = await db.Notificacion.findAll({ where: openSolicitudWhere() });
    for (const aviso of avisos.filter(isOpenSolicitud)) {
      const extra = aviso.datos || {};
      if (extra.tipo === 'cierre_dia' && Number(extra.jornada_id) === Number(jornada.id) && typeof aviso.update === 'function') {
        await aviso.update({ leida: true, datos: { ...extra, estado_solicitud: 'atendida' } });
      }
    }
  }
  await jornada.update({
    estado: 'cerrada',
    cerrada_en: new Date(),
    cerrado_por_usuario_id: quien.id,
    cerrado_por_nombre: quien.nombre,
  });
  await soltarParadasAbiertas(db, jornada.fkid_repartidor, jornada.fecha || await fechaDeHoy(deps));
  await safeNotify(deps, jornada.fkid_repartidor, { type: 'jornada.actualizada' });
  return { cerrada: true, cerrado_por_nombre: quien.nombre };
}

async function cierreDirecto(deps = {}) {
  const db = getModels(deps);
  const repartidorId = Number(deps.repartidorId);
  if (!Number.isInteger(repartidorId) || repartidorId <= 0) fail(422, 'Elige un repartidor');
  const fecha = deps.fecha || await fechaDeHoy(deps);
  const jornada = deps.jornada || await db.JornadaRepartidor.findOne({
    where: { fkid_repartidor: repartidorId, fecha },
  });
  const regla = cierreDirectoCheck({
    rol: deps.usuario?.rol?.nombre,
    tieneJornada: Boolean(jornada),
    estado: jornada?.estado,
  });
  if (!regla.ok) fail(regla.statusCode, regla.message);
  const quien = await nombreAprobador(deps);
  await jornada.update({
    estado: 'cerrada',
    cerrada_en: new Date(),
    cerrado_por_usuario_id: quien.id,
    cerrado_por_nombre: quien.nombre,
  });
  const avisos = typeof db.Notificacion?.findAll === 'function'
    ? await db.Notificacion.findAll({ where: openSolicitudWhere() })
    : [];
  for (const aviso of avisos.filter(isOpenSolicitud)) {
    const datos = aviso.datos || {};
    if (datos.tipo === 'cierre_dia' && Number(datos.jornada_id) === Number(jornada.id) && typeof aviso.update === 'function') {
      await aviso.update({ leida: true });
    }
  }
  await soltarParadasAbiertas(db, repartidorId, fecha);
  await safeNotify(deps, repartidorId, { type: 'jornada.actualizada' });
  return { cerrada: true, cerrado_por_nombre: quien.nombre };
}

async function reagendar(deps = {}) {
  const hoy = await fechaDeHoy(deps);
  const regla = reagendarCheck({ fecha: deps.fecha, hoy, rol: deps.usuario?.rol?.nombre });
  if (!regla.ok) fail(regla.statusCode, regla.message);
  const fecha = regla.fecha;
  const motivo = String(deps.motivo || '').trim();
  if (!motivo) fail(422, 'El motivo es obligatorio');
  const db = getModels(deps);
  const pedido = deps.pedido || await db.Pedido.findByPk(deps.pedidoId);
  if (!pedido || pedido.baja_logica) fail(404, 'Pedido no encontrado');
  if (['entregado', 'cancelado'].includes(pedido.estado)) fail(409, 'Ese pedido ya no se puede reagendar');
  const quien = await nombreAprobador(deps);
  const note = appendNota(
    pedido.notas,
    `Reagendado al ${fecha} por ${quien.nombre || 'Call Center'}: ${motivo}`,
    stamp(deps.now || new Date())
  );
  if (!note.ok) fail(note.statusCode, note.message);
  const estado = pedido.estado === 'no_entregado' || pedido.estado === 'en_camino' ? 'confirmado' : pedido.estado;
  await pedido.update({ fecha_entrega_estimada: fecha, estado, notas: note.notas });
  const paradas = await db.RutaPedido.findAll({
    where: { fkid_pedido: pedido.id },
    include: [{
      model: db.Ruta,
      as: 'ruta',
      required: true,
      where: { fecha_ruta: hoy, baja_logica: false },
    }],
  });
  for (const parada of paradas) {
    if (typeof parada.destroy === 'function') await parada.destroy();
  }
  return { id: pedido.id, fecha_entrega_estimada: fecha, notas: note.notas };
}

async function liberarSiguiente(deps = {}) {
  const parada = await findRutaDeHoy(deps, deps.pedidoId);
  if (!parada?.ruta) fail(409, 'Ese pedido no está en una ruta de hoy');
  const franja = parada.franja === 'tarde' ? 'tarde' : 'manana';
  const result = await liberarSiguienteParada({
    models: deps.models,
    repartidorId: parada.ruta.fkid_repartidor,
    fecha: fechaKey(parada.ruta.fecha_ruta),
    franja,
    avisarSiguiente: deps.avisarSiguiente,
  });
  await safeNotify(deps, parada.ruta.fkid_repartidor, {
    type: 'ruta.actualizada',
    pedidoId: result.pedido_id,
  });
  return result;
}

async function cambiarFranja(deps = {}) {
  const franja = deps.franja === 'tarde' ? 'tarde' : deps.franja === 'manana' ? 'manana' : null;
  if (!franja) fail(422, 'La franja no es válida');
  const db = getModels(deps);
  const parada = await findRutaDeHoy(deps, deps.pedidoId);
  if (!parada) fail(409, 'Ese pedido no está en una ruta de hoy');
  const paradas = deps.alcance === 'ruta' && parada.ruta
    ? await db.RutaPedido.findAll({ where: { fkid_ruta: parada.fkid_ruta || parada.ruta.id }, include: [{ association: 'pedido', required: false }] })
    : [parada];
  await exigirFranja(db, paradas.length ? paradas : [parada], franja);
  await parada.update({ franja });
  if (deps.alcance === 'ruta' && parada.ruta) {
    if (typeof parada.ruta.update === 'function') await parada.ruta.update({ franja });
    const hermanas = await db.RutaPedido.findAll({ where: { fkid_ruta: parada.fkid_ruta || parada.ruta.id } });
    for (const row of hermanas) {
      if (typeof row.update === 'function') await row.update({ franja });
    }
  }
  olvidarOrdenRuta(parada.ruta?.fkid_repartidor, fechaKey(parada.ruta?.fecha_ruta));
  await safeNotify(deps, parada.ruta?.fkid_repartidor, { type: 'ruta.actualizada', pedidoId: Number(deps.pedidoId) });
  return { franja };
}

async function moverParada(deps = {}) {
  const dir = deps.direccion === 'subir' ? -1 : deps.direccion === 'bajar' ? 1 : 0;
  if (!dir) fail(422, 'La dirección no es válida');
  const db = getModels(deps);
  const parada = await findRutaDeHoy(deps, deps.pedidoId);
  if (!parada) fail(409, 'Ese pedido no está en una ruta de hoy');
  const hermanas = await db.RutaPedido.findAll({
    where: { fkid_ruta: parada.fkid_ruta },
    order: [['orden_entrega', 'ASC'], ['id', 'ASC']],
  });
  const franja = parada.franja === 'tarde' ? 'tarde' : 'manana';
  const grupo = hermanas.filter((row) => (row.franja === 'tarde' ? 'tarde' : 'manana') === franja);
  const index = grupo.findIndex((row) => Number(row.id) === Number(parada.id));
  const vecino = grupo[index + dir];
  if (index < 0 || !vecino) {
    return { orden_entrega: parada.orden_entrega, orden_manual: true };
  }
  const ordenActual = parada.orden_entrega;
  const ordenVecino = vecino.orden_entrega;
  await parada.update({ orden_entrega: ordenVecino, orden_manual: true });
  if (typeof vecino.update === 'function' && ordenActual !== ordenVecino) {
    await vecino.update({ orden_entrega: ordenActual });
  }
  olvidarOrdenRuta(parada.ruta?.fkid_repartidor, fechaKey(parada.ruta?.fecha_ruta));
  await safeNotify(deps, parada.ruta?.fkid_repartidor, { type: 'ruta.actualizada', pedidoId: Number(deps.pedidoId) });
  return { orden_entrega: ordenVecino, orden_manual: true };
}

function diaEntre(fecha) {
  return {
    [Op.between]: [new Date(`${fecha}T00:00:00.000Z`), new Date(`${fecha}T23:59:59.999Z`)],
  };
}

async function cambiarDireccion(deps = {}) {
  const direccion = String(deps.direccion || '').trim();
  if (direccion.length < 10) fail(422, 'Escribe la dirección completa');
  const db = getModels(deps);
  const pedido = deps.pedido || await db.Pedido.findByPk(deps.pedidoId);
  if (!pedido || pedido.baja_logica) fail(404, 'Pedido no encontrado');
  if (['entregado', 'cancelado'].includes(pedido.estado)) fail(409, 'Ese pedido ya no se puede cambiar');
  await pedido.update({ direccion_entrega: direccion.slice(0, 500) });
  return { direccion_entrega: direccion.slice(0, 500) };
}

async function listarComprobantes(deps = {}) {
  const db = getModels(deps);
  const historico = deps.historico === '1' || deps.historico === true;
  const fecha = historico ? null : (deps.fecha || await fechaDeHoy(deps));
  const rows = await db.RutaPedido.findAll({
    include: [
      {
        association: 'pedido',
        required: true,
        where: { baja_logica: false },
        include: [
          { association: 'cobro_entrega', required: false },
          { association: 'ciudad', required: false, attributes: ['nombre'] },
        ],
      },
      {
        association: 'ruta',
        required: true,
        where: fecha ? { fecha_ruta: fecha, baja_logica: false } : { baja_logica: false },
        include: [{ association: 'repartidor' }],
      },
    ],
  });
  return rows.flatMap((row) => {
    const pedido = row.pedido;
    const cobro = pedido.cobro_entrega || pedido.cobroEntrega;
    const metodo = cobro?.metodo || pedido.metodo_pago;
    const admiteFoto = metodo === 'transferencia' || metodo === 'mixto';
    if (!cobro && !admiteFoto) return [];
    return [{
      pedido_id: pedido.id,
      numero_pedido: pedido.numero_pedido,
      repartidor: row.ruta?.repartidor?.nombre_completo || null,
      ciudad: pedido.ciudad?.nombre || null,
      metodo,
      nota: row.notas_entrega || null,
      fecha: row.ruta?.fecha_ruta || null,
      comprobante_url: comprobantePublicPath(cobro?.comprobante_path),
      puede_subir: admiteFoto && !cobro?.comprobante_path,
    }];
  });
}

async function anotarComprobante(deps = {}) {
  const texto = String(deps.comentario || '').trim().slice(0, 300);
  if (texto.length < 2) fail(422, 'Escribe el comentario');
  const db = getModels(deps);
  const parada = await db.RutaPedido.findOne({
    where: { fkid_pedido: deps.pedidoId },
    order: [['id', 'DESC']],
  });
  if (!parada) fail(404, 'Ese pedido no está en una ruta');
  // shortcut: el comentario vive en notas_entrega; moverlo a cobros_entrega cuando exista esa columna
  const previas = String(parada.notas_entrega || '');
  const linea = `Comprobante: ${texto}`;
  await parada.update({ notas_entrega: (previas.includes(linea) ? previas : `${previas ? `${previas}\n` : ''}${linea}`).slice(0, 1000) });
  return { guardado: true };
}

async function subirComprobante(deps = {}) {
  if (!deps.file) fail(422, 'Falta la foto del comprobante');
  const db = getModels(deps);
  const pedido = deps.pedido || await db.Pedido.findByPk(deps.pedidoId);
  if (!pedido || pedido.baja_logica) fail(404, 'Pedido no encontrado');
  const metodo = pedido.metodo_pago === 'mixto' ? 'mixto' : 'transferencia';
  if (!['transferencia', 'mixto'].includes(pedido.metodo_pago) && !deps.cobro) {
    const existente = await db.CobroEntrega.findOne({ where: { fkid_pedido: pedido.id } });
    if (!existente || !['transferencia', 'mixto'].includes(existente.metodo)) {
      fail(422, 'Ese pedido no admite comprobante');
    }
  }
  const path = `comprobantes/${deps.file.filename}`;
  const cobro = await db.CobroEntrega.findOne({ where: { fkid_pedido: pedido.id } });
  if (cobro) {
    await cobro.update({ comprobante_path: path });
    return { pedido_id: pedido.id, comprobante_url: comprobantePublicPath(path) };
  }
  const fecha = await fechaDeHoy(deps);
  const parada = await db.RutaPedido.findOne({
    where: { fkid_pedido: pedido.id },
    include: [{
      association: 'ruta',
      required: true,
      where: { fecha_ruta: fecha, baja_logica: false },
    }],
  });
  if (!parada?.ruta?.fkid_repartidor) fail(409, 'Ese pedido no está en una ruta de hoy');
  const total = Number(pedido.total) || 0;
  await db.CobroEntrega.create({
    fkid_pedido: pedido.id,
    fkid_repartidor: parada.ruta.fkid_repartidor,
    metodo,
    monto_efectivo: metodo === 'mixto' ? 0 : 0,
    monto_transferencia: total,
    comprobante_path: path,
  });
  return { pedido_id: pedido.id, comprobante_url: comprobantePublicPath(path) };
}

async function listarDepositos(deps = {}) {
  const db = getModels(deps);
  const fecha = deps.fecha || await fechaDeHoy(deps);
  const rows = await db.JornadaRepartidor.findAll({
    where: {
      fecha,
      comprobante_deposito_path: { [Op.ne]: null },
    },
    include: [{ association: 'repartidor', attributes: ['id', 'nombre_completo'], required: false }],
  });
  return rows
    .filter((row) => row.comprobante_deposito_path)
    .map((row) => ({
      jornada_id: row.id,
      repartidor: row.repartidor?.nombre_completo || null,
      efectivo_a_depositar: Number(row.efectivo_a_depositar) || 0,
      comprobante_url: comprobantePublicPath(row.comprobante_deposito_path),
    }));
}

async function exigirFranja(db, paradas, franja) {
  let pedidos = paradas.map((row) => row.pedido).filter(Boolean);
  const faltan = paradas.filter((row) => !row.pedido && row.fkid_pedido);
  if (faltan.length && typeof db.Pedido?.findAll === 'function') {
    pedidos = pedidos.concat(await db.Pedido.findAll({
      where: { id: faltan.map((row) => row.fkid_pedido) },
      attributes: ['id', 'horario_preferente'],
    }));
  }
  for (const pedido of pedidos) {
    const esperada = franjaDeHorario(pedido.horario_preferente);
    if (!esperada || esperada === franja) continue;
    const hora = String(pedido.horario_preferente).slice(0, 5);
    fail(422, `A partir de las ${hora} corresponde a ${esperada === 'tarde' ? 'Tarde' : 'Mañana'}`);
  }
}

async function listarActividadesDisponibles(deps = {}) {
  const db = getModels(deps);
  const fecha = deps.fecha || await fechaDeHoy(deps);
  await reencolarNoEntregados({ Pedido: db.Pedido, fecha });
  const where = {
    baja_logica: false,
    fecha_entrega_estimada: diaEntre(fecha),
    estado: { [Op.notIn]: ['entregado', 'cancelado', 'no_entregado'] },
  };
  if (deps.ciudadId) where.fkid_ciudad = deps.ciudadId;
  const pedidos = await db.Pedido.findAll({
    where,
    attributes: ['id', 'numero_pedido', 'fkid_ciudad'],
    include: [{ association: 'cliente', attributes: ['nombre_completo'], required: false }],
  });
  if (!pedidos.length) return [];
  const asignados = await db.RutaPedido.findAll({
    where: { fkid_pedido: pedidos.map((pedido) => pedido.id) },
    include: [{
      association: 'ruta',
      required: true,
      where: { fecha_ruta: fecha, baja_logica: false, estado: { [Op.ne]: 'cancelada' } },
    }],
  });
  const ocupados = new Set(asignados.map((row) => Number(row.fkid_pedido)));
  return pedidos
    .filter((pedido) => !ocupados.has(Number(pedido.id)))
    .map((pedido) => ({
      id: pedido.id,
      numero_pedido: pedido.numero_pedido,
      cliente: pedido.cliente?.nombre_completo || null,
      ciudad_id: pedido.fkid_ciudad,
    }));
}

async function asignarActividad(deps = {}) {
  const db = getModels(deps);
  const pedido = deps.pedido || await db.Pedido.findByPk(deps.pedidoId);
  if (!pedido || pedido.baja_logica) fail(404, 'Pedido no encontrado');
  if (['entregado', 'cancelado', 'no_entregado'].includes(pedido.estado)) {
    fail(409, 'Ese pedido ya no se puede asignar');
  }
  const driver = deps.repartidor || await db.Repartidor.findByPk(deps.repartidorId);
  if (!driver || driver.baja_logica) fail(404, 'Repartidor no encontrado');
  if (Number(driver.fkid_ciudad) !== Number(pedido.fkid_ciudad)) {
    fail(422, 'El repartidor no es de la ciudad del pedido');
  }
  const fecha = deps.fecha || await fechaDeHoy(deps);
  const ya = await db.RutaPedido.findAll({
    where: { fkid_pedido: pedido.id },
    include: [{
      association: 'ruta',
      required: true,
      where: { fecha_ruta: fecha, baja_logica: false, estado: { [Op.ne]: 'cancelada' } },
    }],
  });
  if (ya.length) fail(409, 'Ese pedido ya está en una ruta de hoy');
  let ruta = await db.Ruta.findOne({
    where: {
      fkid_repartidor: driver.id,
      fkid_ciudad: pedido.fkid_ciudad,
      fecha_ruta: fecha,
      baja_logica: false,
      estado: { [Op.ne]: 'cancelada' },
    },
  });
  if (!ruta) {
    ruta = await db.Ruta.create({
      nombre_ruta: `Call Center ${fecha} ${driver.nombre_completo}`.slice(0, 100),
      fecha_ruta: fecha,
      fkid_ciudad: pedido.fkid_ciudad,
      fkid_repartidor: driver.id,
      estado: 'planificada',
      total_pedidos: 0,
      total_entregados: 0,
      distancia_estimada: 0,
      tiempo_estimado: 0,
    });
  }
  const maximo = await db.RutaPedido.max('orden_entrega', { where: { fkid_ruta: ruta.id } });
  await db.RutaPedido.create({
    fkid_ruta: ruta.id,
    fkid_pedido: pedido.id,
    orden_entrega: (Number(maximo) || 0) + 1,
    orden_manual: true,
    estado_entrega: 'pendiente',
    franja: franjaDeHorario(pedido.horario_preferente) || (ruta.franja === 'tarde' ? 'tarde' : 'manana'),
    liberado_en: deps.now || new Date(),
  });
  await ruta.update({ total_pedidos: (Number(ruta.total_pedidos) || 0) + 1 });
  try {
    await ensureDeliveryCode(pedido);
  } catch (error) {
    log.warn('No se pudo generar el código de la actividad extra', { message: error.message });
  }
  await safeNotify(deps, driver.id, { type: 'ruta.actualizada', pedidoId: Number(pedido.id) });
  return { ruta_id: ruta.id, pedido_id: pedido.id };
}

async function listarContactos(deps = {}) {
  const db = getModels(deps);
  const users = deps.usuarios || await usersWithPermission('operar_call_center');
  const guardados = typeof db.ContactoSoporte?.findAll === 'function' ? await db.ContactoSoporte.findAll() : [];
  const repartidores = typeof db.Repartidor?.findAll === 'function'
    ? await db.Repartidor.findAll({
      attributes: ['id', 'nombre_completo'],
      order: [['nombre_completo', 'ASC']],
    })
    : [];
  const porUsuario = new Map(guardados.map((row) => [Number(row.fkid_usuario), row]));
  return {
    personas: users.map((user) => {
      const row = porUsuario.get(Number(user.id));
      const lineas = lineasDeFila(row || { telefono: '', repartidores: [] });
      return {
        id: user.id,
        nombre: user.nombre_completo,
        telefono: lineas[0]?.telefono || '',
        repartidor_ids: lineas.flatMap((linea) => linea.repartidorIds),
        numeros: lineas.map((linea) => ({ telefono: linea.telefono, repartidor_ids: linea.repartidorIds })),
      };
    }).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')),
    repartidores: repartidores.map((row) => ({ id: row.id, nombre: row.nombre_completo })),
  };
}

async function guardarContacto(deps = {}) {
  const norma = Array.isArray(deps.numeros)
    ? normalizarLineas(deps.numeros)
    : normalizarContacto({ telefono: deps.telefono, repartidorIds: deps.repartidorIds });
  if (!norma.ok) fail(norma.statusCode, norma.message);
  const numeros = norma.numeros || [{ telefono: norma.telefono, repartidorIds: norma.repartidorIds }];
  const tomados = new Set(numeros.flatMap((linea) => linea.repartidorIds));
  const db = getModels(deps);
  const usuarioId = Number(deps.usuarioId);
  if (!puedeAutorizarExcepcion(deps.usuario?.rol?.nombre)) fail(403, 'Solo un super admin puede cambiar los contactos');
  const users = deps.usuarios || await usersWithPermission('operar_call_center');
  if (!users.some((user) => Number(user.id) === usuarioId)) fail(404, 'Esa persona no tiene acceso a Call Center');
  const rows = await db.ContactoSoporte.findAll();
  for (const row of rows) {
    if (Number(row.fkid_usuario) === usuarioId) continue;
    const raw = row.repartidores;
    const queda = Array.isArray(raw) && raw.length && typeof raw[0] === 'object'
      ? raw.map((item) => ({
        telefono: item.telefono,
        repartidorIds: (item.repartidorIds || item.repartidor_ids || []).map(Number).filter((id) => !tomados.has(id)),
      }))
      : (Array.isArray(raw) ? raw.map(Number).filter((id) => !tomados.has(id)) : []);
    const antes = JSON.stringify(raw || []);
    if (JSON.stringify(queda) !== antes) await row.update({ repartidores: queda });
  }
  const propio = rows.find((row) => Number(row.fkid_usuario) === usuarioId);
  const guardado = numeros.length > 1 || Array.isArray(deps.numeros)
    ? numeros
    : numeros[0].repartidorIds;
  if (propio) await propio.update({ telefono: numeros[0].telefono, repartidores: guardado });
  else await db.ContactoSoporte.create({ fkid_usuario: usuarioId, telefono: numeros[0].telefono, repartidores: guardado });
  return { guardado: true };
}

async function resolverAyuda(deps = {}) {
  const accion = deps.accion;
  const db = getModels(deps);
  const notificacion = deps.notificacion || await db.Notificacion.findByPk(deps.notificacionId);
  if (!notificacion) fail(404, 'Solicitud no encontrada');
  const datos = notificacion.datos || {};
  const pedidoId = Number(datos.pedido_id);
  if (!pedidoId) fail(422, 'Esta solicitud no tiene pedido');
  const parada = await findRutaDeHoy(deps, pedidoId);
  if (!parada) fail(409, 'Ese pedido no está en una ruta de hoy');
  const repartidorId = parada.ruta?.fkid_repartidor;
  if (accion === 'ver_codigo') {
    if (datos.ayuda !== 'codigo') fail(422, 'Esta solicitud no es una ayuda con el código');
    const pedido = await db.Pedido.findByPk(pedidoId, { attributes: ['codigo_entrega'] });
    if (!pedido?.codigo_entrega) fail(404, 'Ese pedido no tiene código');
    return { codigo: pedido.codigo_entrega };
  }
  if (accion === 'aprobar_codigo' || accion === 'autorizar_tercero') {
    if (!puedeAutorizarExcepcion(deps.usuario?.rol?.nombre)) fail(403, 'Solo un super admin puede autorizar esta entrega');
  }
  if (accion === 'aprobar_codigo') {
    if (datos.ayuda !== 'codigo') fail(422, 'Esta solicitud no es una ayuda con el código');
    await parada.update({ codigo_validado_en: new Date() });
    await safeNotify(deps, repartidorId, { type: 'ruta.actualizada', pedidoId });
    return { aprobado: true };
  }
  if (accion === 'autorizar_tercero') {
    if (datos.ayuda !== 'tercero') fail(422, 'El repartidor todavía no pidió entregar a otra persona');
    const receptor = String(deps.receptor || '').trim();
    if (receptor.length < 2) fail(422, 'Escribe quién recibe');
    await parada.update({ entrega_tercero_en: new Date() });
    if (typeof notificacion.update === 'function') {
      await notificacion.update({ datos: { ...datos, receptor_nombre: receptor } });
    }
    await registrarCambio({
      usuarioId: deps.usuario?.id,
      accion: 'Entrega a otra persona',
      entidad: 'pedido',
      entidadId: pedidoId,
      detalle: `Autorizada la entrega del pedido ${pedidoId} a ${receptor}`,
    });
    await safeNotify(deps, repartidorId, { type: 'ruta.actualizada', pedidoId });
    return { autorizado: true };
  }
  fail(422, 'Esa acción no existe');
}

async function cerrarSinCodigo(deps = {}) {
  const motivo = String(deps.motivo || '').trim();
  if (motivo.length < 5) fail(422, 'Escribe por qué se cierra el pedido sin el código del cliente');
  const db = getModels(deps);
  const pedido = await db.Pedido.findByPk(deps.pedidoId);
  if (!pedido || pedido.baja_logica) fail(404, 'Pedido no encontrado');
  if (['entregado', 'cancelado', 'no_entregado'].includes(pedido.estado)) {
    fail(409, 'Ese pedido ya está cerrado');
  }
  const parada = await findRutaDeHoy(deps, pedido.id);
  if (parada?.estado_entrega === 'fallido') fail(409, 'Ese pedido ya está cerrado');
  const ahora = new Date();
  await pedido.update({ estado: 'no_entregado' });
  const nadie = /no contest|nadie|no hab[ií]a/i.test(motivo);
  if (nadie) {
    try {
      const { avisarNoEncontrado, elegirLinea } = require('../mensajeria/reagendar-whatsapp');
      const { formatPhoneForWhatsApp } = require('../../services/whatsappWindowService');
      const lineas = typeof db.WhatsAppPhoneNumber?.findAll === 'function'
        ? await db.WhatsAppPhoneNumber.findAll({ attributes: ['phoneid', 'telefono'] })
        : [];
      const ciudad = pedido.fkid_ciudad && typeof db.City?.findByPk === 'function'
        ? await db.City.findByPk(pedido.fkid_ciudad, { attributes: ['telefono'] })
        : null;
      await avisarNoEncontrado({
        telefono: formatPhoneForWhatsApp(phoneOf(pedido)),
        linea: elegirLinea(lineas, { telefonoCiudad: ciudad?.telefono }),
      });
    } catch (error) {
      log.warn('No se pudo avisar el reagendo por WhatsApp', { message: error.message });
    }
  }
  await encolarAlDiaSiguiente(pedido, await fechaDeHoy(deps));
  if (parada && typeof parada.update === 'function') {
    await parada.update({ estado_entrega: 'fallido', fecha_entrega_real: ahora });
  }
  const { registrarCambio } = require('../historial/service');
  const numero = pedido.numero_pedido || pedido.id;
  await registrarCambio({
    usuarioId: deps.usuario?.id,
    accion: 'Cierre sin código',
    entidad: 'pedido',
    entidadId: pedido.id,
    detalle: `Pedido ${numero} cerrado sin código del cliente. Motivo: ${motivo}`,
  });
  await safeNotify(deps, parada?.ruta?.fkid_repartidor, {
    type: 'ruta.actualizada',
    pedidoId: Number(pedido.id),
  });
  return { id: pedido.id, estado: pedido.estado };
}

module.exports = {
  aprobar,
  guardarExtras,
  buscarInventario,
  atender,
  cambiarEstado,
  reasignar,
  listarSolicitudes,
  listarCargasValidadas,
  detalleSolicitud,
  listarPedidos,
  listarRepartidores,
  fechaDeHoy,
  liberarCierre,
  cierreDirecto,
  reagendar,
  cambiarFranja,
  moverParada,
  liberarSiguiente,
  cambiarDireccion,
  listarComprobantes,
  anotarComprobante,
  subirComprobante,
  listarDepositos,
  listarActividadesDisponibles,
  asignarActividad,
  cerrarSinCodigo,
  responderRepartidor,
  resolverAyuda,
  listarContactos,
  guardarContacto,
};
