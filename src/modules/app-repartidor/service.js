const { Op, Sequelize } = require('sequelize');
const {
  applyLoadChange,
  checkInOpens,
  canListOrders,
  codesMatch,
  validatePayment,
  validateStock,
  nextPoints,
  evaluateLogros,
  emptyLogros,
  stripPhone,
  dayKey,
  META_DIARIA,
} = require('./domain');

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function getModels(deps = {}) {
  return deps.models || require('../../models');
}

function plain(row) {
  if (!row) return row;
  return typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
}

function toPedidoDto(pedido, rutaPedido) {
  const raw = plain(pedido) || {};
  const {
    codigo_entrega,
    telefono,
    telefono_referencia,
    ...rest
  } = raw;
  rest.cliente = stripPhone(rest.cliente);
  if (rutaPedido) {
    const rp = plain(rutaPedido);
    rest.llego_en = rp.llego_en;
    rest.codigo_validado_en = rp.codigo_validado_en;
    rest.estado_entrega = rp.estado_entrega;
    rest.orden_entrega = rp.orden_entrega;
    rest.lat = rp.lat;
    rest.lng = rp.lng;
    rest.link_ubicacion = rp.link_ubicacion;
  }
  return rest;
}

function serializeCarga(lineas) {
  return JSON.stringify(
    (lineas || []).map((l) => [
      String(l.nombre || ''),
      Number(l.cantidad) || 0,
      Number(l.precio_unitario) || 0,
      Boolean(l.es_extra),
      l.fkid_producto == null ? null : Number(l.fkid_producto),
    ])
  );
}

function addCalendarDays(yyyyMmDd, delta) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function mondayOf(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const back = weekday === 0 ? 6 : weekday - 1;
  return addCalendarDays(yyyyMmDd, -back);
}

async function defaultReplaceLineas(jornada, lineas, db) {
  await db.JornadaCarga.destroy({ where: { fkid_jornada: jornada.id } });
  if (!lineas.length) return;
  await db.JornadaCarga.bulkCreate(
    lineas.map((l) => ({
      fkid_jornada: jornada.id,
      nombre: l.nombre,
      fkid_producto: l.fkid_producto ?? null,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      es_extra: Boolean(l.es_extra),
    }))
  );
}

async function loadJornada(deps = {}, { findOrCreate = false } = {}) {
  if (deps.jornada) return deps.jornada;
  const db = getModels(deps);
  let jornada = await db.JornadaRepartidor.findOne({
    where: { fkid_repartidor: deps.repartidorId, fecha: deps.fecha },
    include: [{ model: db.JornadaCarga, as: 'cargas' }],
  });
  if (!jornada && findOrCreate) {
    jornada = await db.JornadaRepartidor.create({
      fkid_repartidor: deps.repartidorId,
      fecha: deps.fecha,
      estado: 'borrador',
    });
    jornada.cargas = [];
  }
  return jornada;
}

async function loadNotificacion(deps, jornada) {
  if (Object.prototype.hasOwnProperty.call(deps, 'notificacion')) return deps.notificacion;
  if (!jornada?.fkid_notificacion) return null;
  const db = getModels(deps);
  return db.Notificacion.findByPk(jornada.fkid_notificacion);
}

async function defaultCrearNotificacion(deps, payload) {
  const db = getModels(deps);
  const now = new Date();
  return db.Notificacion.create({
    nombre: payload.nombre,
    descripcion: payload.descripcion || null,
    prioridad: payload.prioridad,
    leida: false,
    fecha_creacion: now.toISOString().split('T')[0],
    hora_creacion: now.toTimeString().split(' ')[0],
    datos: payload.datos || null,
  });
}

async function replaceCarga(deps = {}) {
  const jornada = await loadJornada(deps, { findOrCreate: true });
  if (!jornada) fail(404, 'Jornada no encontrada');
  const lineas = deps.lineas || [];
  const notificacion = await loadNotificacion(deps, jornada);
  const changed = serializeCarga(jornada.cargas) !== serializeCarga(lineas);
  const result = applyLoadChange({ estado: jornada.estado, changed });

  if (result.cancelarSolicitud && notificacion) {
    await notificacion.update({
      leida: true,
      datos: { ...(notificacion.datos || {}), estado_solicitud: 'cancelada' },
    });
  }

  const replaceLineas = deps.replaceLineas || (() => defaultReplaceLineas(jornada, lineas, getModels(deps)));
  await replaceLineas();

  await jornada.update({
    estado: result.estado,
    fkid_notificacion: result.cancelarSolicitud ? null : jornada.fkid_notificacion,
  });

  if (result.statusCode === 409) {
    result.message = 'La carga cambió. La solicitud al Call Center se canceló; vuelve a pedir validación.';
  }
  return result;
}

async function solicitarValidacion(deps = {}) {
  const jornada = await loadJornada(deps, { findOrCreate: true });
  if (!jornada) fail(404, 'Jornada no encontrada');
  const crearNotificacion = deps.crearNotificacion || ((payload) => defaultCrearNotificacion(deps, payload));
  const notificacion = await crearNotificacion({
    nombre: 'Validar carga del repartidor',
    prioridad: 'alta',
    datos: {
      tipo: 'check_in',
      estado_solicitud: 'abierta',
      repartidor_id: jornada.fkid_repartidor || deps.repartidorId,
      jornada_id: jornada.id,
    },
  });
  await jornada.update({
    estado: 'esperando_call_center',
    fkid_notificacion: notificacion.id,
  });
  return { id: notificacion.id, notificacion_id: notificacion.id, jornada_id: jornada.id };
}

async function leerSolicitud(deps = {}) {
  let notificacion = deps.notificacion;
  if (!notificacion) {
    const db = getModels(deps);
    notificacion = await db.Notificacion.findByPk(deps.notificacionId);
  }
  if (!notificacion) fail(404, 'Solicitud no encontrada');

  const datos = notificacion.datos || {};
  if (deps.repartidorId != null) {
    const ownerId = datos.repartidor_id;
    if (ownerId == null || Number(ownerId) !== Number(deps.repartidorId)) {
      fail(403, 'Solicitud no encontrada');
    }
  }
  let jornada = deps.jornada;
  if (!jornada) {
    const db = getModels(deps);
    jornada = await db.JornadaRepartidor.findOne({
      where: { fkid_notificacion: notificacion.id },
    });
    if (!jornada && datos.jornada_id) {
      jornada = await db.JornadaRepartidor.findByPk(datos.jornada_id);
    }
  }
  if (jornada && deps.repartidorId && jornada.fkid_repartidor && jornada.fkid_repartidor !== deps.repartidorId) {
    fail(403, 'Solicitud no encontrada');
  }

  const atendida = Boolean(notificacion.leida && datos.estado_solicitud !== 'cancelada');
  const vigente = Boolean(jornada && notificacion.id === jornada.fkid_notificacion);
  if (
    jornada
    && checkInOpens({
      leida: notificacion.leida,
      vigente,
      estadoSolicitud: datos.estado_solicitud,
    })
    && vigente
  ) {
    await jornada.update({ estado: 'validada' });
  }
  return { atendida };
}

async function obtenerJornada(deps = {}) {
  const jornada = await loadJornada(deps, { findOrCreate: false });
  if (!jornada) return { estado: 'borrador', cargas: [] };
  const raw = plain(jornada);
  return {
    id: raw.id,
    fecha: raw.fecha,
    estado: raw.estado,
    fkid_notificacion: raw.fkid_notificacion,
    efectivo_a_depositar: raw.efectivo_a_depositar,
    comprobante_deposito_path: raw.comprobante_deposito_path,
    cerrada_en: raw.cerrada_en,
    cargas: (raw.cargas || []).map((c) => ({
      id: c.id,
      nombre: c.nombre,
      fkid_producto: c.fkid_producto,
      cantidad: c.cantidad,
      precio_unitario: c.precio_unitario,
      es_extra: c.es_extra,
    })),
  };
}

function pedidoInclude(db, { withCode = false } = {}) {
  return {
    model: db.Pedido,
    as: 'pedido',
    attributes: withCode ? undefined : { exclude: ['codigo_entrega'] },
    include: [
      { model: db.Cliente, as: 'cliente', attributes: ['id', 'nombre_completo'] },
      {
        model: db.ProductoPedido,
        as: 'productos',
        required: false,
        where: { baja_logica: false },
        include: [{ model: db.Inventario, as: 'producto', attributes: ['id', 'nombre'] }],
      },
    ],
  };
}

async function assertRutaDelRepartidor(deps = {}, { withCode = false } = {}) {
  if (deps.rutaPedido) {
    const owner = deps.rutaPedido.ruta?.fkid_repartidor;
    if (owner != null && owner !== deps.repartidorId) {
      fail(403, 'Pedido no encontrado en tu ruta');
    }
    return deps.rutaPedido;
  }
  const db = getModels(deps);
  const rutaPedido = await db.RutaPedido.findOne({
    where: { fkid_pedido: deps.pedidoId },
    include: [
      {
        model: db.Ruta,
        as: 'ruta',
        required: true,
        where: { fkid_repartidor: deps.repartidorId },
      },
      pedidoInclude(db, { withCode }),
    ],
  });
  if (!rutaPedido) fail(403, 'Pedido no encontrado en tu ruta');
  return rutaPedido;
}

async function requireJornadaAbierta(deps) {
  const jornada = await loadJornada(deps, { findOrCreate: false });
  if (!jornada || !canListOrders(jornada.estado)) {
    fail(403, 'Falta la validación del Call Center');
  }
  return jornada;
}

async function listarPedidos(deps = {}) {
  await requireJornadaAbierta(deps);
  const db = getModels(deps);
  const rutas = await db.Ruta.findAll({
    where: {
      fkid_repartidor: deps.repartidorId,
      fecha_ruta: deps.fecha,
      estado: { [Op.ne]: 'cancelada' },
    },
    include: [
      {
        model: db.RutaPedido,
        as: 'pedidos',
        include: [pedidoInclude(db, { withCode: false })],
      },
    ],
    order: [[{ model: db.RutaPedido, as: 'pedidos' }, 'orden_entrega', 'ASC']],
  });
  const pedidos = [];
  for (const ruta of rutas) {
    for (const rp of ruta.pedidos || []) {
      if (!rp.pedido) continue;
      pedidos.push(toPedidoDto(rp.pedido, rp));
    }
  }
  return pedidos;
}

async function detallePedido(deps = {}) {
  await requireJornadaAbierta(deps);
  const rutaPedido = await assertRutaDelRepartidor(deps);
  return toPedidoDto(rutaPedido.pedido, rutaPedido);
}

async function llegada(deps = {}) {
  await requireJornadaAbierta(deps);
  const rutaPedido = await assertRutaDelRepartidor(deps);
  await rutaPedido.update({
    llego_en: new Date(),
    estado_entrega: 'en_camino',
  });
  return toPedidoDto(rutaPedido.pedido, rutaPedido);
}

async function validarCodigo(deps = {}) {
  await requireJornadaAbierta(deps);
  const rutaPedido = await assertRutaDelRepartidor(deps, { withCode: true });
  if (!rutaPedido.llego_en) fail(422, 'Registra la llegada antes de validar el código');
  const pedido = rutaPedido.pedido;
  if (!codesMatch(pedido?.codigo_entrega, deps.codigo)) {
    fail(422, 'Código incorrecto, pide al cliente que lo revise');
  }
  await rutaPedido.update({ codigo_validado_en: new Date() });
  return { valido: true };
}

async function cantidadesEntregadasHoy(deps, excludePedidoId) {
  const db = getModels(deps);
  const rutas = await db.Ruta.findAll({
    where: { fkid_repartidor: deps.repartidorId, fecha_ruta: deps.fecha },
    attributes: ['id'],
  });
  const rutaIds = rutas.map((r) => r.id);
  if (!rutaIds.length) return [];
  const entregados = await db.RutaPedido.findAll({
    where: { fkid_ruta: { [Op.in]: rutaIds } },
    include: [
      {
        model: db.Pedido,
        as: 'pedido',
        required: true,
        where: { estado: 'entregado' },
        include: [
          {
            model: db.ProductoPedido,
            as: 'productos',
            required: false,
            where: { baja_logica: false },
            include: [{ model: db.Inventario, as: 'producto', attributes: ['id', 'nombre'] }],
          },
        ],
      },
    ],
  });
  const byName = new Map();
  for (const rp of entregados) {
    if (excludePedidoId && rp.fkid_pedido === Number(excludePedidoId)) continue;
    for (const prod of rp.pedido.productos || []) {
      const nombre = prod.producto?.nombre;
      if (!nombre) continue;
      byName.set(nombre, (byName.get(nombre) || 0) + (Number(prod.cantidad) || 0));
    }
  }
  return [...byName.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad }));
}

async function resolveItem(item, db) {
  let inv = null;
  if (item.fkid_producto) {
    inv = await db.Inventario.findByPk(item.fkid_producto);
  } else if (item.nombre) {
    inv = await db.Inventario.findOne({ where: { nombre: item.nombre } });
  }
  if (!inv) fail(422, 'Producto extra sin inventario');
  return {
    fkid_producto: inv.id,
    nombre: inv.nombre,
    cantidad: Number(item.cantidad) || 0,
    precio_unidad: Number(item.precio_unidad ?? item.precio_unitario ?? inv.precio_venta) || 0,
  };
}

async function ajustarProductos(deps = {}) {
  await requireJornadaAbierta(deps);
  const rutaPedido = await assertRutaDelRepartidor(deps);
  if (!rutaPedido.codigo_validado_en) fail(422, 'Valida el código antes de ajustar productos');
  const jornada = await loadJornada(deps, { findOrCreate: false });
  const db = getModels(deps);
  const rawItems = deps.items || deps.productos || deps.lineas || [];
  const items = [];
  for (const item of rawItems) {
    items.push(await resolveItem(item, db));
  }
  const entregado = await cantidadesEntregadasHoy(deps, deps.pedidoId);
  const stock = validateStock({
    carga: (jornada.cargas || []).map((c) => ({ nombre: c.nombre, cantidad: c.cantidad })),
    entregado,
    items,
  });
  if (!stock.ok) fail(422, stock.message);

  const pedido = rutaPedido.pedido;
  for (const item of items) {
    if (item.cantidad < 1) fail(422, 'La cantidad debe ser al menos 1');
  }

  const lineasPedido = await db.ProductoPedido.findAll({
    where: { fkid_pedido: pedido.id },
  });
  const listedIds = new Set(items.map((item) => Number(item.fkid_producto)));

  for (const item of items) {
    const existing = lineasPedido.find(
      (row) => Number(row.fkid_producto) === Number(item.fkid_producto)
    );
    const precio_total = item.cantidad * item.precio_unidad;
    if (existing) {
      await existing.update({
        cantidad: item.cantidad,
        precio_unidad: item.precio_unidad,
        precio_total,
        baja_logica: false,
      });
    } else {
      await db.ProductoPedido.create({
        fkid_pedido: pedido.id,
        fkid_producto: item.fkid_producto,
        cantidad: item.cantidad,
        precio_unidad: item.precio_unidad,
        precio_total,
        baja_logica: false,
      });
    }
  }

  for (const row of lineasPedido) {
    if (!listedIds.has(Number(row.fkid_producto)) && !row.baja_logica) {
      await row.update({ baja_logica: true });
    }
  }

  const productos = await db.ProductoPedido.findAll({
    where: { fkid_pedido: pedido.id, baja_logica: false },
  });
  const total = productos.reduce((sum, p) => sum + Number(p.precio_total), 0);
  await pedido.update({ total, subtotal: total });
  await pedido.reload({
    include: [
      { model: db.Cliente, as: 'cliente', attributes: ['id', 'nombre_completo'] },
      {
        model: db.ProductoPedido,
        as: 'productos',
        required: false,
        where: { baja_logica: false },
        include: [{ model: db.Inventario, as: 'producto', attributes: ['id', 'nombre'] }],
      },
    ],
  });
  return toPedidoDto(pedido, rutaPedido);
}

async function loadEntregas(deps) {
  const db = getModels(deps);
  return db.Pedido.findAll({
    where: { estado: 'entregado' },
    attributes: ['id', 'estado', 'fecha_entrega_real'],
    include: [
      {
        model: db.RutaPedido,
        as: 'rutas',
        required: true,
        include: [
          {
            model: db.Ruta,
            as: 'ruta',
            required: true,
            where: { fkid_repartidor: deps.repartidorId },
            attributes: ['id', 'fkid_repartidor'],
          },
        ],
      },
    ],
  });
}

function dayOfEntrega(pedido, timeZone) {
  const when = pedido.fecha_entrega_real || pedido.updated_at || new Date();
  return dayKey(new Date(when), timeZone);
}

async function logroStats(deps, timeZone, saldo) {
  const entregas = await loadEntregas(deps);
  const hoy = deps.fecha || dayKey(new Date(), timeZone);
  const days = entregas.map((p) => dayOfEntrega(p, timeZone));
  const daySet = new Set(days);
  let rachaDias = 0;
  let cursor = hoy;
  while (daySet.has(cursor)) {
    rachaDias += 1;
    cursor = addCalendarDays(cursor, -1);
  }
  return {
    totalEntregas: entregas.length,
    entregasHoy: days.filter((d) => d === hoy).length,
    saldo,
    rachaDias,
  };
}

function comprobantePath(file) {
  if (!file) return null;
  return `comprobantes/${file.filename}`;
}

function isUniqueConstraint(err) {
  return err?.name === 'SequelizeUniqueConstraintError'
    || err?.original?.code === 'ER_DUP_ENTRY'
    || err?.parent?.code === 'ER_DUP_ENTRY';
}

async function loadPedidoDto(db, pedido, rutaPedido) {
  if (rutaPedido && typeof rutaPedido.reload === 'function') {
    await rutaPedido.reload();
  }
  const fresh = await db.Pedido.findByPk(pedido.id, {
    attributes: { exclude: ['codigo_entrega'] },
    include: [
      { model: db.Cliente, as: 'cliente', attributes: ['id', 'nombre_completo'] },
      {
        model: db.ProductoPedido,
        as: 'productos',
        required: false,
        where: { baja_logica: false },
        include: [{ model: db.Inventario, as: 'producto', attributes: ['id', 'nombre'] }],
      },
    ],
  });
  return toPedidoDto(fresh, rutaPedido);
}

async function entregar(deps = {}) {
  await requireJornadaAbierta(deps);
  const rutaPedido = await assertRutaDelRepartidor(deps);
  const pedido = rutaPedido.pedido;
  if (['entregado', 'no_entregado'].includes(pedido.estado)) {
    fail(409, 'El pedido ya fue cerrado');
  }
  if (!rutaPedido.codigo_validado_en) fail(422, 'Valida el código antes de entregar');

  const metodo = deps.metodo;
  const efectivo = Number(deps.monto_efectivo ?? deps.efectivo) || 0;
  const transferencia = Number(deps.monto_transferencia ?? deps.transferencia) || 0;
  const hasPhoto = Boolean(deps.file || deps.hasPhoto);
  const payment = validatePayment({
    metodo,
    total: pedido.total,
    efectivo,
    transferencia,
    hasPhoto,
  });
  if (!payment.ok) fail(422, payment.message);

  const db = getModels(deps);
  const sequelize = db.sequelize;
  const now = new Date();
  let alreadyRecorded = false;
  let saldo;

  try {
    await sequelize.transaction(async (t) => {
      await db.CobroEntrega.create({
        fkid_pedido: pedido.id,
        fkid_repartidor: deps.repartidorId,
        metodo,
        monto_efectivo: efectivo,
        monto_transferencia: transferencia,
        comprobante_path: comprobantePath(deps.file),
      }, { transaction: t });

      await rutaPedido.update({
        estado_entrega: 'entregado',
        fecha_entrega_real: now,
      }, { transaction: t });
      await pedido.update({ estado: 'entregado', fecha_entrega_real: now }, { transaction: t });

      const last = await db.RepartidorPuntosMovimiento.findOne({
        where: { fkid_repartidor: deps.repartidorId },
        order: [['created_at', 'DESC'], ['id', 'DESC']],
        transaction: t,
      });
      const next = nextPoints(last ? last.saldo_posterior : 0);
      saldo = next.saldo;
      await db.RepartidorPuntosMovimiento.create({
        fkid_repartidor: deps.repartidorId,
        puntos: next.puntos,
        saldo_posterior: next.saldo,
        fkid_pedido: pedido.id,
      }, { transaction: t });
    });
  } catch (err) {
    if (!isUniqueConstraint(err)) throw err;
    alreadyRecorded = true;
  }

  if (alreadyRecorded) {
    return loadPedidoDto(db, pedido, rutaPedido);
  }

  const timeZone = deps.timezone || deps.repartidor?.ciudad?.timezone;
  const stats = await logroStats(deps, timeZone, saldo);
  const unlocked = evaluateLogros(stats);
  for (const codigo of unlocked) {
    await db.RepartidorLogro.findOrCreate({
      where: { fkid_repartidor: deps.repartidorId, codigo },
      defaults: { desbloqueado_en: now },
    });
  }

  return loadPedidoDto(db, pedido, rutaPedido);
}

function esLlamadaClienteAtendida(n, pedidoId) {
  const d = n.datos || {};
  return (
    d.tipo === 'llamada_cliente'
    && Number(d.pedido_id) === Number(pedidoId)
    && d.estado_solicitud === 'abierta'
    && n.leida === true
  );
}

function whereDatosRepartidor(repartidorId) {
  if (repartidorId == null) return {};
  const id = Number(repartidorId);
  if (!Number.isFinite(id)) return { id: null };
  return {
    [Op.and]: [
      Sequelize.where(
        Sequelize.literal("JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.repartidor_id'))"),
        String(id)
      ),
    ],
  };
}

async function findLlamadaClienteAtendida(deps) {
  if (deps.notificaciones) {
    return deps.notificaciones.find((n) => esLlamadaClienteAtendida(n, deps.pedidoId));
  }
  const db = getModels(deps);
  const rows = await db.Notificacion.findAll({
    where: {
      leida: true,
      ...whereDatosRepartidor(deps.repartidorId),
    },
    order: [['id', 'DESC']],
  });
  return rows.find((n) => esLlamadaClienteAtendida(n, deps.pedidoId));
}

async function noEntregar(deps = {}) {
  await requireJornadaAbierta(deps);
  const llamada = await findLlamadaClienteAtendida(deps);
  if (!llamada) fail(403, 'Falta la atención de la llamada al cliente');

  const rutaPedido = await assertRutaDelRepartidor(deps);
  const pedido = rutaPedido.pedido;
  if (['entregado', 'no_entregado'].includes(pedido.estado)) {
    fail(409, 'El pedido ya fue cerrado');
  }
  const now = new Date();
  await rutaPedido.update({
    estado_entrega: 'fallido',
    fecha_entrega_real: now,
  });
  await pedido.update({ estado: 'no_entregado' });
  return toPedidoDto(pedido, rutaPedido);
}

async function registrarCaja(deps = {}) {
  const jornada = await loadJornada(deps, { findOrCreate: false });
  if (!jornada || !canListOrders(jornada.estado)) {
    fail(403, 'Falta la validación del Call Center');
  }
  if (!deps.file) fail(422, 'La caja requiere foto del comprobante');
  await jornada.update({
    efectivo_a_depositar: Number(deps.efectivo) || 0,
    comprobante_deposito_path: comprobantePath(deps.file),
    cerrada_en: new Date(),
    estado: 'cerrada',
  });
  return obtenerJornada({ ...deps, jornada });
}

async function crearSoporte(deps = {}) {
  const motivo = deps.motivo;
  const esLlamada = motivo === 'llamada';
  const crearNotificacion = deps.crearNotificacion || ((payload) => defaultCrearNotificacion(deps, payload));
  const notificacion = await crearNotificacion({
    nombre: esLlamada ? 'Llamada al cliente' : 'Soporte del repartidor',
    prioridad: esLlamada ? 'alta' : 'media',
    datos: {
      tipo: esLlamada ? 'llamada_cliente' : 'soporte',
      estado_solicitud: 'abierta',
      repartidor_id: deps.repartidorId,
      ...(deps.pedidoId ? { pedido_id: Number(deps.pedidoId) } : {}),
      motivo,
    },
  });
  return { id: notificacion.id, notificacion_id: notificacion.id };
}

async function loadRepartidor(deps) {
  if (deps.repartidor && (deps.repartidor.ciudad || deps.timezone)) return deps.repartidor;
  const db = getModels(deps);
  return db.Repartidor.findByPk(deps.repartidorId, {
    attributes: { exclude: ['contrasena'] },
    include: [{ model: db.City, as: 'ciudad' }],
  });
}

async function ultimoSaldo(deps) {
  const db = getModels(deps);
  const last = await db.RepartidorPuntosMovimiento.findOne({
    where: { fkid_repartidor: deps.repartidorId },
    order: [['created_at', 'DESC'], ['id', 'DESC']],
  });
  return last ? Number(last.saldo_posterior) : 0;
}

async function efectivoHoy(deps, timeZone) {
  const db = getModels(deps);
  const cobros = await db.CobroEntrega.findAll({
    where: { fkid_repartidor: deps.repartidorId },
    include: [{ model: db.Pedido, as: 'pedido', required: true }],
  });
  const hoy = deps.fecha || dayKey(new Date(), timeZone);
  return cobros.reduce((sum, c) => {
    const when = c.pedido?.fecha_entrega_real || c.created_at;
    if (!when) return sum;
    if (dayKey(new Date(when), timeZone) !== hoy) return sum;
    return sum + (Number(c.monto_efectivo) || 0);
  }, 0);
}

async function perfil(deps = {}) {
  const repartidor = await loadRepartidor(deps);
  const timeZone = deps.timezone || repartidor?.ciudad?.timezone;
  const fecha = deps.fecha || dayKey(new Date(), timeZone);
  const jornada = await loadJornada({ ...deps, fecha }, { findOrCreate: false });
  const puntos = await ultimoSaldo(deps);
  const stats = await logroStats({ ...deps, fecha }, timeZone, puntos);
  const efectivo = await efectivoHoy({ ...deps, fecha }, timeZone);
  const ciudad = repartidor?.ciudad ? plain(repartidor.ciudad) : null;
  return {
    id: repartidor.id,
    nombre: repartidor.nombre_completo,
    entregas_hoy: stats.entregasHoy,
    efectivo_hoy: efectivo,
    puntos,
    jornada: jornada
      ? { id: jornada.id, estado: jornada.estado, fecha: jornada.fecha }
      : { estado: 'borrador', fecha },
    ciudad: ciudad
      ? {
        id: ciudad.id,
        nombre: ciudad.nombre,
        telefono: ciudad.telefono,
        numero_soporte_cliente: ciudad.numero_soporte_cliente,
        timezone: ciudad.timezone,
      }
      : null,
  };
}

async function estadisticas(deps = {}) {
  const repartidor = await loadRepartidor(deps);
  const timeZone = deps.timezone || repartidor?.ciudad?.timezone;
  const hoy = deps.fecha || dayKey(new Date(), timeZone);
  const puntos = await ultimoSaldo(deps);
  const entregas = await loadEntregas(deps);
  const days = entregas.map((p) => dayOfEntrega(p, timeZone));
  const weekStart = mondayOf(hoy);
  const weekEnd = addCalendarDays(weekStart, 6);
  const monthPrefix = hoy.slice(0, 7);
  return {
    hoy: days.filter((d) => d === hoy).length,
    semana: days.filter((d) => d >= weekStart && d <= weekEnd).length,
    mes: days.filter((d) => d.startsWith(monthPrefix)).length,
    puntos,
    meta: META_DIARIA,
  };
}

async function logros(deps = {}) {
  const db = getModels(deps);
  const rows = await db.RepartidorLogro.findAll({
    where: { fkid_repartidor: deps.repartidorId },
  });
  const byCode = new Map(rows.map((r) => [r.codigo, r.desbloqueado_en]));
  return emptyLogros().map((slot) => ({
    codigo: slot.codigo,
    desbloqueado_en: byCode.get(slot.codigo) || null,
  }));
}

module.exports = {
  replaceCarga,
  solicitarValidacion,
  leerSolicitud,
  obtenerJornada,
  assertRutaDelRepartidor,
  llegada,
  validarCodigo,
  ajustarProductos,
  entregar,
  noEntregar,
  registrarCaja,
  crearSoporte,
  listarPedidos,
  detallePedido,
  perfil,
  estadisticas,
  logros,
  toPedidoDto,
};
