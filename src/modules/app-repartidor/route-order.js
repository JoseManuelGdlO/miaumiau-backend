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

module.exports = {
  nearestNeighbor,
  distanceMatrix,
};
