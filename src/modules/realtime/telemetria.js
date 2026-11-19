const TOPE_KMH = 130;
const MIN_DELTA_SEG = 0.5;
const DEADBAND_M = 5;
const DEADBAND_KMH = 3.5;

function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function lecturaAceptable(previo, lat, lng, timestamp, velocidadGpsMs) {
  const deltaTiempoSeg = (timestamp - previo.timestamp) / 1000;
  if (deltaTiempoSeg <= MIN_DELTA_SEG) return { ok: false, alertaGps: false };
  const distancia = distanciaMetros(previo.lat, previo.lng, lat, lng);
  const calculadaKmh = (distancia / deltaTiempoSeg) * 3.6;
  if (calculadaKmh > TOPE_KMH) return { ok: false, alertaGps: true };
  let realKmh = calculadaKmh;
  const speed = Number(velocidadGpsMs);
  if (Number.isFinite(speed) && speed >= 0) {
    const gpsKmh = speed * 3.6;
    if (gpsKmh > TOPE_KMH) return { ok: false, alertaGps: true };
    realKmh = gpsKmh * 0.7 + calculadaKmh * 0.3;
  }
  if (realKmh > TOPE_KMH) return { ok: false, alertaGps: true };
  const detenido = distancia < DEADBAND_M || realKmh < DEADBAND_KMH;
  return { ok: true, alertaGps: false, distancia, deltaTiempoSeg, realKmh, detenido };
}

function inicial(lat, lng, timestamp) {
  return {
    lat,
    lng,
    timestamp,
    velocidadActualKmh: 0,
    velocidadPromedioKmh: 0,
    distanciaTotalMetros: 0,
    tiempoEnMovimientoSeg: 0,
    historialVelocidades: [],
    estadoMovimiento: 'detenido',
    alertaGps: false,
    aceptado: true,
  };
}

function crearFiltro() {
  const estados = new Map();

  function procesar(data) {
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    const timestamp = Number(data.timestamp);
    const id = Number(data.repartidorId);
    if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(timestamp)) {
      return null;
    }
    const previo = estados.get(id);
    if (!previo) {
      const primero = inicial(lat, lng, timestamp);
      estados.set(id, primero);
      return primero;
    }
    const paso = lecturaAceptable(previo, lat, lng, timestamp, data.velocidadGpsMs);
    if (!paso.ok) {
      return { ...previo, alertaGps: paso.alertaGps, aceptado: false };
    }
    const { distancia, deltaTiempoSeg, realKmh, detenido } = paso;
    if (detenido) {
      const parado = {
        ...previo,
        lat,
        lng,
        timestamp,
        velocidadActualKmh: 0,
        estadoMovimiento: 'detenido',
        alertaGps: false,
        aceptado: true,
      };
      estados.set(id, parado);
      return parado;
    }
    const historial = [...previo.historialVelocidades, realKmh].slice(-5);
    const actual = historial.reduce((acc, val) => acc + val, 0) / historial.length;
    const distanciaTotal = previo.distanciaTotalMetros + distancia;
    const tiempoMovimiento = previo.tiempoEnMovimientoSeg + deltaTiempoSeg;
    const enRuta = {
      lat,
      lng,
      timestamp,
      velocidadActualKmh: Math.round(actual),
      velocidadPromedioKmh: Math.round((distanciaTotal / tiempoMovimiento) * 3.6),
      distanciaTotalMetros: Math.round(distanciaTotal),
      tiempoEnMovimientoSeg: Math.round(tiempoMovimiento),
      historialVelocidades: historial,
      estadoMovimiento: 'en_movimiento',
      alertaGps: false,
      aceptado: true,
    };
    estados.set(id, enRuta);
    return enRuta;
  }

  return { procesar, estados };
}

function promedioDeLecturas(rows) {
  const ordenadas = [...rows].sort((a, b) => {
    const ta = new Date(a.created_at || a.fecha || 0).getTime();
    const tb = new Date(b.created_at || b.fecha || 0).getTime();
    return ta - tb;
  });
  let distancia = 0;
  let tiempo = 0;
  let last = null;
  for (const row of ordenadas) {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    const at = new Date(row.created_at || 0).getTime();
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(at) || at <= 0) {
      last = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, at } : last;
      continue;
    }
    if (!last) {
      last = { lat, lng, at };
      continue;
    }
    const delta = (at - last.at) / 1000;
    if (delta <= MIN_DELTA_SEG) continue;
    const metros = distanciaMetros(last.lat, last.lng, lat, lng);
    const kmh = (metros / delta) * 3.6;
    last = { lat, lng, at };
    if (kmh > TOPE_KMH || metros < DEADBAND_M || kmh < DEADBAND_KMH) continue;
    distancia += metros;
    tiempo += delta;
  }
  if (tiempo <= 0) return { promedio: null, lecturas: rows.length };
  return { promedio: Math.round((distancia / tiempo) * 3.6 * 10) / 10, lecturas: rows.length };
}

module.exports = { crearFiltro, promedioDeLecturas, distanciaMetros, TOPE_KMH, lecturaAceptable };
