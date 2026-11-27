const {
  decodePolyline,
  hashParadas,
  gpsDe,
  construirTrazado,
  geocodePedido,
  asegurarPolyline,
  refrescarPolylineRuta,
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

test('construirTrazado sirve polyline de cache y no pega HTTP', async () => {
  const httpGet = jest.fn(async () => ({ data: { status: 'OK' } }));
  const ruta = {
    id: 9,
    franja: 'manana',
    ciudad: { nombre: 'Durango' },
    fkid_repartidor: 3,
    tiempo_estimado: 12,
    distancia_estimada: 3.5,
    polyline_encoded: GOOGLE_LINE,
    polyline_hash: 'x',
    repartidor: { id: 3, lat_actual: 24.01, lng_actual: -104.65, ubicacion_at: new Date() },
    pedidos: [
      { orden_entrega: 1, estado_entrega: 'entregado', lat: 24.02, lng: -104.66, pedido: { id: 1, numero_pedido: 'P-1', direccion_entrega: 'A', cliente: { nombre_completo: 'Ana' } } },
      { orden_entrega: 2, estado_entrega: 'en_camino', lat: 24.03, lng: -104.67, pedido: { id: 2, numero_pedido: 'P-2', direccion_entrega: 'B', cliente: { nombre_completo: 'Luis' } } },
      { orden_entrega: 3, estado_entrega: 'pendiente', lat: 24.04, lng: -104.68, pedido: { id: 3, numero_pedido: 'P-3', direccion_entrega: 'C' } },
    ],
  };
  const data = await construirTrazado(ruta, { apiKey: 'k', httpGet });
  expect(httpGet).not.toHaveBeenCalled();
  expect(data.paradas).toHaveLength(3);
  expect(data.polyline).toHaveLength(3);
  expect(data.eta).toEqual({ pedido_id: 2, numero: 'P-2', minutos: 12, km: 3.5 });
  expect(data.repartidor.lat).toBe(24.01);
});

test('parada sin coords va a sin_coords sin geocode', async () => {
  const httpGet = jest.fn();
  const ruta = {
    id: 4,
    franja: 'tarde',
    pedidos: [
      { orden_entrega: 1, estado_entrega: 'pendiente', lat: null, lng: null, pedido: { id: 8, numero_pedido: 'P-8', direccion_entrega: 'Calle X' } },
    ],
  };
  const data = await construirTrazado(ruta, { apiKey: 'k', httpGet });
  expect(httpGet).not.toHaveBeenCalled();
  expect(data.paradas).toEqual([]);
  expect(data.sin_coords).toEqual([{ pedido_id: 8, direccion: 'Calle X' }]);
  expect(data.polyline).toEqual([]);
  expect(data.eta).toBe(null);
});

test('geocodePedido skipCache ignora coords pegadas al GPS', async () => {
  const resolverDireccion = jest.fn(async () => ({ lat: 24.05, lng: -104.70, formatted_address: 'Calle 1, Durango' }));
  const punto = await geocodePedido({
    direccion_entrega: 'Calle 1',
    lat: 24.0277,
    lng: -104.6532,
    cliente: { lat: 24.0277, lng: -104.6532, direccion_geo: 'calle 1', update: jest.fn() },
  }, { mapsApagada: false, skipCache: true, apiKey: 'k', resolver: { resolverDireccion } });
  expect(punto).toEqual({ lat: 24.05, lng: -104.70 });
  expect(resolverDireccion).toHaveBeenCalled();
});

test('geocodePedido no pega API si el cliente ya tiene coords', async () => {
  const resolverDireccion = jest.fn();
  const punto = await geocodePedido({
    direccion_entrega: 'Calle 1',
    cliente: { lat: 24.02, lng: -104.66, direccion_geo: 'calle 1', direccion_entrega: 'Calle 1' },
  }, { mapsApagada: false, resolver: { resolverDireccion } });
  expect(punto).toEqual({ lat: 24.02, lng: -104.66 });
  expect(resolverDireccion).not.toHaveBeenCalled();
});

test('asegurarPolyline con el mismo hash no llama Directions', async () => {
  const httpGet = jest.fn();
  const paradas = [{ orden: 1, lat: 24.02, lng: -104.66 }, { orden: 2, lat: 24.03, lng: -104.67 }];
  const hash = hashParadas(paradas);
  const ruta = { polyline_hash: hash, polyline_encoded: GOOGLE_LINE, distancia_estimada: 2, tiempo_estimado: 8 };
  const geo = await asegurarPolyline(ruta, paradas, 'k', httpGet, { mapsApagada: false });
  expect(httpGet).not.toHaveBeenCalled();
  expect(geo.cached).toBe(true);
  expect(geo.puntos).toHaveLength(3);
});

test('OVER_QUERY_LIMIT borra la polyline para trazar los pines en el orden actual', async () => {
  const httpGet = jest.fn(async () => ({ data: { status: 'OVER_QUERY_LIMIT' } }));
  const update = jest.fn();
  const ruta = { polyline_encoded: 'old', polyline_hash: null, update };
  const geo = await asegurarPolyline(
    ruta,
    [{ orden: 1, lat: 24.02, lng: -104.66 }, { orden: 2, lat: 24.03, lng: -104.67 }],
    'k',
    httpGet,
    { mapsApagada: false },
  );
  expect(geo.encoded).toBe('');
  expect(update).toHaveBeenCalledWith({ polyline_encoded: '', polyline_hash: expect.any(String) });
});

test('geocodePedido no persiste un pin aproximado', async () => {
  const update = jest.fn();
  const punto = await geocodePedido({
    direccion_entrega: 'Durango',
    cliente: { lat: null, lng: null, update },
  }, {
    mapsApagada: false,
    skipCache: true,
    apiKey: 'k',
    resolver: {
      resolverDireccion: async () => ({
        lat: 24.0277,
        lng: -104.6532,
        formatted_address: 'Durango, México',
        aproximado: true,
      }),
    },
  });
  expect(punto).toBeNull();
  expect(update).not.toHaveBeenCalled();
});

test('refrescarPolylineRuta traza sin repartidor', async () => {
  const httpGet = jest.fn(async () => ({
    data: {
      status: 'OK',
      routes: [{ overview_polyline: { points: GOOGLE_LINE }, legs: [{ distance: { value: 1200 }, duration: { value: 180 } }] }],
    },
  }));
  const ruta = {
    id: 11,
    fkid_repartidor: null,
    pedidos: [
      { orden_entrega: 1, lat: 24.02, lng: -104.66 },
      { orden_entrega: 2, lat: 24.03, lng: -104.67 },
    ],
    update: jest.fn(async (patch) => Object.assign(ruta, patch)),
  };
  await refrescarPolylineRuta(ruta, { apiKey: 'k', httpGet });
  expect(httpGet).toHaveBeenCalled();
  expect(ruta.polyline_encoded).toBe(GOOGLE_LINE);
});

test('con regresa_bodega el destino de Directions es la bodega', async () => {
  const httpGet = jest.fn(async () => ({
    data: {
      status: 'OK',
      routes: [{ overview_polyline: { points: GOOGLE_LINE }, legs: [{ distance: { value: 1200 }, duration: { value: 180 } }] }],
    },
  }));
  const ruta = {
    id: 12,
    regresa_bodega: true,
    pedidos: [
      { orden_entrega: 1, lat: 24.02, lng: -104.66 },
      { orden_entrega: 2, lat: 24.03, lng: -104.67 },
    ],
    update: jest.fn(async (patch) => Object.assign(ruta, patch)),
  };
  await refrescarPolylineRuta(ruta, { apiKey: 'k', httpGet, bodega: { lat: 24.01, lng: -104.65 } });
  const params = httpGet.mock.calls[0][1].params;
  expect(params.origin).toBe('24.01,-104.65');
  expect(params.destination).toBe('24.01,-104.65');
  expect(params.waypoints).toBe('24.02,-104.66|24.03,-104.67');
});

test('sin regresa_bodega el destino de Directions es la última parada', async () => {
  const httpGet = jest.fn(async () => ({
    data: {
      status: 'OK',
      routes: [{ overview_polyline: { points: GOOGLE_LINE }, legs: [{ distance: { value: 1200 }, duration: { value: 180 } }] }],
    },
  }));
  const ruta = {
    id: 13,
    pedidos: [
      { orden_entrega: 1, lat: 24.02, lng: -104.66 },
      { orden_entrega: 2, lat: 24.03, lng: -104.67 },
    ],
    update: jest.fn(async (patch) => Object.assign(ruta, patch)),
  };
  await refrescarPolylineRuta(ruta, { apiKey: 'k', httpGet, bodega: { lat: 24.01, lng: -104.65 } });
  const params = httpGet.mock.calls[0][1].params;
  expect(params.origin).toBe('24.02,-104.66');
  expect(params.destination).toBe('24.03,-104.67');
  expect(params.waypoints).toBeUndefined();
});

test('geocodePedido y asegurarPolyline no llaman HTTP si Maps está apagado', async () => {
  const resolverDireccion = jest.fn();
  const httpGet = jest.fn();
  await expect(geocodePedido({
    direccion_entrega: 'Calle nueva 9',
    cliente: { lat: null, lng: null, update: jest.fn() },
  }, { mapsApagada: true, resolver: { resolverDireccion }, apiKey: 'k' })).resolves.toBeNull();
  expect(resolverDireccion).not.toHaveBeenCalled();

  const ruta = { polyline_encoded: null, polyline_hash: null, update: jest.fn() };
  await asegurarPolyline(ruta, [{ orden: 1, lat: 24.02, lng: -104.66 }, { orden: 2, lat: 24.03, lng: -104.67 }], 'k', httpGet, { mapsApagada: true });
  expect(httpGet).not.toHaveBeenCalled();
});
