const crypto = require('crypto');

const META_DIARIA = 8;
const PUNTOS_POR_ENTREGA = 10;
const LOGRO_CODES = ['primera_entrega', 'ruta_rapida', 'cien_puntos', 'racha_cinco_dias', 'heroe_cien_entregas'];

function buildDeliveryCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function packageCodeComponents(codigo) {
  const text = String(codigo);
  return [
    { type: 'body', parameters: [{ type: 'text', text }] },
    { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text }] },
  ];
}

function codesMatch(stored, typed) {
  const a = String(stored || '');
  const b = String(typed || '').replace(/\D/g, '').slice(0, 6);
  if (a.length !== 6 || b.length !== 6) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function applyLoadChange({ estado, changed }) {
  if (!changed) return { statusCode: 200, estado, cancelarSolicitud: false };
  if (estado === 'esperando_call_center') {
    return { statusCode: 409, estado: 'borrador', cancelarSolicitud: true };
  }
  if (estado === 'validada' || estado === 'cerrada') {
    return { statusCode: 200, estado: 'borrador', cancelarSolicitud: false };
  }
  return { statusCode: 200, estado: 'borrador', cancelarSolicitud: false };
}

function checkInOpens({ leida, vigente, estadoSolicitud }) {
  return Boolean(leida && vigente && estadoSolicitud === 'abierta');
}

function canListOrders(estadoJornada) {
  return estadoJornada === 'validada' || estadoJornada === 'cerrada';
}

function moneyCents(value) {
  return Math.round(Number(value) * 100) || 0;
}

function validatePayment({ metodo, total, efectivo, transferencia, hasPhoto }) {
  const cash = moneyCents(efectivo);
  const wire = moneyCents(transferencia);
  const due = moneyCents(total);
  if (metodo === 'efectivo') {
    return { ok: cash === due, message: 'El efectivo debe cubrir el total' };
  }
  if (metodo === 'transferencia') {
    if (!hasPhoto) return { ok: false, message: 'La transferencia requiere foto del comprobante' };
    return { ok: wire === due, message: 'La transferencia debe cubrir el total' };
  }
  if (metodo === 'mixto') {
    if (!hasPhoto) return { ok: false, message: 'El pago mixto requiere foto del comprobante' };
    return { ok: cash > 0 && wire > 0 && cash + wire === due, message: 'Efectivo más transferencia debe ser el total' };
  }
  if (metodo === 'terminal') {
    return { ok: wire === due, message: 'El cobro con terminal debe cubrir el total' };
  }
  return { ok: false, message: 'Método de pago inválido' };
}

function validateStock({ carga, entregado, items }) {
  const restante = new Map();
  for (const line of carga) restante.set(line.nombre, Number(line.cantidad) || 0);
  for (const line of entregado) {
    restante.set(line.nombre, (restante.get(line.nombre) || 0) - (Number(line.cantidad) || 0));
  }
  for (const line of items) {
    const left = restante.get(line.nombre) || 0;
    if ((Number(line.cantidad) || 0) > left) {
      return { ok: false, message: `No hay suficiente carga de ${line.nombre}` };
    }
  }
  return { ok: true };
}

function nextPoints(saldo) {
  return { puntos: PUNTOS_POR_ENTREGA, saldo: (Number(saldo) || 0) + PUNTOS_POR_ENTREGA };
}

function evaluateLogros({ totalEntregas, entregasHoy, saldo, rachaDias }) {
  const unlocked = [];
  if (totalEntregas >= 1) unlocked.push('primera_entrega');
  if (entregasHoy >= 5) unlocked.push('ruta_rapida');
  if (saldo >= 100) unlocked.push('cien_puntos');
  if (rachaDias >= 5) unlocked.push('racha_cinco_dias');
  if (totalEntregas >= 100) unlocked.push('heroe_cien_entregas');
  return unlocked;
}

function emptyLogros() {
  return LOGRO_CODES.map((codigo) => ({ codigo, desbloqueado_en: null }));
}

function stripPhone(cliente) {
  if (!cliente) return null;
  const { telefono, ...rest } = cliente;
  return rest;
}

function precioNoNulo(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function nombreCarga(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function fkidProducto(value) {
  if (value == null || value === '') return null;
  const id = Number(value);
  return Number.isNaN(id) ? null : id;
}

function agruparCarga(lineas) {
  const groups = new Map();
  for (const line of lineas || []) {
    const fkid = fkidProducto(line.fkid_producto);
    const nombre = nombreCarga(line.nombre);
    const key = nombre ? `nombre:${nombre.toLowerCase()}` : (fkid == null ? '' : `id:${fkid}`);
    if (!key) continue;
    const cantidad = Number(line.cantidad) || 0;
    const precio = precioNoNulo(line.precio_unitario);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        fkid_producto: fkid,
        nombre,
        cantidad,
        precio_unitario: precio,
        es_extra: false,
        ...(line.id != null ? { id: line.id } : {}),
      });
      continue;
    }
    existing.cantidad += cantidad;
    if (existing.precio_unitario == null && precio != null) existing.precio_unitario = precio;
    if (!existing.nombre && nombre) existing.nombre = nombre;
    if (existing.fkid_producto == null && fkid != null) existing.fkid_producto = fkid;
  }
  return [...groups.values()].map((row) => ({
    ...row,
    precio_unitario: row.precio_unitario == null ? 0 : row.precio_unitario,
  }));
}

function agruparCargasLeidas(lineas) {
  const pedidos = [];
  const extras = [];
  for (const line of lineas || []) {
    (line && line.es_extra ? extras : pedidos).push(line);
  }
  return [
    ...agruparCarga(pedidos),
    ...agruparCarga(extras).map((row) => ({ ...row, es_extra: true })),
  ];
}

function lineasDeProductos(rows) {
  const raw = [];
  for (const prod of rows || []) {
    if (prod && prod.baja_logica) continue;
    const nombre = nombreCarga(prod?.producto?.nombre || prod?.nombre);
    const fkid = fkidProducto(prod?.fkid_producto ?? prod?.producto?.id);
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
  return agruparCarga(raw).map((row) => ({
    fkid_producto: row.fkid_producto,
    nombre: row.nombre,
    cantidad: row.cantidad,
    precio_unidad: row.precio_unitario,
  }));
}

function restarLineas(base, quitar) {
  const map = new Map(base.map((row) => [String(row.nombre || '').toLowerCase(), { ...row }]));
  for (const row of quitar || []) {
    const key = String(row.nombre || '').toLowerCase();
    const existing = map.get(key);
    if (!existing) continue;
    existing.cantidad -= Number(row.cantidad) || 0;
    if (existing.cantidad <= 0) map.delete(key);
  }
  return [...map.values()];
}

function desglosePedido(pedido) {
  const extra = String(pedido?.numero_pedido || '').startsWith('EXTRA-');
  const paquetes = [];
  for (const pp of pedido?.paquetes || []) {
    const factor = Number(pp.cantidad) || 0;
    const nombre = nombreCarga(pp.paquete?.nombre);
    const productos = lineasDeProductos((pp.paquete?.productos || []).map((item) => ({
      ...item,
      cantidad: (Number(item.cantidad) || 0) * factor,
    })));
    if (!nombre && !productos.length) continue;
    paquetes.push({ nombre, cantidad: factor, productos });
  }
  const sueltos = lineasDeProductos(pedido?.productos);
  return {
    sueltos: extra ? restarLineas(sueltos, paquetes.flatMap((pack) => pack.productos)) : sueltos,
    paquetes,
  };
}

const AYUDA_CODIGO_MS = 15 * 60 * 1000;

function ayudaCodigoVencida(esperaDesde, now) {
  const start = Date.parse(esperaDesde || '');
  if (!Number.isFinite(start)) return false;
  const moment = now instanceof Date ? now.getTime() : Number(now);
  return moment - start >= AYUDA_CODIGO_MS;
}

function avisaReagendo(motivo) {
  return motivo === 'nadie' || motivo === 'reagendar';
}

function urlFoto(valor) {
  const name = String(valor || '').split(/[/\\]/).pop();
  if (!name || name === '.' || name === '..' || !/^[a-zA-Z0-9._-]+$/.test(name)) return null;
  return `/uploads/repartidores/${name}`;
}

function dayKey(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

module.exports = {
  META_DIARIA,
  PUNTOS_POR_ENTREGA,
  LOGRO_CODES,
  buildDeliveryCode,
  packageCodeComponents,
  codesMatch,
  applyLoadChange,
  checkInOpens,
  canListOrders,
  validatePayment,
  validateStock,
  nextPoints,
  evaluateLogros,
  emptyLogros,
  stripPhone,
  dayKey,
  agruparCarga,
  agruparCargasLeidas,
  desglosePedido,
  ayudaCodigoVencida,
  avisaReagendo,
  urlFoto,
};
