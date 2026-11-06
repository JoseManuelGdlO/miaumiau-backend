const crypto = require('crypto');
const axios = require('axios');
const { Logger } = require('../../utils/logger');
const { mapsApagada } = require('./apagada');

const log = new Logger('Maps');

const GPS_FRESCO_MS = 5 * 60 * 1000;
const ETA_CACHE_MS = 30 * 1000;
const etaCache = new Map();
const navCache = new Map();
const BLOQUEADOS = new Set(['OVER_QUERY_LIMIT', 'REQUEST_DENIED']);

function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const text = String(encoded || '');
  while (index < text.length) {
    let shift = 0;
    let result = 0;
    let byte;
    do {
      byte = text.charCodeAt(index++) - 63;
      result |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0;
    result = 0;
    do {
      byte = text.charCodeAt(index++) - 63;
      result |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

function hashParadas(paradas) {
  const raw = (paradas || [])
    .map((parada) => `${parada.orden}:${Number(parada.lat).toFixed(6)},${Number(parada.lng).toFixed(6)}`)
    .join('|');
  return crypto.createHash('sha1').update(raw).digest('hex');
}

function puntoDe(value) {
  if (value?.lat == null || value?.lng == null || value.lat === '' || value.lng === '') return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function gpsDe(repartidor, now = Date.now()) {
  const punto = puntoDe({ lat: repartidor?.lat_actual, lng: repartidor?.lng_actual });
  if (!punto) return null;
  const at = repartidor.ubicacion_at ? new Date(repartidor.ubicacion_at).getTime() : 0;
  return {
    ...punto,
    at: repartidor.ubicacion_at || null,
    fresco: Boolean(at) && (now - at) <= GPS_FRESCO_MS,
  };
}

function normalizarDir(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function mapsRequest(url, params, httpGet, deps = {}) {
  if (await mapsApagada(deps)) return null;
  const get = httpGet || axios.get;
  let response;
  try {
    response = await get(url, { params });
  } catch (error) {
    log.warn('Google Maps HTTP falló', { url, message: error.message });
    return null;
  }
  const status = response?.data?.status;
  if (BLOQUEADOS.has(status)) {
    log.warn('Google Maps bloqueado', { status, url });
    return null;
  }
  return response;
}

async function obtenerGeometriaRuta({ origen, destino, waypoints }, apiKey, httpGet, deps = {}) {
  const from = puntoDe(origen);
  const to = puntoDe(destino);
  if (!from || !to || !apiKey) return null;
  const params = {
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    mode: 'driving',
    key: apiKey,
  };
  const vias = (waypoints || []).map(puntoDe).filter(Boolean);
  if (vias.length) params.waypoints = vias.map((punto) => `${punto.lat},${punto.lng}`).join('|');
  const response = await mapsRequest('https://maps.googleapis.com/maps/api/directions/json', params, httpGet, deps);
  const route = response?.data?.status === 'OK' ? response.data.routes?.[0] : null;
  if (!route) return null;
  const encoded = route.overview_polyline?.points || '';
  const legs = (route.legs || []).map((leg) => ({
    km: Math.round((Number(leg.distance?.value) || 0) / 10) / 100,
    minutos: Math.round((Number(leg.duration?.value) || 0) / 60),
  }));
  const km = Math.round(legs.reduce((suma, leg) => suma + leg.km, 0) * 100) / 100;
  const minutos = legs.reduce((suma, leg) => suma + leg.minutos, 0);
  return { encoded, puntos: decodePolyline(encoded), km, minutos, legs };
}

async function calcularETA({ origen, destinos }, apiKey, httpGet, deps = {}) {
  const from = puntoDe(origen);
  const tos = (destinos || []).map(puntoDe).filter(Boolean);
  if (!from || !tos.length || !apiKey) return [];
  const response = await mapsRequest('https://maps.googleapis.com/maps/api/distancematrix/json', {
    origins: `${from.lat},${from.lng}`,
    destinations: tos.map((punto) => `${punto.lat},${punto.lng}`).join('|'),
    key: apiKey,
    units: 'metric',
    departure_time: 'now',
  }, httpGet, deps);
  if (response?.data?.status !== 'OK') return [];
  const elements = response.data.rows?.[0]?.elements || [];
  return elements.map((element, index) => {
    const duration = element.duration_in_traffic || element.duration;
    return {
      index,
      km: element.status === 'OK' ? Math.round((Number(element.distance?.value) || 0) / 10) / 100 : null,
      minutos: element.status === 'OK' ? Math.round((Number(duration?.value) || 0) / 60) : null,
    };
  });
}

async function geometriaCached(origen, destino, apiKey, httpGet, now = Date.now(), deps = {}) {
  const from = puntoDe(origen);
  const to = puntoDe(destino);
  if (!from || !to) return null;
  const key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const hit = navCache.get(key);
  if (hit && now - hit.at < ETA_CACHE_MS) return hit.geo;
  const geo = await obtenerGeometriaRuta({ origen: from, destino: to, waypoints: [] }, apiKey, httpGet, deps);
  if (geo) navCache.set(key, { at: now, geo });
  return geo;
}

async function asegurarPolyline(ruta, paradas, apiKey, httpGet, deps = {}) {
  const hash = hashParadas(paradas);
  if (ruta.polyline_hash === hash && ruta.polyline_encoded) {
    return { encoded: ruta.polyline_encoded, puntos: decodePolyline(ruta.polyline_encoded), km: Number(ruta.distancia_estimada) || 0, minutos: Number(ruta.tiempo_estimado) || 0, cached: true };
  }
  if (paradas.length < 2) {
    const puntos = paradas.map((parada) => ({ lat: Number(parada.lat), lng: Number(parada.lng) }));
    if (typeof ruta.update === 'function') {
      await ruta.update({ polyline_encoded: '', polyline_hash: hash, distancia_estimada: 0, tiempo_estimado: 0 });
    }
    return { encoded: '', puntos, km: 0, minutos: 0, cached: false };
  }
  const geo = await obtenerGeometriaRuta({
    origen: paradas[0],
    destino: paradas[paradas.length - 1],
    waypoints: paradas.slice(1, -1),
  }, apiKey, httpGet, deps);
  if (!geo) {
    return { encoded: ruta.polyline_encoded || '', puntos: ruta.polyline_encoded ? decodePolyline(ruta.polyline_encoded) : paradas.map((parada) => ({ lat: Number(parada.lat), lng: Number(parada.lng) })), km: Number(ruta.distancia_estimada) || 0, minutos: Number(ruta.tiempo_estimado) || 0, cached: false };
  }
  if (typeof ruta.update === 'function') {
    await ruta.update({
      polyline_encoded: geo.encoded,
      polyline_hash: hash,
      distancia_estimada: geo.km,
      tiempo_estimado: geo.minutos,
    });
  }
  return { ...geo, cached: false };
}

async function refrescarPolylineRuta(ruta, deps = {}) {
  if (!ruta) return null;
  const rows = [...(ruta.pedidos || [])].sort((a, b) => (Number(a.orden_entrega) || 0) - (Number(b.orden_entrega) || 0));
  const paradas = [];
  for (const rp of rows) {
    const punto = puntoDe(rp) || puntoDe(rp.pedido?.cliente);
    if (!punto) continue;
    paradas.push({ orden: Number(rp.orden_entrega) || paradas.length + 1, lat: punto.lat, lng: punto.lng });
  }
  return asegurarPolyline(ruta, paradas, deps.apiKey || process.env.GOOGLE_MAPS_API_KEY, deps.httpGet, deps);
}

function polylineDesdeCache(ruta, paradas) {
  if (ruta?.polyline_encoded) return decodePolyline(ruta.polyline_encoded);
  return paradas.map((parada) => ({ lat: Number(parada.lat), lng: Number(parada.lng) }));
}

async function etaProxima(rutaId, origen, siguiente, apiKey, httpGet, now = Date.now(), cache = etaCache, deps = {}) {
  if (!siguiente || !puntoDe(origen)) return null;
  const key = String(rutaId);
  const hit = cache.get(key);
  if (hit && now - hit.at < ETA_CACHE_MS && hit.pedido_id === siguiente.pedido_id) return hit.eta;
  const rows = await calcularETA({ origen, destinos: [siguiente] }, apiKey, httpGet, deps);
  const first = rows[0];
  if (first?.minutos == null) return null;
  const eta = { pedido_id: siguiente.pedido_id, numero: siguiente.numero, minutos: first.minutos, km: first.km };
  cache.set(key, { at: now, pedido_id: siguiente.pedido_id, eta });
  return eta;
}

function dtoParada(rp) {
  const pedido = rp.pedido || {};
  return {
    orden: Number(rp.orden_entrega) || 0,
    pedido_id: pedido.id || rp.fkid_pedido,
    numero: pedido.numero_pedido || null,
    cliente: pedido.cliente?.nombre_completo || null,
    lat: Number(rp.lat),
    lng: Number(rp.lng),
    direccion: pedido.direccion_entrega || null,
    estado_entrega: rp.estado_entrega || 'pendiente',
  };
}

function cacheClienteVale(cliente, geo) {
  const punto = puntoDe(cliente);
  if (!punto) return null;
  if (!geo) return punto;
  if (cliente.direccion_geo) return cliente.direccion_geo === geo ? punto : null;
  return normalizarDir(cliente.direccion_entrega) === geo ? punto : null;
}

async function cargarCliente(pedido, deps = {}) {
  if (pedido?.cliente && (pedido.cliente.lat != null || typeof pedido.cliente.update === 'function')) {
    return pedido.cliente;
  }
  const id = pedido?.fkid_cliente || pedido?.cliente?.id;
  if (!id) return pedido?.cliente || null;
  const Cliente = deps.Cliente || require('../../models').Cliente;
  return Cliente.findByPk(id);
}

async function persistirCliente(cliente, punto, geo) {
  if (!cliente || typeof cliente.update !== 'function' || !punto) return;
  await cliente.update({ lat: punto.lat, lng: punto.lng, direccion_geo: geo });
  cliente.lat = punto.lat;
  cliente.lng = punto.lng;
  cliente.direccion_geo = geo;
}

async function geocodePedido(pedido, deps = {}) {
  if (!pedido?.direccion_entrega) return null;
  const geo = normalizarDir(pedido.direccion_entrega);
  const cliente = await cargarCliente(pedido, deps);
  const cachedCliente = cacheClienteVale(cliente, geo);
  if (cachedCliente) return cachedCliente;
  const cachedPedido = puntoDe(pedido);
  if (cachedPedido) {
    await persistirCliente(cliente, cachedPedido, geo);
    return cachedPedido;
  }
  if (await mapsApagada(deps)) return null;
  const apiKey = deps.apiKey || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  const maps = deps.resolver || require('./controller');
  let ciudad = pedido.ciudad;
  if (!ciudad && pedido.fkid_ciudad) {
    const City = deps.City || require('../../models').City;
    ciudad = await City.findByPk(pedido.fkid_ciudad, { attributes: ['id', 'nombre', 'departamento'] });
  }
  const estado = ciudad?.departamento || null;
  const punto = await maps.resolverDireccion({
    address: pedido.direccion_entrega,
    ciudad: ciudad?.nombre,
    estado,
  }, apiKey);
  if (!punto) return null;
  if (estado && maps.enElEstado && !maps.enElEstado(punto.formatted_address, estado)) return null;
  const coords = { lat: punto.lat, lng: punto.lng };
  await persistirCliente(cliente, coords, geo);
  return coords;
}

async function construirTrazado(ruta, deps = {}) {
  const now = deps.now || Date.now();
  const rows = [...(ruta.pedidos || [])].sort((a, b) => (Number(a.orden_entrega) || 0) - (Number(b.orden_entrega) || 0));
  const sin_coords = [];
  const paradas = [];
  for (const rp of rows) {
    const punto = puntoDe(rp) || puntoDe(rp.pedido?.cliente);
    if (!punto) {
      sin_coords.push({
        pedido_id: rp.pedido?.id || rp.fkid_pedido,
        direccion: rp.pedido?.direccion_entrega || null,
      });
      continue;
    }
    rp.lat = punto.lat;
    rp.lng = punto.lng;
    paradas.push(dtoParada(rp));
  }
  const polyline = polylineDesdeCache(ruta, paradas);
  const gps = gpsDe(ruta.repartidor, now);
  const siguiente = paradas.find((parada) => parada.estado_entrega === 'en_camino')
    || paradas.find((parada) => parada.estado_entrega === 'pendiente');
  const minutos = Number(ruta.tiempo_estimado);
  const km = Number(ruta.distancia_estimada);
  const eta = siguiente && Number.isFinite(minutos) && minutos > 0
    ? { pedido_id: siguiente.pedido_id, numero: siguiente.numero, minutos, km: Number.isFinite(km) ? km : null }
    : null;
  return {
    ruta_id: ruta.id,
    franja: ruta.franja === 'tarde' ? 'tarde' : 'manana',
    ciudad: ruta.ciudad?.nombre || ruta.ciudad?.departamento || null,
    repartidor: {
      id: ruta.repartidor?.id || ruta.fkid_repartidor || null,
      lat: gps?.lat ?? null,
      lng: gps?.lng ?? null,
      ubicacion_at: gps?.at ?? null,
    },
    paradas,
    polyline,
    eta,
    sin_coords,
  };
}

module.exports = {
  decodePolyline,
  hashParadas,
  gpsDe,
  puntoDe,
  normalizarDir,
  mapsRequest,
  obtenerGeometriaRuta,
  calcularETA,
  geometriaCached,
  asegurarPolyline,
  refrescarPolylineRuta,
  etaProxima,
  construirTrazado,
  geocodePedido,
  GPS_FRESCO_MS,
  ETA_CACHE_MS,
};
