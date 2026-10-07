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

async function atender(deps = {}) {
  const db = getModels(deps);
  const notificacion = deps.notificacion || await db.Notificacion.findByPk(deps.notificacionId);
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

  return withTx(deps, async (t) => {
    if (note && pedidoId) {
      const pedido = deps.pedido || await db.Pedido.findByPk(pedidoId, txOpts(t));
      if (!pedido) fail(404, 'Pedido no encontrado');
      const zone = deps.timezone || 'America/Mexico_City';
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
  await pedido[decision.method]();
  if (decision.route) {
    const rutaPedido = deps.rutaPedido || await db.RutaPedido.findOne({
      where: { fkid_pedido: pedido.id },
    });
    if (rutaPedido) {
      const patch = { estado_entrega: decision.route.estado_entrega };
      if (decision.route.fecha_entrega_real) patch.fecha_entrega_real = deps.now || new Date();
      await rutaPedido.update(patch);
    }
  }
  return { id: pedido.id, estado: deps.estado };
}

async function reasignar(deps = {}) {
  const db = getModels(deps);
  const rutaPedido = deps.rutaPedido;
  const pedido = rutaPedido?.pedido;
  const ruta = rutaPedido?.ruta;
  if (!rutaPedido || !pedido || !ruta) fail(404, 'Pedido no encontrado');
  if (String(ruta.fecha_ruta) !== String(deps.fechaHoy)) {
    fail(409, 'Ese pedido no está en una ruta de hoy');
  }
  const driver = deps.repartidor;
  const check = reassignCheck({
    pedidoEstado: pedido.estado,
    sameDriver: driver ? Number(ruta.fkid_repartidor) === Number(driver.id) : false,
    driverFound: Boolean(driver),
    sameCity: Boolean(driver) && Number(driver.fkid_ciudad) === Number(ruta.fkid_ciudad),
    driverEstado: driver?.estado,
  });
  if (!check.ok) fail(check.statusCode, check.message);

  let destino = deps.rutaDestino || null;
  let creada = false;
  if (!destino) {
    const rows = await db.Ruta.findAll({
      where: {
        fkid_repartidor: driver.id,
        fkid_ciudad: ruta.fkid_ciudad,
        fecha_ruta: ruta.fecha_ruta,
        baja_logica: false,
      },
      order: [['id', 'ASC']],
    });
    destino = rows.find((row) => row.estado !== 'cancelada') || null;
  }
  if (!destino) {
    const nombre = `Call Center ${ruta.fecha_ruta} ${driver.nombre_completo}`.slice(0, 100);
    destino = await db.Ruta.create({
      nombre_ruta: nombre,
      fecha_ruta: ruta.fecha_ruta,
      fkid_ciudad: ruta.fkid_ciudad,
      fkid_repartidor: driver.id,
      estado: 'planificada',
      total_pedidos: 0,
      total_entregados: 0,
      distancia_estimada: 0,
      tiempo_estimado: 0,
    });
    creada = true;
  }
  const siblings = deps.destPedidos || await db.RutaPedido.findAll({ where: { fkid_ruta: destino.id } });
  const maxOrden = siblings.reduce((max, row) => Math.max(max, Number(row.orden_entrega) || 0), 0);
  await rutaPedido.update({
    fkid_ruta: destino.id,
    orden_entrega: maxOrden + 1,
    estado_entrega: 'pendiente',
    llego_en: null,
    codigo_validado_en: null,
  });
  await ruta.update({ total_pedidos: Math.max(0, Number(ruta.total_pedidos) - 1) });
  await destino.update({ total_pedidos: Number(destino.total_pedidos) + 1 });
  return { ruta_id: destino.id, creada, orden_entrega: maxOrden + 1 };
}

async function fechaDeHoy(deps) {
  let zone = 'America/Mexico_City';
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
    where: { leida: false },
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
  const db = getModels(deps);
  const { Op } = require('sequelize');
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
