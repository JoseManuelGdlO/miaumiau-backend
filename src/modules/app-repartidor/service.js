const fs = require('fs');
const path = require('path');
const { Op, Sequelize } = require('sequelize');
const {
  checkInOpens,
  canListOrders,
  ayudaCodigoVencida,
  codesMatch,
  packageCodeComponents,
  validatePayment,
  validateStock,
  nextPoints,
  evaluateLogros,
  emptyLogros,
  stripPhone,
  dayKey,
  agruparCarga,
  avisaReagendo,
  urlFoto,
  META_DIARIA,
} = require('./domain');
const { noticeFromNombre, validacionCargaPath } = require('../notificaciones/checkInNotice');
const { telefonoDeRepartidor, phoneOf, comprobantePublicPath } = require('../call-center/domain');
const { publishNotificacion } = require('../notificaciones/stream');
const { ensureDeliveryCode } = require('./assignCode');
const { sendWhatsAppTemplate, WHATSAPP_TEMPLATE_LANGUAGE } = require('../../utils/whatsapp');
const { formatPhoneForWhatsApp } = require('../../services/whatsappWindowService');
const { reemplazarSaldo, descontarEntrega, anotarAjuste } = require('./inventario-vehiculo');
const { nearestNeighbor, distanceMatrix, ordenSinPisarManual } = require('./route-order');
const jornadaPaquetes = require('./jornada-paquetes');
const { avisarSiguiente, minutosEntre, abierto } = require('./aviso-siguiente');
const { soltarParadasAbiertas } = require('../pedidos/reencolar');
const { Logger } = require('../../utils/logger');
const { repartoBloqueado } = require('./deposito-pendiente');

const log = new Logger('AppRepartidor');
const PACKAGE_CODE_TEMPLATE_NAME = 'codigo_paquete';
const DEFAULT_WHATSAPP_PHONE_NUMBER_ID = '986416624552272';
const PACKAGE_CODE_SEND_ERROR = 'No se pudo enviar el código al cliente. Intenta de nuevo.';

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function getModels(deps = {}) {
  return deps.models || require('../../models');
}

function moneyOf(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function plain(row) {
  if (!row) return row;
  return typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
}

function franjaDe(value) {
  return value === 'tarde' ? 'tarde' : 'manana';
}

function toPedidoDto(pedido, rutaPedido) {
  const raw = plain(pedido) || {};
  const llamada = phoneOf(raw);
  const {
    codigo_entrega,
    telefono,
    telefono_referencia,
    ...rest
  } = raw;
  rest.cliente = stripPhone(rest.cliente);
  if (llamada) rest.telefono_llamada = llamada;
  if (rutaPedido) {
    const rp = plain(rutaPedido);
    rest.llego_en = rp.llego_en;
    rest.codigo_validado_en = rp.codigo_validado_en;
    rest.estado_entrega = rp.estado_entrega;
    rest.orden_entrega = rp.orden_entrega;
    rest.lat = rp.lat;
    rest.lng = rp.lng;
    rest.link_ubicacion = rp.link_ubicacion;
    rest.franja = franjaDe(rp.franja);
    rest.entrega_tercero = Boolean(rp.entrega_tercero_en);
    rest.entrega_dejar = Boolean(rp.entrega_dejar_en);
    const minutos = Number(rp.tiempo_estimado_entrega);
    if (minutos > 0) rest.minutos_transporte = minutos;
  }
  const cobro = raw.cobro_entrega || raw.cobroEntrega;
  if (cobro?.comprobante_path) {
    rest.pagado = true;
    rest.comprobante_url = comprobantePublicPath(cobro.comprobante_path);
  }
  return rest;
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

async function nombreDelRepartidor(deps) {
  const direct = deps.repartidor?.nombre_completo;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const db = getModels(deps);
  if (!db.Repartidor?.findByPk || deps.repartidorId == null) return null;
  const row = await db.Repartidor.findByPk(deps.repartidorId, {
    attributes: ['id', 'nombre_completo'],
  });
  const nombre = row?.nombre_completo;
  return typeof nombre === 'string' && nombre.trim() ? nombre.trim() : null;
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

function resumirRutas(rutas) {
  const raw = [];
  let cents = 0;
  for (const ruta of rutas || []) {
    if (ruta.estado === 'cancelada') continue;
    for (const rp of ruta.pedidos || []) {
      const pedido = rp.pedido;
      if (!pedido || pedido.estado === 'cancelado' || pedido.baja_logica) continue;
      cents += Math.round((Number(pedido.total) || 0) * 100);
      for (const prod of pedido.productos || []) {
        if (prod.baja_logica) continue;
        const nombre = prod.producto?.nombre || '';
        const fkid = prod.fkid_producto ?? prod.producto?.id ?? null;
        if (!nombre && fkid == null) continue;
        raw.push({
          fkid_producto: fkid,
          nombre,
          cantidad: Number(prod.cantidad) || 0,
          precio_unitario: prod.precio_unidad != null
            ? Number(prod.precio_unidad)
            : Number(prod.producto?.precio_venta) || 0,
        });
      }
      const paradaExtra = String(pedido.numero_pedido || '').startsWith('EXTRA-');
      if (!paradaExtra) for (const pp of pedido.paquetes || []) {
        const factor = Number(pp.cantidad) || 0;
        for (const item of pp.paquete?.productos || []) {
          const nombre = item.producto?.nombre || '';
          const fkid = item.fkid_producto ?? item.producto?.id ?? null;
          if (!nombre && fkid == null) continue;
          raw.push({
            fkid_producto: fkid,
            nombre,
            cantidad: (Number(item.cantidad) || 0) * factor,
            precio_unitario: Number(item.producto?.precio_venta) || 0,
          });
        }
      }
    }
  }
  return { lineas: agruparCarga(raw), dinero_esperado: cents / 100 };
}

async function calcularCargaDelDia(deps = {}) {
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
        required: false,
        include: [
          {
            model: db.Pedido,
            as: 'pedido',
            required: true,
            where: { estado: { [Op.ne]: 'cancelado' } },
            include: [
              {
                model: db.ProductoPedido,
                as: 'productos',
                required: false,
                where: { baja_logica: false },
                include: [{ model: db.Inventario, as: 'producto', attributes: ['id', 'nombre', 'precio_venta'] }],
              },
              {
                model: db.PaquetePedido,
                as: 'paquetes',
                required: false,
                include: [
                  {
                    model: db.Paquete,
                    as: 'paquete',
                    include: [
                      {
                        model: db.ProductoPaquete,
                        as: 'productos',
                        include: [{ model: db.Inventario, as: 'producto', attributes: ['id', 'nombre', 'precio_venta'] }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  return resumirRutas(rutas);
}

function resumenDesdeRutas(rutas) {
  const pedidos = [];
  for (const ruta of rutas || []) {
    if (ruta.estado === 'cancelada') continue;
    for (const rp of ruta.pedidos || []) {
      const pedido = rp.pedido;
      if (!pedido || pedido.estado === 'cancelado' || pedido.baja_logica) continue;
      const productos = [];
      for (const prod of pedido.productos || []) {
        if (prod.baja_logica) continue;
        const nombre = prod.producto?.nombre || prod.nombre;
        if (!nombre) continue;
        productos.push({ nombre, cantidad: Number(prod.cantidad) || 0 });
      }
      pedidos.push({
        id: pedido.id ?? null,
        numero_pedido: pedido.numero_pedido || (pedido.id != null ? String(pedido.id) : ''),
        cliente: pedido.cliente?.nombre_completo || '',
        direccion: pedido.direccion_entrega || '',
        productos,
      });
    }
  }
  return pedidos;
}

async function resumenPedidosDelDia(deps = {}) {
  const db = getModels(deps);
  if (typeof db.Ruta?.findAll !== 'function') return [];
  const rutas = await db.Ruta.findAll({
    where: {
      fkid_repartidor: deps.repartidorId,
      fecha_ruta: deps.fecha,
      estado: { [Op.ne]: 'cancelada' },
    },
    include: [{
      model: db.RutaPedido,
      as: 'pedidos',
      required: false,
      include: [{
        model: db.Pedido,
        as: 'pedido',
        required: false,
        include: [
          { model: db.Cliente, as: 'cliente', attributes: ['id', 'nombre_completo'], required: false },
          {
            model: db.ProductoPedido,
            as: 'productos',
            required: false,
            include: [{ model: db.Inventario, as: 'producto', attributes: ['id', 'nombre'] }],
          },
        ],
      }],
    }],
  });
  return resumenDesdeRutas(rutas);
}

async function replaceCarga() {
  fail(403, 'La carga la calcula el sistema');
}

async function solicitarValidacion(deps = {}) {
  const calculo = await calcularCargaDelDia(deps);
  if (!calculo.lineas.length) fail(422, 'No hay productos en la ruta de hoy');
  const jornada = await loadJornada(deps, { findOrCreate: true });
  if (!jornada) fail(404, 'Jornada no encontrada');
  const extras = lineasExtra(jornada);
  const db = getModels(deps);
  await db.JornadaCarga.destroy({ where: { fkid_jornada: jornada.id } });
  await db.JornadaCarga.bulkCreate([
    ...calculo.lineas.map((l) => ({
      fkid_jornada: jornada.id,
      nombre: l.nombre,
      fkid_producto: l.fkid_producto ?? null,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      es_extra: false,
    })),
    ...extras,
  ]);
  const crearNotificacion = deps.crearNotificacion || ((payload) => defaultCrearNotificacion(deps, payload));
  const aviso = noticeFromNombre(await nombreDelRepartidor(deps));
  const datos = {
    tipo: 'check_in',
    estado_solicitud: 'abierta',
    espera_reenvio: false,
    repartidor_id: jornada.fkid_repartidor || deps.repartidorId,
    jornada_id: jornada.id,
    ...(aviso.repartidor_nombre ? { repartidor_nombre: aviso.repartidor_nombre } : {}),
  };
  const vigente = await notificacionDeCheckIn(deps, jornada);
  let notificacion = vigente;
  if (notificacion) {
    const nextDatos = {
      ...(notificacion.datos || {}),
      ...datos,
      espera_reenvio: false,
      actionUrl: validacionCargaPath(notificacion.id),
    };
    if (typeof notificacion.update === 'function') {
      await notificacion.update({ leida: false, datos: nextDatos });
    } else {
      notificacion.leida = false;
      notificacion.datos = nextDatos;
    }
  } else {
    notificacion = await crearNotificacion({
      nombre: aviso.nombre,
      descripcion: aviso.descripcion,
      prioridad: 'alta',
      datos,
    });
    if (typeof notificacion.update === 'function') {
      await notificacion.update({
        datos: { ...datos, actionUrl: validacionCargaPath(notificacion.id) },
      });
    }
  }
  publishNotificacion(notificacion);
  const dinero = dineroConExtras(calculo.dinero_esperado, extras);
  await jornada.update({
    estado: 'esperando_call_center',
    fkid_notificacion: notificacion.id,
    dinero_esperado: dinero,
    valor_carga: dinero,
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
    await jornada.update({
      estado: 'validada',
      valor_carga: Number(jornada.dinero_esperado) || Number(jornada.valor_carga) || 0,
    });
    void ordenarParadasSiAplica({ ...deps, repartidorId: jornada.fkid_repartidor || deps.repartidorId });
  }
  return {
    atendida,
    reenvio: Boolean(!atendida && (datos.estado_solicitud === 'cancelada' || datos.espera_reenvio)),
    espera_desde: datos.espera_desde || null,
  };
}

async function notificacionDeCheckIn(deps, jornada) {
  if (!jornada?.fkid_notificacion) return null;
  const db = getModels(deps);
  if (typeof db.Notificacion?.findByPk !== 'function') return null;
  const row = await db.Notificacion.findByPk(jornada.fkid_notificacion);
  const datos = row?.datos || {};
  if (!row || datos.tipo !== 'check_in' || row.leida || datos.estado_solicitud === 'cancelada') return null;
  return row;
}

function cargaDto(c) {
  return {
    id: c.id,
    nombre: c.nombre,
    fkid_producto: c.fkid_producto,
    cantidad: c.cantidad,
    precio_unitario: c.precio_unitario,
    es_extra: Boolean(c.es_extra),
  };
}

function lineasExtra(jornada) {
  return (jornada?.cargas || [])
    .filter((c) => c && c.es_extra)
    .map((c) => ({
      fkid_jornada: jornada.id,
      nombre: c.nombre,
      fkid_producto: c.fkid_producto ?? null,
      cantidad: Number(c.cantidad) || 0,
      precio_unitario: Number(c.precio_unitario) || 0,
      es_extra: true,
    }))
    .filter((c) => c.nombre && c.cantidad >= 1);
}

function dineroConExtras(base, extras) {
  const extraCents = (extras || []).reduce((sum, line) => {
    return sum + Math.round((Number(line.precio_unitario) || 0) * (Number(line.cantidad) || 0) * 100);
  }, 0);
  return (Math.round((Number(base) || 0) * 100) + extraCents) / 100;
}

function fechaDeRuta(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

async function refrescarCargaEnValidacion(deps = {}) {
  const repartidorId = deps.repartidorId;
  const fecha = fechaDeRuta(deps.fecha);
  if (repartidorId == null || repartidorId === '' || !fecha) return false;
  const db = getModels(deps);
  let jornada = deps.jornada;
  if (!jornada) {
    if (typeof db.JornadaRepartidor?.findOne !== 'function') return false;
    jornada = await db.JornadaRepartidor.findOne({
      where: { fkid_repartidor: repartidorId, fecha },
      include: [{ model: db.JornadaCarga, as: 'cargas' }],
    });
  }
  if (!jornada || jornada.estado !== 'esperando_call_center') return false;
  const calculo = await calcularCargaDelDia({ ...deps, repartidorId, fecha });
  const extras = lineasExtra(jornada);
  await db.JornadaCarga.destroy({ where: { fkid_jornada: jornada.id, es_extra: false } });
  const routeLines = calculo.lineas.map((l) => ({
    fkid_jornada: jornada.id,
    nombre: l.nombre,
    fkid_producto: l.fkid_producto ?? null,
    cantidad: l.cantidad,
    precio_unitario: l.precio_unitario,
    es_extra: false,
  }));
  if (routeLines.length) await db.JornadaCarga.bulkCreate(routeLines);
  const dinero_esperado = dineroConExtras(calculo.dinero_esperado, extras);
  if (typeof jornada.update === 'function') await jornada.update({ dinero_esperado });
  else jornada.dinero_esperado = dinero_esperado;
  return true;
}

async function obtenerJornada(deps = {}) {
  const jornada = await loadJornada(deps, { findOrCreate: false });
  const pedidos = await resumenPedidosDelDia(deps);
  if (!jornada || jornada.estado === 'borrador') {
    const calculo = await calcularCargaDelDia(deps);
    const extras = lineasExtra(jornada).map(cargaDto);
    const base = {
      estado: 'borrador',
      dinero_esperado: dineroConExtras(calculo.dinero_esperado, extras),
      validado_por_nombre: null,
      cargas: [...calculo.lineas, ...extras],
      pedidos,
    };
    if (!jornada) return base;
    const raw = plain(jornada);
    return {
      ...base,
      id: raw.id,
      fecha: raw.fecha,
      fkid_notificacion: raw.fkid_notificacion,
      efectivo_a_depositar: raw.efectivo_a_depositar,
      efectivo_cobrado: moneyOf(raw.efectivo_cobrado),
      virtual_cobrado: moneyOf(raw.virtual_cobrado),
      valor_carga: moneyOf(raw.valor_carga),
      comprobante_deposito_path: raw.comprobante_deposito_path,
      cerrada_en: raw.cerrada_en,
    };
  }
  const raw = plain(jornada);
  return {
    id: raw.id,
    fecha: raw.fecha,
    estado: raw.estado,
    fkid_notificacion: raw.fkid_notificacion,
    efectivo_a_depositar: raw.efectivo_a_depositar,
    efectivo_cobrado: moneyOf(raw.efectivo_cobrado),
    virtual_cobrado: moneyOf(raw.virtual_cobrado),
    valor_carga: moneyOf(raw.valor_carga) || moneyOf(raw.dinero_esperado),
    comprobante_deposito_path: raw.comprobante_deposito_path,
    cerrada_en: raw.cerrada_en,
    dinero_esperado: raw.dinero_esperado == null ? 0 : Number(raw.dinero_esperado),
    validado_por_nombre: raw.validado_por_nombre || null,
    cargas: (raw.cargas || []).map(cargaDto),
    pedidos,
  };
}

async function buscarBodega(deps = {}) {
  const db = getModels(deps);
  const repartidor = await loadRepartidor(deps);
  const ciudadId = repartidor?.fkid_ciudad || repartidor?.ciudad?.id;
  const q = String(deps.q || '').trim();
  const where = { baja_logica: false };
  if (ciudadId) where.fkid_ciudad = ciudadId;
  if (q) where.nombre = { [Op.like]: `%${q.replace(/[\\%_]/g, '\\$&')}%` };
  const rows = await db.Inventario.findAll({
    where,
    attributes: ['id', 'nombre', 'precio_venta'],
    limit: 20,
    order: [['nombre', 'ASC']],
  });
  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    precio_venta: Number(row.precio_venta) || 0,
  }));
}

async function agregarExtra(deps = {}) {
  const cantidad = Number(deps.cantidad);
  if (!Number.isInteger(cantidad) || cantidad < 1) fail(422, 'La cantidad del extra no es válida');
  const jornada = await loadJornada(deps, { findOrCreate: true });
  if (!jornada) fail(404, 'Jornada no encontrada');
  if (jornada.estado && jornada.estado !== 'borrador') {
    fail(409, 'La carga ya no admite producto extra');
  }
  const db = getModels(deps);
  const repartidor = await loadRepartidor(deps);
  const ciudadId = repartidor?.fkid_ciudad || repartidor?.ciudad?.id;
  const where = { id: deps.fkid_producto, baja_logica: false };
  if (ciudadId) where.fkid_ciudad = ciudadId;
  const producto = await db.Inventario.findOne({ where });
  if (!producto || producto.baja_logica) fail(422, 'Ese producto no está en la bodega');
  const precio = Number(producto.precio_venta);
  if (!Number.isFinite(precio) || precio < 0) fail(422, 'El producto no tiene precio de venta');
  const extras = (jornada.cargas || []).filter(
    (line) => line && line.es_extra && Number(line.fkid_producto) === Number(producto.id)
  );
  if (extras[0] && typeof extras[0].update === 'function') {
    await extras[0].update({ cantidad: (Number(extras[0].cantidad) || 0) + cantidad });
  } else if (typeof db.JornadaCarga?.create === 'function') {
    const row = await db.JornadaCarga.create({
      fkid_jornada: jornada.id,
      nombre: producto.nombre,
      fkid_producto: producto.id,
      cantidad,
      precio_unitario: precio,
      es_extra: true,
    });
    jornada.cargas = [...(jornada.cargas || []), row];
  }
  return obtenerJornada({ ...deps, jornada });
}

function pedidoInclude(db, { withCode = false, withPhone = false } = {}) {
  const clienteAttributes = ['id', 'nombre_completo', 'lat', 'lng', 'direccion_geo', 'direccion_entrega'];
  if (withPhone) clienteAttributes.push('telefono');
  return {
    model: db.Pedido,
    as: 'pedido',
    attributes: withCode ? undefined : { exclude: ['codigo_entrega'] },
    include: [
      { model: db.Cliente, as: 'cliente', attributes: clienteAttributes },
      { model: db.City, as: 'ciudad', attributes: ['id', 'nombre', 'departamento'], required: false },
      {
        model: db.ProductoPedido,
        as: 'productos',
        required: false,
        where: { baja_logica: false },
        include: [{ model: db.Inventario, as: 'producto', attributes: ['id', 'nombre'] }],
      },
      ...(db.CobroEntrega ? [{
        model: db.CobroEntrega,
        as: 'cobro_entrega',
        required: false,
        attributes: ['id', 'metodo', 'comprobante_path'],
      }] : []),
    ],
  };
}

async function assertRutaDelRepartidor(deps = {}, { withCode = false, withPhone = false } = {}) {
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
      pedidoInclude(db, { withCode, withPhone }),
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

const rutasOrdenadas = new Set();

function olvidarOrdenRuta(repartidorId, fecha) {
  if (repartidorId == null || !fecha) return;
  rutasOrdenadas.delete(`${repartidorId}:${String(fecha).slice(0, 10)}`);
}

function puntoParada(parada) {
  const lat = Number(parada?.lat);
  const lng = Number(parada?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function ordenarParadasSiAplica(deps = {}) {
  if (process.env.NODE_ENV === 'test' && !deps.ordenarRutas) return;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || deps.repartidorId == null || !deps.fecha) return;
  const cacheKey = `${deps.repartidorId}:${deps.fecha}`;
  if (rutasOrdenadas.has(cacheKey)) return;
  const db = getModels(deps);
  if (typeof db.Ruta?.findAll !== 'function') return;
  const rutas = await db.Ruta.findAll({
    where: {
      fkid_repartidor: deps.repartidorId,
      fecha_ruta: deps.fecha,
      estado: { [Op.ne]: 'cancelada' },
    },
    include: [{ model: db.RutaPedido, as: 'pedidos' }],
  });
  for (const ruta of rutas) {
    const grupos = new Map();
    for (const row of ruta.pedidos || []) {
      const franja = franjaDe(row.franja || ruta.franja);
      const grupo = grupos.get(franja) || [];
      grupo.push(row);
      grupos.set(franja, grupo);
    }
    for (const grupo of grupos.values()) {
      const paradas = grupo
        .map((rp) => ({
          id: rp.id,
          lat: rp.lat == null ? null : Number(rp.lat),
          lng: rp.lng == null ? null : Number(rp.lng),
        }))
        .filter((rp) => Number.isFinite(rp.lat) && Number.isFinite(rp.lng));
      if (paradas.length < 2) continue;
      const { mapsApagada } = require('../maps/apagada');
      if (await mapsApagada(deps)) continue;
      let matrix;
      try {
        matrix = await distanceMatrix(paradas, apiKey, deps.distanceMatrixGet);
      } catch {
        continue;
      }
      if (!matrix) continue;
      const ordered = nearestNeighbor(paradas.map((rp) => rp.id), matrix);
      const asignaciones = ordenSinPisarManual(grupo, ordered);
      for (const item of asignaciones) {
        const row = grupo.find((rp) => rp.id === item.id);
        if (row?.orden_manual) continue;
        if (row?.update) await row.update({ orden_entrega: item.orden_entrega });
      }
    }
  }
  rutasOrdenadas.add(cacheKey);
  const { refrescarPolylineRuta } = require('../maps/google');
  for (const ruta of rutas) {
    try {
      await refrescarPolylineRuta(ruta, deps);
    } catch {
      // La orden queda; el trazado usa pines si no hay polyline.
    }
  }
}

async function anotarMinutos(deps, rutas) {
  if (process.env.NODE_ENV === 'test' && !deps.calcularMinutos) return;
  const { mapsApagada } = require('../maps/apagada');
  if (await mapsApagada(deps)) return;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return;
  const paradas = (rutas || [])
    .flatMap((ruta) => ruta.pedidos || [])
    .slice()
    .sort((a, b) => (Number(a.orden_entrega) || 0) - (Number(b.orden_entrega) || 0));
  const index = paradas.findIndex((parada) => abierto(parada));
  if (index < 0) return;
  const destino = paradas[index];
  if (Number(destino.tiempo_estimado_entrega) > 0) return;
  const origen = paradas.slice(0, index).reverse().map(puntoParada).find(Boolean);
  const hasta = puntoParada(destino);
  if (!origen || !hasta) return;
  const minutos = await minutosEntre(origen, hasta, apiKey, deps.distanceMatrixGet);
  if (minutos == null) return;
  destino.tiempo_estimado_entrega = minutos;
  if (typeof destino.update === 'function') {
    await destino.update({ tiempo_estimado_entrega: minutos });
  }
}

async function listarPedidos(deps = {}) {
  await requireJornadaAbierta(deps);
  await ordenarParadasSiAplica(deps);
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
  await anotarMinutos(deps, rutas);
  const franja = deps.franja === 'tarde' || deps.franja === 'manana' ? deps.franja : null;
  const pedidos = [];
  let esperandoLiberacion = false;
  let dejoVerSinLiberar = false;
  for (const ruta of rutas) {
    for (const rp of ruta.pedidos || []) {
      if (!rp.pedido) continue;
      const stopFranja = franjaDe(rp.franja || ruta.franja);
      if (franja && stopFranja !== franja) continue;
      if (abierto(rp) && !rp.liberado_en) {
        if (dejoVerSinLiberar) {
          esperandoLiberacion = true;
          continue;
        }
        dejoVerSinLiberar = true;
      }
      pedidos.push(toPedidoDto(rp.pedido, { ...plain(rp), franja: stopFranja }));
    }
  }
  return { pedidos, esperando_liberacion: esperandoLiberacion };
}

async function detallePedido(deps = {}) {
  await requireJornadaAbierta(deps);
  const rutaPedido = await assertRutaDelRepartidor(deps);
  const dto = toPedidoDto(rutaPedido.pedido, rutaPedido);
  const llamada = await findLlamadaCliente(deps);
  if (llamada?.datos?.espera_desde) dto.espera_desde = llamada.datos.espera_desde;
  if (llamada?.datos?.intento_liberado) dto.intento_liberado = true;
  return dto;
}

async function lineaWhatsAppDelCliente(deps, pedido) {
  const clienteId = pedido?.cliente?.id ?? pedido?.fkid_cliente;
  const db = getModels(deps);
  if (clienteId != null && typeof db.Conversacion?.findOne === 'function') {
    const conversacion = await db.Conversacion.findOne({
      where: { id_cliente: clienteId },
      order: [['updated_at', 'DESC']],
      attributes: ['whatsapp_phone_number_id'],
    });
    if (conversacion?.whatsapp_phone_number_id) return conversacion.whatsapp_phone_number_id;
  }
  const { elegirLinea } = require('../mensajeria/reagendar-whatsapp');
  const lineas = typeof db.WhatsAppPhoneNumber?.findAll === 'function'
    ? await db.WhatsAppPhoneNumber.findAll({ attributes: ['phoneid', 'telefono'] })
    : [];
  const ciudadId = pedido?.fkid_ciudad || pedido?.ciudad?.id;
  const ciudad = pedido?.ciudad || (ciudadId && typeof db.City?.findByPk === 'function'
    ? await db.City.findByPk(ciudadId, { attributes: ['telefono'] })
    : null);
  return elegirLinea(lineas, {
    telefonoCiudad: ciudad?.telefono,
    defecto: DEFAULT_WHATSAPP_PHONE_NUMBER_ID,
  });
}

async function mandarCodigo(deps, pedido) {
  const telefono = formatPhoneForWhatsApp(phoneOf(pedido));
  if (!telefono) fail(422, 'El pedido no tiene teléfono para enviar el código');
  const send = deps.sendWhatsAppTemplate || sendWhatsAppTemplate;
  let result;
  try {
    result = await send(
      telefono,
      await lineaWhatsAppDelCliente(deps, pedido),
      PACKAGE_CODE_TEMPLATE_NAME,
      {
        languageCode: WHATSAPP_TEMPLATE_LANGUAGE,
        components: packageCodeComponents(pedido.codigo_entrega),
      }
    );
  } catch {
    fail(502, PACKAGE_CODE_SEND_ERROR);
  }
  if (!result?.success) fail(502, PACKAGE_CODE_SEND_ERROR);
}

async function avisarCodigoAlCrear(deps, pedido) {
  try {
    await mandarCodigo(deps, pedido);
  } catch (error) {
    log.warn('No se pudo enviar el código al crear el pedido', { message: error.message, pedidoId: pedido?.id });
  }
}

async function llegada(deps = {}) {
  await requireJornadaAbierta(deps);
  const rutaPedido = await assertRutaDelRepartidor(deps, { withCode: true, withPhone: true });
  if (rutaPedido.llego_en) return toPedidoDto(rutaPedido.pedido, rutaPedido);

  await ensureDeliveryCode(rutaPedido.pedido);
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

async function saldoCamioneta(deps) {
  const db = getModels(deps);
  if (typeof db.InventarioVehiculo?.findAll !== 'function') return null;
  if (process.env.NODE_ENV === 'test' && !deps.models?.InventarioVehiculo) return null;
  const rows = await db.InventarioVehiculo.findAll({
    where: { fkid_repartidor: deps.repartidorId },
  });
  if (!rows.length) return null;
  return rows.map((row) => ({ nombre: row.nombre, cantidad: Number(row.cantidad) || 0 }));
}

async function registrarExtraNoEntregado(deps, jornada, pedidoId, lineas) {
  const db = getModels(deps);
  for (const line of lineas) {
    if (!line?.nombre || line.cantidad < 1) continue;
    const extras = (jornada?.cargas || []).filter(
      (row) => row && row.es_extra && Number(row.fkid_producto) === Number(line.fkid_producto)
    );
    if (extras[0] && typeof extras[0].update === 'function') {
      await extras[0].update({ cantidad: (Number(extras[0].cantidad) || 0) + line.cantidad });
    } else if (typeof db.JornadaCarga?.create === 'function' && jornada?.id) {
      const row = await db.JornadaCarga.create({
        fkid_jornada: jornada.id,
        nombre: line.nombre,
        fkid_producto: line.fkid_producto ?? null,
        cantidad: line.cantidad,
        precio_unitario: line.precio_unitario,
        es_extra: true,
      });
      jornada.cargas = [...(jornada.cargas || []), row];
    }
    await anotarAjuste(db, {
      repartidorId: deps.repartidorId,
      jornadaId: jornada?.id,
      pedidoId,
      nombre: line.nombre,
      fkid_producto: line.fkid_producto,
      cantidad: line.cantidad,
    });
  }
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
    const resolved = await resolveItem(item, db);
    if (!Number.isInteger(resolved.cantidad) || resolved.cantidad < 0) {
      fail(422, 'La cantidad no es válida');
    }
    items.push(resolved);
  }
  const activos = items.filter((item) => item.cantidad > 0);
  const saldo = await saldoCamioneta(deps);
  const stock = saldo
    ? validateStock({ carga: saldo, entregado: [], items: activos })
    : validateStock({
      carga: (jornada.cargas || []).map((c) => ({ nombre: c.nombre, cantidad: c.cantidad })),
      entregado: await cantidadesEntregadasHoy(deps, deps.pedidoId),
      items: activos,
    });
  if (!stock.ok) fail(422, stock.message);

  const pedido = rutaPedido.pedido;
  const lineasPedido = await db.ProductoPedido.findAll({
    where: { fkid_pedido: pedido.id },
    include: [{ model: db.Inventario, as: 'producto', attributes: ['id', 'nombre'], required: false }],
  });
  const listedIds = new Set(activos.map((item) => Number(item.fkid_producto)));
  const devuelto = [];
  for (const row of lineasPedido) {
    if (row.baja_logica) continue;
    const next = activos.find((item) => Number(item.fkid_producto) === Number(row.fkid_producto));
    const left = next ? next.cantidad : 0;
    const returned = (Number(row.cantidad) || 0) - left;
    if (returned > 0) {
      devuelto.push({
        nombre: next?.nombre || row.producto?.nombre || row.nombre,
        fkid_producto: row.fkid_producto,
        cantidad: returned,
        precio_unitario: Number(row.precio_unidad) || next?.precio_unidad || 0,
      });
    }
  }

  for (const item of activos) {
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
  await registrarExtraNoEntregado(deps, jornada, pedido.id, devuelto);

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

function nombreYApellido(value) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return '';
  return parts.join(' ').slice(0, 120);
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

  const elegido = String(deps.metodo || '');
  const metodo = elegido === 'terminal' ? 'transferencia' : elegido;
  const efectivo = Number(deps.monto_efectivo ?? deps.efectivo) || 0;
  const transferencia = Number(deps.monto_transferencia ?? deps.transferencia) || 0;
  const hasPhoto = Boolean(deps.file || deps.hasPhoto);
  const payment = validatePayment({
    metodo: elegido,
    total: pedido.total,
    efectivo,
    transferencia,
    hasPhoto,
  });
  if (!payment.ok) fail(422, payment.message);

  let receptor = '';
  let lugar = '';
  let evidencia = null;
  let notaTercero = '';
  if (rutaPedido.entrega_tercero_en) {
    receptor = nombreYApellido(deps.receptorNombre);
    if (!receptor) fail(422, 'Escribe nombre y apellido de quien recibe');
    if (!deps.receptorFile) fail(422, 'Toma la foto de quien recibe');
    evidencia = comprobantePath(deps.receptorFile);
    notaTercero = `Entregado a ${receptor}. Foto: ${evidencia}`;
  }
  if (rutaPedido.entrega_dejar_en) {
    lugar = String(deps.lugar || '').trim().slice(0, 200);
    if (lugar.length < 3) fail(422, 'Escribe dónde se deja el paquete');
    if (!deps.receptorFile) fail(422, 'Toma la foto del lugar');
    evidencia = comprobantePath(deps.receptorFile);
    notaTercero = `Dejado en ${lugar}. Foto: ${evidencia}`;
  }

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
        ...(receptor ? { receptor_nombre: receptor } : {}),
        ...(lugar ? { dejar_lugar: lugar } : {}),
        ...(evidencia ? { evidencia_path: evidencia } : {}),
        ...(notaTercero ? { notas_entrega: notaTercero } : {}),
      }, { transaction: t });
      await pedido.update({ estado: 'entregado', fecha_entrega_real: now }, { transaction: t });

      if (db.InventarioVehiculo) {
        const jornada = await loadJornada(deps, { findOrCreate: false });
        const items = (pedido.productos || []).map((prod) => ({
          nombre: prod.producto?.nombre || prod.nombre,
          fkid_producto: prod.fkid_producto,
          cantidad: Number(prod.cantidad) || 0,
        }));
        await descontarEntrega(db, {
          repartidorId: deps.repartidorId,
          jornadaId: jornada?.id,
          pedidoId: pedido.id,
          items,
          transaction: t,
        });
      }

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

  await refrescarCorte(deps);
  if (elegido === 'terminal' && typeof rutaPedido.update === 'function') {
    const previas = String(rutaPedido.notas_entrega || '');
    if (!previas.includes('Terminal física')) {
      await rutaPedido.update({ notas_entrega: `${previas ? `${previas}\n` : ''}Cobro con terminal física`.slice(0, 1000) });
    }
  }
  const original = String(pedido.metodo_pago || '');
  const mismo = original === elegido || (original === 'tarjeta' && elegido === 'terminal');
  if (original && elegido && !mismo) {
    const cobrado = elegido;
    try {
      await defaultCrearNotificacion(deps, {
        nombre: 'Método de pago distinto',
        descripcion: `${pedido.numero_pedido}: se cobró ${cobrado} y estaba en ${original}`,
        prioridad: 'alta',
        datos: {
          tipo: 'soporte',
          estado_solicitud: 'abierta',
          pedido_id: pedido.id,
          numero_pedido: pedido.numero_pedido,
          repartidor_id: deps.repartidorId,
          motivo: `Cobró ${cobrado}. El pedido estaba en ${original}.`,
        },
      });
    } catch (err) {
      log.warn('no se avisó el cambio de método', { message: err.message });
    }
  }
  let calificacionAvisada = false;
  try {
    const { avisarCalificar } = require('../mensajeria/reagendar-whatsapp');
    const tel = pedido.telefono_referencia || pedido.cliente?.telefono;
    const linea = await lineaWhatsAppDelCliente(deps, pedido);
    calificacionAvisada = await avisarCalificar({ telefono: tel, linea, numero: pedido.numero_pedido });
    if (!calificacionAvisada) log.warn('no se pidió la calificación', { pedidoId: pedido.id });
  } catch (err) {
    log.warn('no se pidió la calificación', { message: err.message });
  }
  await soltarSiguiente(deps);

  const timeZone = deps.timezone || deps.repartidor?.ciudad?.timezone;
  const stats = await logroStats(deps, timeZone, saldo);
  const unlocked = evaluateLogros(stats);
  for (const codigo of unlocked) {
    await db.RepartidorLogro.findOrCreate({
      where: { fkid_repartidor: deps.repartidorId, codigo },
      defaults: { desbloqueado_en: now },
    });
  }

  const dto = await loadPedidoDto(db, pedido, rutaPedido);
  dto.calificacion_avisada = calificacionAvisada;
  return dto;
}

function esAyudaCodigo(n, pedidoId) {
  const d = n.datos || {};
  return d.tipo === 'soporte' && (d.ayuda === 'codigo' || d.ayuda === 'tercero') && Number(d.pedido_id) === Number(pedidoId);
}

function esLlamadaCliente(n, pedidoId) {
  const d = n.datos || {};
  return (
    d.tipo === 'llamada_cliente'
    && Number(d.pedido_id) === Number(pedidoId)
    && d.estado_solicitud === 'abierta'
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

async function avisosDelRepartidor(deps) {
  if (deps.notificaciones) return deps.notificaciones;
  const db = getModels(deps);
  if (typeof db.Notificacion?.findAll !== 'function') return [];
  return db.Notificacion.findAll({
    where: whereDatosRepartidor(deps.repartidorId),
    order: [['id', 'DESC']],
  });
}

function createdAtDe(row) {
  const raw = row?.created_at || row?.createdAt;
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const fecha = row?.fecha_creacion ? String(row.fecha_creacion).slice(0, 10) : '';
  if (!fecha) return null;
  const hora = row?.hora_creacion ? String(row.hora_creacion).slice(0, 8) : '00:00:00';
  const d = new Date(`${fecha}T${hora.length === 5 ? `${hora}:00` : hora}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function pedidoDeAviso(row, datos) {
  const id = datos.pedido_id ? Number(datos.pedido_id) : null;
  if (!id) return null;
  const numero = datos.numero_pedido
    || (datos.tipo === 'pago' && row?.descripcion)
    || String(id);
  const nombre = datos.cliente_nombre || datos.receptor_nombre || null;
  return {
    id,
    numero_pedido: String(numero),
    cliente: { nombre_completo: nombre },
  };
}

function avisoDe(row) {
  const datos = row?.datos || {};
  const extra = {
    id: row.id,
    leido: Boolean(row.leida),
    created_at: createdAtDe(row),
    pedido: pedidoDeAviso(row, datos),
  };
  if (datos.tipo === 'pago') {
    return { tipo: 'INSTRUCCION_ACTUALIZADA', titulo: 'Pago por transferencia', mensaje: 'Call Center registró el pago por transferencia', ...extra };
  }
  if (datos.tipo === 'llamada_cliente' && datos.intento_liberado) {
    return { tipo: 'LIBERACION', titulo: 'Intento de entrega liberado', mensaje: 'Call Center liberó el intento de entrega', ...extra };
  }
  if (datos.tipo === 'llamada_cliente' && (row.leida || datos.llamada_atendida)) {
    return { tipo: 'CONTACTO_CLIENTE', titulo: 'Cliente contactado por Call Center', mensaje: 'Call Center ya se comunicó con el cliente', ...extra };
  }
  if (datos.ayuda === 'tercero' && (datos.autorizado || datos.receptor_nombre)) {
    return { tipo: 'INSTRUCCION_ACTUALIZADA', titulo: 'Entrega a otra persona', mensaje: 'Call Center autorizó la entrega a otra persona', ...extra };
  }
  if (datos.ayuda === 'dejar' && datos.autorizado) {
    return { tipo: 'INSTRUCCION_ACTUALIZADA', titulo: 'Dejar el paquete', mensaje: 'Call Center autorizó dejar el paquete', ...extra };
  }
  if (datos.ayuda === 'codigo' && datos.autorizado) {
    return { tipo: 'INSTRUCCION_ACTUALIZADA', titulo: 'Entrega sin código', mensaje: 'Call Center autorizó la entrega sin el código', ...extra };
  }
  return null;
}

async function listarAvisos(deps = {}) {
  const rows = await avisosDelRepartidor(deps);
  const avisos = rows.map((row) => avisoDe(row)).filter(Boolean).slice(0, 20);
  const ids = [...new Set(avisos.map((a) => a.pedido?.id).filter(Boolean))];
  if (!ids.length) return avisos;
  if (deps.notificaciones && typeof deps.models?.Pedido?.findAll !== 'function') return avisos;
  const db = getModels(deps);
  if (typeof db.Pedido?.findAll !== 'function') return avisos;
  const pedidos = await db.Pedido.findAll({
    where: { id: ids },
    attributes: ['id', 'numero_pedido'],
    include: db.Cliente ? [{ model: db.Cliente, as: 'cliente', attributes: ['nombre_completo'], required: false }] : [],
  });
  const porId = new Map(pedidos.map((p) => [Number(p.id), p]));
  return avisos.map((aviso) => {
    if (!aviso.pedido) return aviso;
    const pedido = porId.get(aviso.pedido.id);
    if (!pedido) return { ...aviso, pedido: null };
    return {
      ...aviso,
      pedido: {
        id: pedido.id,
        numero_pedido: pedido.numero_pedido || String(pedido.id),
        cliente: { nombre_completo: pedido.cliente?.nombre_completo || aviso.pedido.cliente?.nombre_completo || null },
      },
    };
  });
}

async function findLlamadaCliente(deps) {
  const rows = await avisosDelRepartidor(deps);
  return rows.find((n) => esLlamadaCliente(n, deps.pedidoId)) || null;
}

async function noEntregar(deps = {}) {
  await requireJornadaAbierta(deps);
  const avisos = await avisosDelRepartidor(deps);
  const llamada = avisos.find((n) => esLlamadaCliente(n, deps.pedidoId));
  const ayuda = avisos.find((n) => esAyudaCodigo(n, deps.pedidoId));
  const ahora = deps.now ? new Date(deps.now) : new Date();
  const porLlamada = Boolean(llamada?.datos?.intento_liberado);
  const porAyuda = Boolean(ayuda) && ayudaCodigoVencida(ayuda.datos?.espera_desde, ahora);
  if (!porLlamada && !porAyuda) {
    if (!llamada && !ayuda) fail(403, 'Falta avisar a Call Center');
    fail(403, 'Call Center tiene que liberar el intento');
  }

  const rutaPedido = await assertRutaDelRepartidor(deps, { withPhone: true });
  const pedido = rutaPedido.pedido;
  if (['entregado', 'no_entregado'].includes(pedido.estado) || rutaPedido.estado_entrega === 'fallido') {
    fail(409, 'El pedido ya fue cerrado');
  }
  const motivo = String(deps.motivo || '');
  const notaOtro = String(deps.nota || '').trim().slice(0, 200);
  if (motivo === 'otro' && notaOtro.length < 3) fail(422, 'Escribe qué pasó');
  const now = new Date();
  await rutaPedido.update({
    estado_entrega: 'fallido',
    fecha_entrega_real: now,
  });
  await pedido.update({ estado: 'no_entregado' });
  const jornada = await loadJornada(deps, { findOrCreate: false });
  const lineas = (pedido.productos || []).map((prod) => ({
    nombre: prod.producto?.nombre || prod.nombre,
    fkid_producto: prod.fkid_producto,
    cantidad: Number(prod.cantidad) || 0,
    precio_unitario: Number(prod.precio_unidad) || 0,
  })).filter((line) => line.nombre && line.cantidad > 0);
  await registrarExtraNoEntregado(deps, jornada, pedido.id, lineas);
  if (motivo === 'otro') {
    const previas = String(pedido.notas || '');
    await pedido.update({ notas: `${previas ? `${previas}\n` : ''}No entregado: ${notaOtro}`.slice(0, 1000) });
  }
  if (avisaReagendo(motivo) || motivo === 'otro') {
    try {
      const { avisarElegirFecha } = require('../mensajeria/reagendar-whatsapp');
      await avisarElegirFecha({
        telefono: formatPhoneForWhatsApp(phoneOf(pedido)),
        linea: await lineaWhatsAppDelCliente(deps, pedido),
      });
    } catch (error) {
      log.warn('No se pudo avisar el reagendo por WhatsApp', { message: error.message });
    }
  }
  await soltarSiguiente(deps);
  return toPedidoDto(pedido, rutaPedido);
}

async function refrescarCorte(deps = {}) {
  if (process.env.NODE_ENV === 'test' && !deps.models) return;
  const db = getModels(deps);
  if (typeof db.CobroEntrega?.findAll !== 'function') return;
  const jornada = deps.jornada || await loadJornada(deps, { findOrCreate: false });
  if (!jornada?.update || !deps.fecha) return;
  const cobros = await db.CobroEntrega.findAll({
    where: { fkid_repartidor: deps.repartidorId },
    include: [{
      model: db.Pedido,
      as: 'pedido',
      required: true,
      include: [{
        model: db.RutaPedido,
        as: 'rutas',
        required: true,
        include: [{
          model: db.Ruta,
          as: 'ruta',
          required: true,
          where: { fkid_repartidor: deps.repartidorId, fecha_ruta: deps.fecha },
        }],
      }],
    }],
  });
  let efectivo = 0;
  let virtual = 0;
  for (const cobro of cobros) {
    efectivo += Number(cobro.monto_efectivo) || 0;
    virtual += Number(cobro.monto_transferencia) || 0;
  }
  await jornada.update({
    efectivo_cobrado: Math.round(efectivo * 100) / 100,
    virtual_cobrado: Math.round(virtual * 100) / 100,
    valor_carga: moneyOf(jornada.valor_carga) || moneyOf(jornada.dinero_esperado),
  });
}

async function paradasAbiertas(deps) {
  const db = getModels(deps);
  if (typeof db.Ruta?.findAll !== 'function') return [];
  const rutas = await db.Ruta.findAll({
    where: {
      fkid_repartidor: deps.repartidorId,
      fecha_ruta: deps.fecha,
      baja_logica: false,
      estado: { [Op.ne]: 'cancelada' },
    },
    include: [{
      model: db.RutaPedido,
      as: 'pedidos',
      include: [pedidoInclude(db, { withPhone: true })],
    }],
  });
  return rutas.flatMap((ruta) => (ruta.pedidos || []).filter((parada) => {
    if (!abierto(parada)) return false;
    if (!deps.franja) return true;
    return franjaDe(parada.franja || ruta.franja) === deps.franja;
  }))
    .sort((a, b) => (Number(a.orden_entrega) || 0) - (Number(b.orden_entrega) || 0));
}

async function iniciarRuta(deps = {}) {
  await requireJornadaAbierta(deps);
  if (await repartoBloqueado(getModels(deps), deps.repartidorId, deps.fecha)) {
    fail(409, 'Sube el comprobante del depósito antes de abrir otra ruta');
  }
  const paradas = await paradasAbiertas(deps);
  const primera = paradas[0];
  if (primera && !primera.liberado_en && typeof primera.update === 'function') {
    const ahora = new Date();
    await primera.update({ liberado_en: ahora });
    primera.liberado_en = ahora;
  }
  if (primera) {
    await avisarSiguiente({
      ...deps,
      paradaId: primera.id,
      getModels,
      lineaDelCliente: lineaWhatsAppDelCliente,
      avisarSiguiente: deps.avisarSiguiente,
    }, null);
  }
  return { iniciado: true };
}

async function soltarSiguiente(deps) {
  try {
    await liberarSiguienteParada(deps);
  } catch (error) {
    if (error.status !== 409) log.warn('no se liberó la siguiente parada', { message: error.message });
  }
}

async function liberarSiguienteParada(deps = {}) {
  const paradas = await paradasAbiertas(deps);
  const siguiente = paradas.find((parada) => !parada.liberado_en);
  if (!siguiente) fail(409, 'No hay una parada pendiente de liberar');
  const anteriores = paradas.filter((parada) => Number(parada.orden_entrega) < Number(siguiente.orden_entrega));
  const origen = [...anteriores].reverse().find((parada) => {
    const lat = Number(parada.lat);
    const lng = Number(parada.lng);
    return Number.isFinite(lat) && Number.isFinite(lng);
  }) || null;
  const ahora = new Date();
  if (typeof siguiente.update === 'function') {
    await siguiente.update({ liberado_en: ahora });
  }
  siguiente.liberado_en = ahora;
  const aviso = await avisarSiguiente({
    ...deps,
    paradaId: siguiente.id,
    getModels,
    lineaDelCliente: lineaWhatsAppDelCliente,
    avisarSiguiente: deps.avisarSiguiente,
  }, origen);
  return {
    pedido_id: siguiente.fkid_pedido || siguiente.pedido?.id,
    minutos: aviso?.minutos || null,
  };
}

async function registrarCaja(deps = {}) {
  const jornada = await loadJornada(deps, { findOrCreate: false });
  if (!jornada || !canListOrders(jornada.estado)) {
    fail(403, 'Falta la validación del Call Center');
  }
  if (!deps.file) fail(422, 'La caja requiere foto del comprobante');
  await refrescarCorte({ ...deps, jornada });
  const anterior = jornada.comprobante_deposito_path;
  const nuevo = comprobantePath(deps.file);
  await jornada.update({
    efectivo_a_depositar: Number(deps.efectivo) || 0,
    comprobante_deposito_path: nuevo,
  });
  await soltarParadasAbiertas(getModels(deps), deps.repartidorId, jornada.fecha);
  if (anterior && anterior !== nuevo) {
    const archivo = path.join(__dirname, '..', '..', 'uploads', 'comprobantes', path.basename(String(anterior)));
    fs.unlink(archivo, () => {});
  }
  const repartidorNombre = await nombreDelRepartidor(deps);
  const aviso = await defaultCrearNotificacion(deps, {
    nombre: 'Cierre de día',
    descripcion: repartidorNombre ? `Viene de ${repartidorNombre}` : 'Viene de la cola de Call Center',
    prioridad: 'alta',
    datos: {
      tipo: 'cierre_dia',
      estado_solicitud: 'abierta',
      repartidor_id: deps.repartidorId,
      jornada_id: jornada.id,
      ...(repartidorNombre ? { repartidor_nombre: repartidorNombre } : {}),
    },
  });
  const datosCierre = {
    ...(aviso.datos || {}),
    actionUrl: `/dashboard/call-center?tab=operacion&aviso=${aviso.id}`,
  };
  if (typeof aviso.update === 'function') await aviso.update({ datos: datosCierre });
  else aviso.datos = datosCierre;
  publishNotificacion(aviso);
  return obtenerJornada({ ...deps, jornada });
}

function paqueteHooks() {
  return { loadJornada, loadRepartidor, getModels, obtenerJornada };
}

async function listarPaquetesDisponibles(deps = {}) {
  return jornadaPaquetes.listarPaquetesDisponibles(deps, paqueteHooks());
}

async function agregarPaqueteParada(deps = {}) {
  return jornadaPaquetes.agregarPaqueteParada(deps, paqueteHooks());
}

async function quitarPaqueteParada(deps = {}) {
  return jornadaPaquetes.quitarPaqueteParada(deps, paqueteHooks());
}

async function crearSoporte(deps = {}) {
  const motivo = deps.motivo;
  const esLlamada = motivo === 'llamada';
  const esAyudaCodigo = motivo === 'ayuda_codigo';
  const esAyudaTercero = motivo === 'ayuda_tercero';
  const esAyudaDejar = motivo === 'ayuda_dejar';
  const esFalla = motivo === 'averia' || motivo === 'clima';
  const nota = String(deps.nota || '').trim().slice(0, 500);
  if (esFalla && nota.length < 3) fail(422, 'Escribe qué pasó');
  const crearNotificacion = deps.crearNotificacion || ((payload) => defaultCrearNotificacion(deps, payload));
  const esperaDesde = esLlamada || esAyudaCodigo || esAyudaTercero || esAyudaDejar ? new Date().toISOString() : null;
  const repartidorNombre = await nombreDelRepartidor(deps);
  const tipo = esLlamada ? 'llamada_cliente' : 'soporte';
  const notificacion = await crearNotificacion({
    nombre: esLlamada ? 'Llamada al cliente' : 'Soporte del repartidor',
    descripcion: repartidorNombre ? `Viene de ${repartidorNombre}` : 'Viene de la cola de Call Center',
    prioridad: esFalla ? 'urgente' : esLlamada ? 'alta' : 'media',
    datos: {
      tipo,
      estado_solicitud: 'abierta',
      repartidor_id: deps.repartidorId,
      ...(repartidorNombre ? { repartidor_nombre: repartidorNombre } : {}),
      ...(deps.pedidoId ? { pedido_id: Number(deps.pedidoId) } : {}),
      ...(esperaDesde ? { espera_desde: esperaDesde } : {}),
      motivo: esFalla ? motivo : (nota || motivo),
      ...(esAyudaCodigo ? { ayuda: 'codigo' } : {}),
      ...(esAyudaTercero ? { ayuda: 'tercero' } : {}),
      ...(esAyudaDejar ? { ayuda: 'dejar' } : {}),
      ...(nota ? { nota } : {}),
    },
  });
  const datos = {
    ...(notificacion.datos || {}),
    actionUrl: esAyudaCodigo || esAyudaTercero || esAyudaDejar || esFalla || esLlamada
      ? `/dashboard/call-center?tab=soporte&aviso=${notificacion.id}&repartidor=${deps.repartidorId}`
      : `/dashboard/call-center?tab=incidencias&aviso=${notificacion.id}`,
  };
  if (typeof notificacion.update === 'function') await notificacion.update({ datos });
  else notificacion.datos = datos;
  publishNotificacion(notificacion);
  if (esLlamada && deps.pedidoId) {
    try {
      const pedido = await getModels(deps).Pedido.findByPk(deps.pedidoId, {
        include: [{ association: 'cliente', attributes: ['id', 'telefono'] }],
      });
      const tel = formatPhoneForWhatsApp(phoneOf(pedido));
      const linea = await lineaWhatsAppDelCliente(deps, pedido);
      if (tel && linea) {
        const { sendWhatsAppMessage } = require('../../utils/whatsapp');
        await sendWhatsAppMessage(tel, 'Tu repartidor está en la dirección esperándote.', linea);
      }
    } catch (error) {
      log.warn('no se avisó la espera al cliente', { message: error.message });
    }
  }
  return {
    id: notificacion.id,
    notificacion_id: notificacion.id,
    ...(esperaDesde ? { espera_desde: esperaDesde } : {}),
  };
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

async function actualizarFoto(deps = {}) {
  if (!deps.file?.filename) fail(422, 'Elige una foto');
  const db = getModels(deps);
  const repartidor = await db.Repartidor.findByPk(deps.repartidorId);
  if (!repartidor) fail(404, 'Repartidor no encontrado');
  const anterior = repartidor.foto;
  await repartidor.update({ foto: deps.file.filename });
  if (anterior && anterior !== deps.file.filename) {
    const archivo = path.join(__dirname, '..', '..', 'uploads', 'repartidores', path.basename(String(anterior)));
    fs.promises.unlink(archivo).catch(() => {});
  }
  return { foto: urlFoto(deps.file.filename) };
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
  const db = getModels(deps);
  let asignado = null;
  if (typeof db.ContactoSoporte?.findAll === 'function') {
    const filas = await db.ContactoSoporte.findAll({ attributes: ['telefono', 'repartidores'] });
    asignado = telefonoDeRepartidor(
      filas.map((row) => {
        let repartidores = row.repartidores;
        if (typeof repartidores === 'string') {
          try { repartidores = JSON.parse(repartidores); } catch { repartidores = []; }
        }
        return { telefono: row.telefono, repartidores: repartidores || [] };
      }),
      repartidor.id,
    );
  }
  return {
    id: repartidor.id,
    nombre: repartidor.nombre_completo,
    foto: urlFoto(repartidor.foto),
    entregas_hoy: stats.entregasHoy,
    efectivo_hoy: efectivo,
    puntos,
    jornada: jornada
      ? { id: jornada.id, estado: jornada.estado, fecha: jornada.fecha }
      : { estado: 'borrador', fecha },
    telefono_call_center: asignado || ciudad?.numero_soporte_cliente || ciudad?.telefono || null,
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

async function registrarUbicacion(deps = {}) {
  const { puntoDe } = require('../maps/google');
  const punto = puntoDe({ lat: deps.lat, lng: deps.lng });
  if (!punto) fail(422, 'La ubicación no es válida');
  const db = getModels(deps);
  const at = deps.fecha ? new Date(deps.fecha) : new Date();
  if (typeof db.Repartidor?.update === 'function') {
    await db.Repartidor.update(
      { lat_actual: punto.lat, lng_actual: punto.lng, ubicacion_at: at },
      { where: { id: deps.repartidorId } },
    );
  }
  return { lat: punto.lat, lng: punto.lng, ubicacion_at: at.toISOString() };
}

async function registrarVelocidad(deps = {}) {
  const kmh = Number(deps.velocidad_kmh ?? deps.velocidad);
  if (!Number.isFinite(kmh) || kmh < 0 || kmh > 180) fail(422, 'La velocidad no es válida');
  const db = getModels(deps);
  if (Number.isFinite(Number(deps.lat)) && Number.isFinite(Number(deps.lng))) {
    try { await registrarUbicacion(deps); } catch { /* velocidad se guarda igual */ }
  }
  if (typeof db.LecturaVelocidad?.create !== 'function') return { promedio: null, lecturas: 0 };
  const jornada = await loadJornada(deps, { findOrCreate: false });
  await db.LecturaVelocidad.create({
    fkid_repartidor: deps.repartidorId,
    fkid_jornada: jornada?.id ?? null,
    velocidad_kmh: Math.round(kmh * 10) / 10,
    lat: Number.isFinite(Number(deps.lat)) ? Number(deps.lat) : null,
    lng: Number.isFinite(Number(deps.lng)) ? Number(deps.lng) : null,
    fecha: deps.fecha,
  });
  return resumenVelocidad(deps);
}

function gpsDeFila(row) {
  const { puntoDe } = require('../maps/google');
  const punto = puntoDe({
    lat: row?.lat ?? row?.lat_actual ?? row?.repartidor?.lat_actual,
    lng: row?.lng ?? row?.lng_actual ?? row?.repartidor?.lng_actual,
  });
  return {
    lat: punto?.lat ?? null,
    lng: punto?.lng ?? null,
    ubicacion_at: row?.ubicacion_at || row?.repartidor?.ubicacion_at || null,
  };
}

async function resumenVelocidad(deps = {}) {
  const db = getModels(deps);
  if (typeof db.LecturaVelocidad?.findAll !== 'function') return [];
  const where = {};
  if (deps.fecha) where.fecha = deps.fecha;
  if (deps.repartidorId != null) where.fkid_repartidor = deps.repartidorId;
  const rows = await db.LecturaVelocidad.findAll({
    where,
    include: db.Repartidor ? [{ model: db.Repartidor, as: 'repartidor', attributes: ['id', 'nombre_completo', 'lat_actual', 'lng_actual', 'ubicacion_at'], required: false }] : [],
  });
  const grupos = new Map();
  for (const row of rows) {
    const id = row.fkid_repartidor;
    const gps = gpsDeFila(row);
    const grupo = grupos.get(id) || {
      repartidor_id: id,
      nombre: row.repartidor?.nombre_completo || null,
      suma: 0,
      lecturas: 0,
      lat: gps.lat,
      lng: gps.lng,
      ubicacion_at: gps.ubicacion_at,
    };
    grupo.suma += Number(row.velocidad_kmh) || 0;
    grupo.lecturas += 1;
    if (gps.lat != null) {
      grupo.lat = gps.lat;
      grupo.lng = gps.lng;
      grupo.ubicacion_at = gps.ubicacion_at;
    }
    grupos.set(id, grupo);
  }
  const lista = [...grupos.values()].map((grupo) => ({
    repartidor_id: grupo.repartidor_id,
    nombre: grupo.nombre,
    promedio: Math.round((grupo.suma / grupo.lecturas) * 10) / 10,
    lecturas: grupo.lecturas,
    lat: grupo.lat,
    lng: grupo.lng,
    ubicacion_at: grupo.ubicacion_at,
  }));
  if (deps.repartidorId != null) return lista[0] || { promedio: null, lecturas: 0, lat: null, lng: null, ubicacion_at: null };
  return lista;
}

async function inventarioVehiculo(deps = {}) {
  const db = getModels(deps);
  const rows = await db.InventarioVehiculo.findAll({
    where: { fkid_repartidor: deps.repartidorId },
    order: [['nombre', 'ASC']],
  });
  return rows.map((row) => {
    const raw = plain(row);
    return {
      id: raw.id,
      nombre: raw.nombre,
      fkid_producto: raw.fkid_producto,
      cantidad: Number(raw.cantidad) || 0,
    };
  });
}

async function ubicacionPedido(deps = {}) {
  const rutaPedido = await assertRutaDelRepartidor(deps);
  const { geocodePedido, puntoDe } = require('../maps/google');
  const direccion = String(rutaPedido.pedido?.direccion_entrega || '').trim();
  const gps = puntoDe({ lat: deps.lat, lng: deps.lng })
    || puntoDe({ lat: deps.repartidor?.lat_actual, lng: deps.repartidor?.lng_actual });
  const pegadoAlGps = (p) => p && gps && Math.abs(p.lat - gps.lat) < 0.0007 && Math.abs(p.lng - gps.lng) < 0.0007;
  let punto = puntoDe(rutaPedido);
  // shortcut: coords pegadas al GPS son del repartidor, no del domicilio
  if (pegadoAlGps(punto)) punto = null;
  if (!punto) {
    try {
      const cliente = puntoDe(rutaPedido.pedido?.cliente);
      const cacheSucia = pegadoAlGps(cliente);
      punto = cacheSucia ? null : cliente;
      if (!punto) {
        const delPedido = puntoDe(rutaPedido.pedido);
        punto = pegadoAlGps(delPedido) ? null : delPedido;
      }
      if (!punto) punto = puntoDe(await geocodePedido(rutaPedido.pedido, { ...deps, skipCache: cacheSucia }));
      if (pegadoAlGps(punto)) punto = null;
      if (punto && typeof rutaPedido.update === 'function') {
        await rutaPedido.update({
          lat: punto.lat,
          lng: punto.lng,
          link_ubicacion: `https://maps.google.com/?q=${punto.lat},${punto.lng}`,
        });
      }
    } catch {
      punto = null;
    }
  }
  const destinoTxt = punto ? `${punto.lat},${punto.lng}` : encodeURIComponent(direccion);
  return {
    lat: punto?.lat ?? null,
    lng: punto?.lng ?? null,
    link_ubicacion: punto
      ? `https://maps.google.com/?q=${punto.lat},${punto.lng}`
      : (direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}` : rutaPedido.link_ubicacion || null),
    link_navegacion: punto
      ? `https://www.google.com/maps/dir/?api=1${gps ? `&origin=${gps.lat},${gps.lng}` : ''}&destination=${punto.lat},${punto.lng}&travelmode=driving`
      : (direccion ? `https://www.google.com/maps/dir/?api=1&destination=${destinoTxt}&travelmode=driving` : null),
    link_waze: punto
      ? `https://waze.com/ul?ll=${punto.lat},${punto.lng}&navigate=yes`
      : (direccion ? `https://waze.com/ul?q=${encodeURIComponent(direccion)}&navigate=yes` : null),
    polyline: [],
  };
}

function puntoDeRepartidor(repartidor) {
  const lat = Number(repartidor?.lat_actual);
  const lng = Number(repartidor?.lng_actual);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
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

async function calificarCliente(deps = {}) {
  const estrellas = Number(deps.estrellas);
  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) fail(422, 'Elige de 1 a 5');
  const rutaPedido = await assertRutaDelRepartidor(deps);
  const pedido = rutaPedido.pedido;
  const comentario = String(deps.comentario || '').trim().slice(0, 200);
  const linea = `Calificación al cliente: ${estrellas}${comentario ? `. ${comentario}` : ''}`;
  const previas = String(pedido.notas || '');
  const notas = (previas.includes('Calificación al cliente:') ? previas : `${previas ? `${previas}\n` : ''}${linea}`).slice(0, 1000);
  if (typeof pedido.update === 'function') await pedido.update({ notas });
  return { guardado: true };
}

module.exports = {
  replaceCarga,
  solicitarValidacion,
  refrescarCargaEnValidacion,
  leerSolicitud,
  obtenerJornada,
  buscarBodega,
  agregarExtra,
  listarPaquetesDisponibles,
  agregarPaqueteParada,
  quitarPaqueteParada,
  iniciarRuta,
  liberarSiguienteParada,
  assertRutaDelRepartidor,
  llegada,
  validarCodigo,
  ajustarProductos,
  entregar,
  calificarCliente,
  noEntregar,
  registrarCaja,
  crearSoporte,
  listarPedidos,
  inventarioVehiculo,
  registrarVelocidad,
  registrarUbicacion,
  resumenVelocidad,
  ubicacionPedido,
  detallePedido,
  listarAvisos,
  mandarCodigo,
  avisarCodigoAlCrear,
  ordenarParadasSiAplica,
  lineaWhatsAppDelCliente,
  perfil,
  actualizarFoto,
  estadisticas,
  logros,
  toPedidoDto,
  olvidarOrdenRuta,
};
