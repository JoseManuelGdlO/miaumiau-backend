const { dayKey } = require('../app-repartidor/domain');

const NOTE_LIMIT = 1000;
const TIPOS = ['check_in', 'llamada_cliente', 'soporte', 'cierre_dia'];
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

function reagendarCheck({ fecha, hoy, rol }) {
  const dia = String(fecha || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { ok: false, statusCode: 422, message: 'La fecha no es válida' };
  if (dia < hoy) return { ok: false, statusCode: 422, message: 'La fecha ya pasó' };
  if (dia === hoy && rol !== 'super_admin') {
    return { ok: false, statusCode: 403, message: 'Solo un super admin puede reagendar para el mismo día' };
  }
  return { ok: true, fecha: dia };
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

function isValidatedCheckIn(row) {
  const datos = row?.datos || {};
  return Boolean(row?.leida) && datos.tipo === 'check_in' && datos.estado_solicitud !== 'cancelada';
}

function toCargaValidada({ notificacion, repartidor, jornada }) {
  return {
    ...toSolicitudDetalle({
      notificacion,
      repartidor,
      cargas: jornada?.cargas || [],
      dineroEsperado: jornada?.dinero_esperado,
    }),
    validado_por_nombre: jornada?.validado_por_nombre || null,
  };
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
    ayuda: datos.ayuda || null,
    pedido_id: datos.pedido_id ? Number(datos.pedido_id) : null,
    numero_pedido: numeroPedido || null,
    repartidor: repartidorDto(repartidor),
    fecha: notificacion.fecha_creacion,
    hora: notificacion.hora_creacion,
    prioridad: notificacion.prioridad,
  };
}

function toSolicitudDetalle({ notificacion, repartidor, cargas, pedido, numeroPedido, dineroEsperado, deposito }) {
  const base = toSolicitudResumen(notificacion, repartidor, numeroPedido || pedido?.numero_pedido);
  const datos = notificacion.datos || {};
  if (datos.tipo === 'check_in') {
    return {
      ...base,
      dinero_esperado: dineroEsperado == null || dineroEsperado === '' ? 0 : Number(dineroEsperado),
      espera_reenvio: Boolean(datos.espera_reenvio),
      cargas: (cargas || []).map((c) => ({
        id: c.id ?? null,
        fkid_producto: c.fkid_producto ?? null,
        nombre: c.nombre,
        cantidad: c.cantidad,
        precio_unitario: c.precio_unitario,
        es_extra: Boolean(c.es_extra),
      })),
    };
  }
  if (datos.tipo === 'cierre_dia') {
    return {
      ...base,
      efectivo_a_depositar: Number(deposito?.efectivo_a_depositar) || 0,
      comprobante_url: comprobantePublicPath(deposito?.comprobante_deposito_path),
    };
  }
  return {
    ...base,
    cliente: pedido?.cliente?.nombre_completo || null,
    telefono: pedido ? phoneOf(pedido) : null,
    direccion: pedido?.direccion_entrega || null,
  };
}

function timestamp(value) {
  if (value == null || value === '') return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function fueModificado(pedido) {
  if (!pedido) return false;
  const born = timestamp(pedido.created_at ?? pedido.createdAt);
  const lines = Array.isArray(pedido.productos) ? pedido.productos : [];
  const linesChanged = lines.some((line) => {
    if (line?.baja_logica) return true;
    const created = timestamp(line?.created_at ?? line?.createdAt);
    const updated = timestamp(line?.updated_at ?? line?.updatedAt);
    if (created != null && updated != null && updated - created > 1000) return true;
    if (born != null && created != null && created - born > 1000) return true;
    return false;
  });
  if (linesChanged) return true;
  const cobro = pedido.cobro_entrega || pedido.cobroEntrega || null;
  const cobrado = cobro?.metodo;
  const original = pedido.metodo_pago;
  if (!cobrado || !original) return false;
  if (cobrado === 'mixto') return true;
  return cobrado !== original;
}

function comprobantePublicPath(pathValue) {
  const raw = String(pathValue || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const relative = raw.replace(/^\/+/, '');
  const withUploads = relative.startsWith('uploads/') ? relative : `uploads/${relative}`;
  return `/${withUploads}`;
}

function toPedidoDia({ pedido, rutaPedido, ruta }) {
  const cobro = pedido.cobro_entrega || pedido.cobroEntrega || null;
  return {
    id: pedido.id,
    ruta_pedido_id: rutaPedido.id,
    numero_pedido: pedido.numero_pedido,
    estado: pedido.estado,
    estado_entrega: rutaPedido.estado_entrega,
    modificado: fueModificado(pedido),
    cliente: pedido.cliente?.nombre_completo || null,
    telefono: phoneOf(pedido),
    direccion: pedido.direccion_entrega || null,
    notas: pedido.notas || null,
    franja: rutaPedido.franja === 'tarde' ? 'tarde' : 'manana',
    horario_preferente: pedido.horario_preferente ? String(pedido.horario_preferente).slice(0, 5) : null,
    orden_entrega: rutaPedido.orden_entrega ?? null,
    repartidor: repartidorDto(ruta?.repartidor),
    ciudad_id: ruta?.fkid_ciudad ?? null,
    comprobante_url: comprobantePublicPath(cobro?.comprobante_path),
  };
}

function normalizarContacto({ telefono, repartidorIds }) {
  const tel = String(telefono || '').trim();
  if (!/^[\+]?[0-9\s\-()]{8,20}$/.test(tel)) {
    return { ok: false, statusCode: 422, message: 'Escribe un teléfono válido' };
  }
  const ids = [...new Set((repartidorIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  return { ok: true, telefono: tel, repartidorIds: ids };
}

function quitarRepartidores(rows, usuarioId, ids) {
  const tomados = new Set(ids);
  return rows.map((row) => ({
    ...row,
    repartidorIds: row.usuarioId === usuarioId
      ? ids
      : row.repartidorIds.filter((id) => !tomados.has(id)),
  }));
}

function telefonoDeRepartidor(rows, repartidorId) {
  const id = Number(repartidorId);
  const row = (rows || []).find((item) => (item.repartidorIds || []).map(Number).includes(id) && item.telefono);
  return row ? String(row.telefono) : null;
}

function puedeAutorizarExcepcion(rol) {
  const nombre = String(rol || '');
  return nombre === 'super_admin' || nombre === 'admin' || nombre.includes('supervisor');
}

function toRepartidorOpcion(repartidor) {
  return { id: repartidor.id, nombre_completo: repartidor.nombre_completo, estado: repartidor.estado };
}

module.exports = {
  NOTE_LIMIT,
  ACTIVE,
  approveCheck,
  reagendarCheck,
  attendCheck,
  appendNota,
  transition,
  reassignCheck,
  stamp,
  phoneOf,
  isOpenSolicitud,
  isValidatedCheckIn,
  toCargaValidada,
  toSolicitudResumen,
  toSolicitudDetalle,
  toPedidoDia,
  fueModificado,
  comprobantePublicPath,
  toRepartidorOpcion,
  puedeAutorizarExcepcion,
  normalizarContacto,
  quitarRepartidores,
  telefonoDeRepartidor,
};
