const { approveCheck, attendCheck, appendNota, stamp, NOTE_LIMIT, transition } = require('./domain');

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

module.exports = { aprobar, atender, cambiarEstado };
