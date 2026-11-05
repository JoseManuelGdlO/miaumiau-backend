const {
  decodePolyline,
  hashParadas,
  gpsDe,
  construirTrazado,
  GPS_FRESCO_MS,
} = require('./google');

const GOOGLE_LINE = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

test('decodePolyline lee el encoded de Google', () => {
  const puntos = decodePolyline(GOOGLE_LINE);
  expect(puntos).toHaveLength(3);
  expect(puntos[0].lat).toBeCloseTo(38.5, 3);
  expect(puntos[0].lng).toBeCloseTo(-120.2, 3);
  expect(puntos[2].lat).toBeCloseTo(43.252, 3);
});

test('hashParadas cambia si se mueve una parada', () => {
  const a = hashParadas([{ orden: 1, lat: 24.02, lng: -104.66 }, { orden: 2, lat: 24.03, lng: -104.67 }]);
  const b = hashParadas([{ orden: 1, lat: 24.02, lng: -104.66 }, { orden: 2, lat: 24.04, lng: -104.67 }]);
  expect(a).not.toBe(b);
});

test('gpsDe marca fresco solo si la lectura es reciente', () => {
  const now = 1_700_000_000_000;
  expect(gpsDe({ lat_actual: 24, lng_actual: -104, ubicacion_at: new Date(now - 60_000) }, now).fresco).toBe(true);
  expect(gpsDe({ lat_actual: 24, lng_actual: -104, ubicacion_at: new Date(now - GPS_FRESCO_MS - 1) }, now).fresco).toBe(false);
  expect(gpsDe({ lat_actual: null, lng_actual: null })).toBe(null);
});

test('construirTrazado cachea polyline y arma ETA', async () => {
  const etaCache = new Map();
  const calls = [];
  const httpGet = async (url) => {
    calls.push(url);
    if (String(url).includes('directions')) {
      return {
        data: {
          status: 'OK',
          routes: [{
            overview_polyline: { points: GOOGLE_LINE },
            legs: [
              { distance: { value: 2400 }, duration: { value: 720 } },
              { distance: { value: 1100 }, duration: { value: 300 } },
            ],
          }],
        },
      };
    }
    return {
      data: {
        status: 'OK',
        rows: [{ elements: [{ status: 'OK', distance: { value: 2400 }, duration: { value: 720 }, duration_in_traffic: { value: 600 } }] }],
      },
    };
  };
  const ruta = {
    id: 9,
    franja: 'manana',
    ciudad: { nombre: 'Durango' },
    fkid_repartidor: 3,
    repartidor: { id: 3, lat_actual: 24.01, lng_actual: -104.65, ubicacion_at: new Date() },
    polyline_encoded: null,
    polyline_hash: null,
    update: async (fields) => Object.assign(ruta, fields),
    pedidos: [
      { orden_entrega: 1, estado_entrega: 'entregado', lat: 24.02, lng: -104.66, pedido: { id: 1, numero_pedido: 'P-1', direccion_entrega: 'A', cliente: { nombre_completo: 'Ana' } } },
      { orden_entrega: 2, estado_entrega: 'en_camino', lat: 24.03, lng: -104.67, pedido: { id: 2, numero_pedido: 'P-2', direccion_entrega: 'B', cliente: { nombre_completo: 'Luis' } } },
      { orden_entrega: 3, estado_entrega: 'pendiente', lat: 24.04, lng: -104.68, pedido: { id: 3, numero_pedido: 'P-3', direccion_entrega: 'C' } },
    ],
  };
  const first = await construirTrazado(ruta, { apiKey: 'k', httpGet, etaCache });
  expect(first.paradas).toHaveLength(3);
  expect(first.polyline).toHaveLength(3);
  expect(first.eta).toEqual({ pedido_id: 2, numero: 'P-2', minutos: 10, km: 2.4 });
  expect(first.repartidor.lat).toBe(24.01);
  expect(ruta.polyline_encoded).toBe(GOOGLE_LINE);
  const second = await construirTrazado(ruta, { apiKey: 'k', httpGet, etaCache });
  expect(calls.filter((url) => String(url).includes('directions'))).toHaveLength(1);
  expect(second.polyline).toHaveLength(3);
});

test('parada sin coords y geocode fallido va a sin_coords', async () => {
  const ruta = {
    id: 4,
    franja: 'tarde',
    pedidos: [
      { orden_entrega: 1, estado_entrega: 'pendiente', lat: null, lng: null, pedido: { id: 8, numero_pedido: 'P-8', direccion_entrega: 'Calle X' } },
    ],
    update: async (fields) => Object.assign(ruta, fields),
  };
  const data = await construirTrazado(ruta, {
    apiKey: 'k',
    geocode: async () => null,
    httpGet: async () => ({ data: { status: 'ZERO_RESULTS' } }),
  });
  expect(data.paradas).toEqual([]);
  expect(data.sin_coords).toEqual([{ pedido_id: 8, direccion: 'Calle X' }]);
  expect(data.polyline).toEqual([]);
  expect(data.eta).toBe(null);
});
