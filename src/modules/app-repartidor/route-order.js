const BODEGA_ID = '__bodega__';
const { franjaDeHorario } = require('../pedidos/horario');

function nearestNeighbor(ids, matrix) {
  if (!Array.isArray(ids) || ids.length < 2) return ids || [];
  const remaining = new Set(ids.map((_, index) => index));
  const order = [0];
  remaining.delete(0);
  while (remaining.size) {
    const from = order[order.length - 1];
    let best = null;
    let bestDist = Infinity;
    for (const index of remaining) {
      const dist = Number(matrix?.[from]?.[index]);
      const value = Number.isFinite(dist) ? dist : Infinity;
      if (value < bestDist) {
        bestDist = value;
        best = index;
      }
    }
    if (best == null) break;
    order.push(best);
    remaining.delete(best);
  }
  return order.map((index) => ids[index]);
}

async function distanceMatrix(stops, apiKey, httpGet) {
  const get = httpGet || require('axios').get;
  const points = stops.map((stop) => `${stop.lat},${stop.lng}`).join('|');
  const response = await get('https://maps.googleapis.com/maps/api/distancematrix/json', {
    params: {
      origins: points,
      destinations: points,
      key: apiKey,
      units: 'metric',
    },
  });
  if (response.data?.status !== 'OK') return null;
  return (response.data.rows || []).map((row) => (
    (row.elements || []).map((element) => (
      element.status === 'OK' ? Number(element.distance?.value) : Infinity
    ))
  ));
}

function ordenDesdeBodega(paradaIds, matrix) {
  if (!Array.isArray(paradaIds) || paradaIds.length === 0) return paradaIds || [];
  if (paradaIds.length === 1) return paradaIds;
  return nearestNeighbor([BODEGA_ID, ...paradaIds], matrix).filter((id) => id !== BODEGA_ID);
}

function ordenSinPisarManual(rows, orderedIds) {
  const manual = (rows || []).filter((row) => row.orden_manual);
  const manualIds = new Set(manual.map((row) => row.id));
  const autoOrdered = (orderedIds || []).filter((id) => !manualIds.has(id));
  const occupied = new Set(
    manual.map((row) => Number(row.orden_entrega)).filter((value) => value >= 1),
  );
  const slots = [];
  let pos = 1;
  while (slots.length < autoOrdered.length && pos < 10000) {
    if (!occupied.has(pos)) slots.push(pos);
    pos += 1;
  }
  return autoOrdered.map((id, index) => ({ id, orden_entrega: slots[index] }));
}

function metrosLinea(a, b) {
  const lat1 = Number(a?.lat);
  const lng1 = Number(a?.lng);
  const lat2 = Number(b?.lat);
  const lng2 = Number(b?.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
  const kmLat = (lat2 - lat1) * 111;
  const kmLng = (lng2 - lng1) * 111 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return Math.hypot(kmLat, kmLng) * 1000;
}

function matrizLinea(stops) {
  return (stops || []).map((from, i) => (
    (stops || []).map((to, j) => (i === j ? 0 : metrosLinea(from, to)))
  ));
}

function costo(matrix, from, to) {
  const value = Number(matrix?.[from]?.[to]);
  return Number.isFinite(value) ? value : Infinity;
}

function indexOfIds(ids) {
  const map = new Map();
  (ids || []).forEach((id, index) => map.set(id, index + 1));
  return map;
}

function nearestFrom(ids, matrix, indexOf, startIdx) {
  if (!ids.length) return [];
  const remaining = new Set(ids);
  const order = [];
  let current = startIdx;
  while (remaining.size) {
    let best = null;
    let bestDist = Infinity;
    for (const id of remaining) {
      const dist = costo(matrix, current, indexOf.get(id));
      if (dist < bestDist) {
        bestDist = dist;
        best = id;
      }
    }
    if (best == null || bestDist === Infinity) break;
    order.push(best);
    remaining.delete(best);
    current = indexOf.get(best);
  }
  for (const id of ids) {
    if (remaining.has(id)) order.push(id);
  }
  return order;
}

function cadenaMezclada(rows, byId) {
  const ordered = (rows || []).slice().sort((a, b) => (Number(a.orden_entrega) || 0) - (Number(b.orden_entrega) || 0));
  let seenTarde = false;
  for (const row of ordered) {
    const franja = franjaDeHorario(byId.get(row.id)?.horario);
    if (franja === 'tarde') seenTarde = true;
    if (franja === 'manana' && seenTarde) return true;
  }
  return false;
}

function huecosLegales(chain, byId, nuevo, mezclada) {
  const positions = [];
  for (let i = 0; i <= chain.length; i += 1) positions.push(i);
  const franja = franjaDeHorario(nuevo.horario);
  if (mezclada || !franja) return positions;
  return positions.filter((i) => {
    if (franja === 'manana') {
      return !chain.slice(0, i).some((id) => franjaDeHorario(byId.get(id)?.horario) === 'tarde');
    }
    return !chain.slice(i).some((id) => franjaDeHorario(byId.get(id)?.horario) === 'manana');
  });
}

function insertarEnHueco(chain, nuevo, matrix, indexOf, byId, mezclada) {
  const huecos = huecosLegales(chain, byId, nuevo, mezclada);
  const candidatos = huecos.length ? huecos : [chain.length];
  let bestPos = candidatos[0];
  let bestCost = Infinity;
  for (const i of candidatos) {
    const prev = i === 0 ? 0 : indexOf.get(chain[i - 1]);
    const next = i === chain.length ? null : chain[i];
    const toNew = costo(matrix, prev, indexOf.get(nuevo.id));
    const extra = next == null
      ? toNew
      : toNew + costo(matrix, indexOf.get(nuevo.id), indexOf.get(next)) - costo(matrix, prev, indexOf.get(next));
    if (extra < bestCost) {
      bestCost = extra;
      bestPos = i;
    }
  }
  const out = chain.slice();
  out.splice(bestPos, 0, nuevo.id);
  return out;
}

function ordenRuta(paradas, matrix, modo) {
  const ids = (paradas || []).map((parada) => parada.id);
  if (ids.length <= 1) return ids;
  const indexOf = indexOfIds(ids);
  const byId = new Map((paradas || []).map((parada) => [parada.id, parada]));

  if (paradas.some((parada) => parada.orden_manual)) {
    const fijos = paradas
      .filter((parada) => parada.orden_manual)
      .sort((a, b) => (Number(a.orden_entrega) || 0) - (Number(b.orden_entrega) || 0));
    const mezclada = cadenaMezclada(fijos, byId);
    let chain = fijos.map((parada) => parada.id);
    for (const nuevo of paradas.filter((parada) => !parada.orden_manual)) {
      chain = insertarEnHueco(chain, nuevo, matrix, indexOf, byId, mezclada);
    }
    return chain;
  }

  if (modo !== 'hora') return ordenDesdeBodega(ids, matrix);

  const manana = paradas.filter((parada) => franjaDeHorario(parada.horario) === 'manana').map((parada) => parada.id);
  const tarde = paradas.filter((parada) => franjaDeHorario(parada.horario) === 'tarde').map((parada) => parada.id);
  const libres = paradas.filter((parada) => !franjaDeHorario(parada.horario));
  const mananaOrden = nearestFrom(manana, matrix, indexOf, 0);
  const startTarde = mananaOrden.length ? indexOf.get(mananaOrden[mananaOrden.length - 1]) : 0;
  const tardeOrden = nearestFrom(tarde, matrix, indexOf, startTarde);
  let chain = [...mananaOrden, ...tardeOrden];
  for (const libre of libres) {
    chain = insertarEnHueco(chain, libre, matrix, indexOf, byId, false);
  }
  return chain;
}

function franjaEnCadena(chain, id, byId) {
  const fija = franjaDeHorario(byId.get(id)?.horario);
  if (fija) return fija;
  const idx = chain.indexOf(id);
  for (let i = 0; i < idx; i += 1) {
    if (franjaDeHorario(byId.get(chain[i])?.horario) === 'tarde') return 'tarde';
  }
  return 'manana';
}

function asignacionesDeOrden(paradas, chain) {
  const byId = new Map((paradas || []).map((parada) => [parada.id, parada]));
  return (chain || []).map((id, index) => ({
    id,
    orden_entrega: index + 1,
    franja: franjaEnCadena(chain, id, byId),
  }));
}

module.exports = {
  nearestNeighbor,
  ordenDesdeBodega,
  distanceMatrix,
  ordenSinPisarManual,
  matrizLinea,
  ordenRuta,
  asignacionesDeOrden,
  BODEGA_ID,
};
