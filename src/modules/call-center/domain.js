const { dayKey } = require('../app-repartidor/domain');
const { MAX_PARADAS_DIA } = require('../rutas/cupo');

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
  if (dia === hoy && nombreRol(rol) !== 'super_admin') {
    return { ok: false, statusCode: 403, message: 'Solo un super admin puede reagendar para el mismo día' };
  }
  return { ok: true, fecha: dia };
}

function attendCheck({ tipo, leida, estadoSolicitud }) {
  const cerrada = estadoSolicitud === 'cancelada' || estadoSolicitud === 'atendida';
  const ok = (tipo === 'llamada_cliente' || tipo === 'soporte') && !leida && !cerrada;
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

function filled(value) {
  return value != null && String(value).trim() !== '';
}

function siniestroCompleto(row) {
  return filled(row?.licencia_vigencia)
    && filled(row?.licencia_foto)
    && filled(row?.seguro_social)
    && filled(row?.tipo_sangre)
    && filled(row?.consentimiento_at)
    && filled(row?.consentimiento_archivo)
    && filled(row?.ine_archivo);
}

function puedeAsignarConSiniestro(row) {
  return Boolean(row?.es_prueba) || siniestroCompleto(row);
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

function diaDe(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value || '').slice(0, 10);
}

function diaMexico(value) {
  if (value == null || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isNaN(date.getTime()) && (value instanceof Date || /T|\d{2}:\d{2}/.test(String(value)))) {
    return dayKey(date, 'America/Mexico_City');
  }
  return diaDe(value);
}

function fechaIncidencia({ pedido, rutaPedido, ruta }) {
  return diaMexico(
    rutaPedido?.fecha_entrega_real
    || pedido?.fecha_entrega_real
    || pedido?.updated_at
    || pedido?.updatedAt
    || ruta?.fecha_ruta
  ) || null;
}

function isOpenSolicitud(row) {
  const datos = row?.datos || {};
  return !row?.leida && TIPOS.includes(datos.tipo) && datos.estado_solicitud !== 'cancelada' && datos.estado_solicitud !== 'atendida';
}

function diaDeFila(row) {
  const instante = row?.created_at || row?.createdAt;
  return instante ? dayKey(new Date(instante), 'America/Mexico_City') : diaDe(row?.fecha_creacion);
}

function esDeHoy(row, hoy) {
  return diaDeFila(row) === diaDe(hoy);
}

function sigueHoy(row, hoy) {
  const tipo = row?.datos?.tipo;
  if (tipo !== 'check_in' && tipo !== 'cierre_dia') return true;
  // fecha_creacion queda en UTC; el día de la jornada es created_at en México
  return esDeHoy(row, hoy);
}

function isValidatedCheckIn(row) {
  const datos = row?.datos || {};
  return Boolean(row?.leida) && datos.tipo === 'check_in' && datos.estado_solicitud !== 'cancelada';
}

function cobroDeParada(row) {
  const pedido = row?.pedido || {};
  const cobro = pedido.cobro_entrega || pedido.cobroEntrega;
  return {
    numero_pedido: pedido.numero_pedido || null,
    metodo: cobro?.metodo || pedido.metodo_pago || null,
    estado_cobro: estadoCobro({ cobro, metodo_pago: pedido.metodo_pago }),
    monto: Number(pedido.total) || 0,
  };
}

function toCargaValidada({ notificacion, repartidor, jornada, cobros }) {
  return {
    ...toSolicitudDetalle({
      notificacion,
      repartidor,
      cargas: jornada?.cargas || [],
      dineroEsperado: jornada?.dinero_esperado,
    }),
    validado_por_nombre: jornada?.validado_por_nombre || null,
    efectivo_cobrado: Number(jornada?.efectivo_cobrado) || 0,
    virtual_cobrado: Number(jornada?.virtual_cobrado) || 0,
    cobros: cobros || [],
  };
}

function repartidorDto(repartidor) {
  if (!repartidor) return null;
  const lat = Number(repartidor.lat_actual);
  const lng = Number(repartidor.lng_actual);
  return {
    id: repartidor.id,
    nombre_completo: repartidor.nombre_completo,
    telefono: repartidor.telefono || null,
    es_prueba: Boolean(repartidor.es_prueba),
    lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
    lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
  };
}

function estadoCobro({ cobro, metodo_pago } = {}) {
  if (!cobro) return 'falta cobro';
  const transfer = Number(cobro.monto_transferencia) > 0
    || cobro.metodo === 'transferencia'
    || cobro.metodo === 'mixto'
    || metodo_pago === 'transferencia'
    || metodo_pago === 'mixto';
  if (transfer && !cobro.comprobante_path) return 'falta comprobante';
  return 'completo';
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
    fecha: diaDeFila(notificacion) || notificacion.fecha_creacion,
    hora: notificacion.hora_creacion,
    ...(datos.espera_desde ? { espera_desde: datos.espera_desde } : {}),
    ...(datos.nota ? { nota: datos.nota } : {}),
    ...(datos.llamada_atendida ? { llamada_atendida: true } : {}),
    ...(datos.fecha_propuesta ? { fecha_propuesta: datos.fecha_propuesta } : {}),
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

function estrella(notas, etiqueta) {
  const match = String(notas || '').match(new RegExp(`${etiqueta}: ([1-5])`));
  return match ? Number(match[1]) : null;
}

function lineasProducto(pedido) {
  const productos = [];
  for (const linea of pedido?.productos || []) {
    if (linea?.baja_logica) continue;
    const nombre = linea.producto?.nombre || linea.nombre;
    if (!nombre) continue;
    productos.push({
      nombre,
      cantidad: Number(linea.cantidad) || 0,
      precio_unidad: Number(linea.precio_unidad) || 0,
    });
  }
  for (const linea of pedido?.paquetes || []) {
    const nombre = linea.paquete?.nombre || linea.nombre;
    if (!nombre) continue;
    productos.push({
      nombre,
      cantidad: Number(linea.cantidad) || 0,
      precio_unidad: Number(linea.precio_unidad) || 0,
    });
  }
  return productos;
}

function toPedidoDia({ pedido, rutaPedido, ruta }) {
  const cobro = pedido.cobro_entrega || pedido.cobroEntrega || null;
  const productos = lineasProducto(pedido);
  const subtotal = productos.reduce((acc, linea) => acc + linea.cantidad * linea.precio_unidad, 0);
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
    metodo_pago: pedido.metodo_pago || null,
    orden_entrega: rutaPedido.orden_entrega ?? null,
    ruta_id: ruta?.id ?? null,
    lat: Number(rutaPedido.lat) || Number(pedido.cliente?.lat) || null,
    lng: Number(rutaPedido.lng) || Number(pedido.cliente?.lng) || null,
    repartidor: repartidorDto(ruta?.repartidor),
    ciudad_id: ruta?.fkid_ciudad ?? null,
    ciudad: ruta?.ciudad?.nombre || ruta?.ciudad?.departamento || null,
    productos,
    subtotal: subtotal || Number(pedido.total) || 0,
    total: Number(pedido.total) || 0,
    comprobante_url: comprobantePublicPath(cobro?.comprobante_path),
    codigo_oculto: pedido.codigo_entrega ? '******' : null,
    fecha_propuesta: pedido.fecha_propuesta || null,
    fecha_ruta: ruta?.fecha_ruta ? String(ruta.fecha_ruta).slice(0, 10) : null,
    fecha_incidencia: fechaIncidencia({ pedido, rutaPedido, ruta }),
    calificacion_servicio: estrella(pedido.notas, 'Calificación del servicio'),
    calificacion_cliente: estrella(pedido.notas, 'Calificación al cliente'),
    estado_cobro: estadoCobro({ cobro, metodo_pago: pedido.metodo_pago }),
    cobro: cobro ? {
      metodo: cobro.metodo,
      monto_efectivo: Number(cobro.monto_efectivo) || 0,
      monto_transferencia: Number(cobro.monto_transferencia) || 0,
      tiene_comprobante: Boolean(cobro.comprobante_path),
    } : null,
  };
}

function lineasDeFila(row) {
  const raw = row?.repartidores ?? row?.repartidorIds;
  if (Array.isArray(raw) && raw.length && typeof raw[0] === 'object') {
    return raw.map((item) => ({
      telefono: String(item.telefono || '').trim(),
      repartidorIds: [...new Set((item.repartidorIds || item.repartidor_ids || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))],
    }));
  }
  const ids = Array.isArray(raw) ? raw.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
  return [{ telefono: String(row?.telefono || '').trim(), repartidorIds: [...new Set(ids)] }];
}

function normalizarLineas(lineas) {
  if (!Array.isArray(lineas) || !lineas.length) {
    return { ok: false, statusCode: 422, message: 'Agrega un teléfono' };
  }
  const vistos = new Set();
  const numeros = [];
  for (const linea of lineas) {
    const uno = normalizarContacto({
      telefono: linea?.telefono,
      repartidorIds: linea?.repartidor_ids || linea?.repartidorIds,
    });
    if (!uno.ok) return uno;
    for (const id of uno.repartidorIds) {
      if (vistos.has(id)) return { ok: false, statusCode: 422, message: 'Un repartidor solo puede estar en un número' };
      vistos.add(id);
    }
    numeros.push({ telefono: uno.telefono, repartidorIds: uno.repartidorIds });
  }
  return { ok: true, telefono: numeros[0].telefono, numeros };
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

function cierreDirectoCheck({ rol, tieneJornada, estado }) {
  if (!puedeAutorizarExcepcion(rol)) {
    return { ok: false, statusCode: 403, message: 'Solo un super admin puede cerrar la jornada' };
  }
  if (!tieneJornada) return { ok: false, statusCode: 404, message: 'Ese repartidor no tiene jornada hoy' };
  if (estado === 'cerrada') return { ok: false, statusCode: 409, message: 'Esa jornada ya está cerrada' };
  return { ok: true };
}

function telefonoDeRepartidor(rows, repartidorId) {
  const id = Number(repartidorId);
  for (const row of rows || []) {
    const linea = lineasDeFila(row).find((item) => item.repartidorIds.includes(id) && item.telefono);
    if (linea) return String(linea.telefono);
  }
  return null;
}

function nombreRol(usuario) {
  if (usuario == null) return '';
  if (typeof usuario === 'string') return usuario;
  return String(usuario.rol?.nombre || usuario.role || '');
}

function puedeAutorizarExcepcion(rol) {
  return nombreRol(rol) === 'super_admin';
}

function toRepartidorOpcion(repartidor, paradas = 0) {
  const n = Number(paradas) || 0;
  return {
    id: repartidor.id,
    nombre_completo: repartidor.nombre_completo,
    estado: repartidor.estado,
    es_prueba: Boolean(repartidor.es_prueba),
    siniestro_completo: siniestroCompleto(repartidor),
    paradas: n,
    max_paradas: MAX_PARADAS_DIA,
    saturado: n >= MAX_PARADAS_DIA,
  };
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
  siniestroCompleto,
  puedeAsignarConSiniestro,
  stamp,
  phoneOf,
  isOpenSolicitud,
  sigueHoy,
  esDeHoy,
  isValidatedCheckIn,
  cobroDeParada,
  toCargaValidada,
  toSolicitudResumen,
  toSolicitudDetalle,
  toPedidoDia,
  fueModificado,
  comprobantePublicPath,
  estadoCobro,
  toRepartidorOpcion,
  nombreRol,
  puedeAutorizarExcepcion,
  cierreDirectoCheck,
  normalizarContacto,
  normalizarLineas,
  lineasDeFila,
  quitarRepartidores,
  telefonoDeRepartidor,
};
