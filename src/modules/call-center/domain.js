const { dayKey } = require('../app-repartidor/domain');

const NOTE_LIMIT = 1000;
const TIPOS = ['check_in', 'llamada_cliente', 'soporte'];
const ACTIVE = ['activo', 'disponible', 'ocupado', 'en_ruta'];
const CLOSED = ['entregado', 'no_entregado', 'cancelado'];
const TRANSITIONS = {
  pendiente: ['confirmado', 'no_entregado', 'cancelado'],
  confirmado: ['en_preparacion', 'no_entregado', 'cancelado'],
  en_preparacion: ['en_camino', 'cancelado'],
  en_camino: ['entregado', 'no_entregado', 'cancelado'],
  no_entregado: ['entregado'],
};
const METHODS = {
  confirmado: 'confirmar',
  en_preparacion: 'preparar',
  en_camino: 'enviar',
  entregado: 'entregar',
  no_entregado: 'noEntregar',
  cancelado: 'cancelar',
};

function approveCheck({ tipo, leida, estadoSolicitud, jornadaEstado, vigente }) {
  const ok = tipo === 'check_in'
    && !leida
    && estadoSolicitud === 'abierta'
    && jornadaEstado === 'esperando_call_center'
    && vigente;
  if (!ok) return { ok: false, statusCode: 409, message: 'Ese check-in ya no se puede aprobar' };
  return { ok: true };
}

function attendCheck({ tipo, leida, estadoSolicitud }) {
  const ok = (tipo === 'llamada_cliente' || tipo === 'soporte') && !leida && estadoSolicitud === 'abierta';
  if (!ok) return { ok: false, statusCode: 409, message: 'Esa solicitud ya no se puede atender' };
  return { ok: true };
}

function stamp(date, timeZone) {
  const zone = timeZone || 'America/Mexico_City';
  const day = dayKey(date, zone);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${day} ${time}`;
}

function appendNota(existing, note, stampText) {
  const text = String(note || '').trim();
  if (!text) return { ok: true, notas: existing ?? null, changed: false };
  const line = `[Call Center ${stampText}] ${text}`;
  const base = existing == null || existing === '' ? '' : String(existing);
  const next = base ? `${base}\n${line}` : line;
  if (next.length > NOTE_LIMIT) {
    return { ok: false, statusCode: 422, message: 'La nota supera 1000 caracteres' };
  }
  return { ok: true, notas: next, changed: true };
}

function transition(from, to) {
  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    return { ok: false, statusCode: 422, message: 'Ese cambio de estado no está permitido' };
  }
  let route = null;
  if (to === 'entregado') route = { estado_entrega: 'entregado', fecha_entrega_real: true };
  if (to === 'no_entregado') route = { estado_entrega: 'fallido', fecha_entrega_real: true };
  if (to === 'cancelado') route = { estado_entrega: 'fallido', fecha_entrega_real: false };
  return { ok: true, method: METHODS[to], route };
}

function reassignCheck({ pedidoEstado, sameDriver, driverFound, sameCity, driverEstado, bajaLogica }) {
  if (CLOSED.includes(pedidoEstado)) {
    return { ok: false, statusCode: 409, message: 'Ese pedido ya no se puede reasignar' };
  }
  if (!driverFound || !sameCity || !ACTIVE.includes(driverEstado) || bajaLogica) {
    return { ok: false, statusCode: 403, message: 'Ese repartidor no puede recibir el pedido' };
  }
  if (sameDriver) {
    return { ok: false, statusCode: 422, message: 'El pedido ya está con ese repartidor' };
  }
  return { ok: true };
}

function phoneOf(pedido) {
  const ref = String(pedido?.telefono_referencia || '').trim();
  if (ref) return ref;
  return String(pedido?.cliente?.telefono || '').trim();
}

function isOpenSolicitud(row) {
  const datos = row?.datos || {};
  return !row?.leida && TIPOS.includes(datos.tipo) && datos.estado_solicitud !== 'cancelada';
}

function repartidorDto(repartidor) {
  if (!repartidor) return null;
  return { id: repartidor.id, nombre_completo: repartidor.nombre_completo };
}

function toSolicitudResumen(notificacion, repartidor, numeroPedido) {
  const datos = notificacion.datos || {};
  return {
    id: notificacion.id,
    tipo: datos.tipo,
    motivo: datos.motivo || null,
    pedido_id: datos.pedido_id ? Number(datos.pedido_id) : null,
    numero_pedido: numeroPedido || null,
    repartidor: repartidorDto(repartidor),
    fecha: notificacion.fecha_creacion,
    hora: notificacion.hora_creacion,
    prioridad: notificacion.prioridad,
  };
}

function toSolicitudDetalle({ notificacion, repartidor, cargas, pedido, numeroPedido }) {
  const base = toSolicitudResumen(notificacion, repartidor, numeroPedido || pedido?.numero_pedido);
  const datos = notificacion.datos || {};
  if (datos.tipo === 'check_in') {
    return {
      ...base,
      cargas: (cargas || []).map((c) => ({
        nombre: c.nombre,
        cantidad: c.cantidad,
        precio_unitario: c.precio_unitario,
        es_extra: Boolean(c.es_extra),
      })),
    };
  }
  return {
    ...base,
    cliente: pedido?.cliente?.nombre_completo || null,
    telefono: pedido ? phoneOf(pedido) : null,
    direccion: pedido?.direccion_entrega || null,
  };
}

function toPedidoDia({ pedido, rutaPedido, ruta }) {
  return {
    id: pedido.id,
    ruta_pedido_id: rutaPedido.id,
    numero_pedido: pedido.numero_pedido,
    estado: pedido.estado,
    estado_entrega: rutaPedido.estado_entrega,
    cliente: pedido.cliente?.nombre_completo || null,
    telefono: phoneOf(pedido),
    direccion: pedido.direccion_entrega || null,
    repartidor: repartidorDto(ruta?.repartidor),
    ciudad_id: ruta?.fkid_ciudad ?? null,
  };
}

function toRepartidorOpcion(repartidor) {
  return { id: repartidor.id, nombre_completo: repartidor.nombre_completo, estado: repartidor.estado };
}

module.exports = {
  NOTE_LIMIT,
  ACTIVE,
  approveCheck,
  attendCheck,
  appendNota,
  transition,
  reassignCheck,
  stamp,
  phoneOf,
  isOpenSolicitud,
  toSolicitudResumen,
  toSolicitudDetalle,
  toPedidoDia,
  toRepartidorOpcion,
};
