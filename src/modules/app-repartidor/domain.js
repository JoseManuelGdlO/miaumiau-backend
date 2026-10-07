const crypto = require('crypto');

const META_DIARIA = 8;
const PUNTOS_POR_ENTREGA = 10;
const LOGRO_CODES = ['primera_entrega', 'ruta_rapida', 'cien_puntos', 'racha_cinco_dias', 'heroe_cien_entregas'];

function buildDeliveryCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
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
};
