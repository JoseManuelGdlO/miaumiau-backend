const { crearFiltro, promedioDeLecturas, distanciaMetros } = require('./telemetria');

function tick(filtro, extra) {
  return filtro.procesar({
    repartidorId: 4,
    lat: 24.0277,
    lng: -104.6532,
    timestamp: 1_000_000,
    ...extra,
  });
}

test('primer punto queda detenido en 0', () => {
  const filtro = crearFiltro();
  const estado = tick(filtro);
  expect(estado.velocidadActualKmh).toBe(0);
  expect(estado.estadoMovimiento).toBe('detenido');
  expect(estado.aceptado).toBe(true);
});

test('deriva de 4 m no suma al promedio', () => {
  const filtro = crearFiltro();
  tick(filtro);
  const norte = 24.0277 + 4 / 111320;
  const estado = tick(filtro, { lat: norte, timestamp: 1_008_000 });
  expect(estado.velocidadActualKmh).toBe(0);
  expect(estado.estadoMovimiento).toBe('detenido');
  expect(estado.distanciaTotalMetros).toBe(0);
});

test('salto de más de 130 km/h no mueve el pin', () => {
  const filtro = crearFiltro();
  const primero = tick(filtro);
  const estado = tick(filtro, { lat: 24.2, timestamp: 1_002_000 });
  expect(estado.alertaGps).toBe(true);
  expect(estado.aceptado).toBe(false);
  expect(estado.lat).toBe(primero.lat);
});

test('un tramo real acumula distancia y promedio', () => {
  const filtro = crearFiltro();
  tick(filtro);
  const metros = 200;
  const lat = 24.0277 + metros / 111320;
  const estado = tick(filtro, { lat, timestamp: 1_018_000 });
  expect(estado.aceptado).toBe(true);
  expect(estado.estadoMovimiento).toBe('en_movimiento');
  expect(estado.distanciaTotalMetros).toBeGreaterThan(150);
  expect(estado.velocidadPromedioKmh).toBeGreaterThan(20);
  expect(estado.velocidadPromedioKmh).toBeLessThan(60);
});

test('promedioDeLecturas ignora semáforo y salto', () => {
  const t0 = '2026-11-05T18:00:00.000Z';
  const t1 = '2026-11-05T18:00:08.000Z';
  const t2 = '2026-11-05T18:00:26.000Z';
  const t3 = '2026-11-05T18:00:28.000Z';
  const norte = 24.0277 + 200 / 111320;
  const { promedio, lecturas } = promedioDeLecturas([
    { lat: 24.0277, lng: -104.6532, created_at: t0, velocidad_kmh: 0 },
    { lat: 24.0277 + 3 / 111320, lng: -104.6532, created_at: t1, velocidad_kmh: 4 },
    { lat: norte, lng: -104.6532, created_at: t2, velocidad_kmh: 40 },
    { lat: 24.4, lng: -104.6532, created_at: t3, velocidad_kmh: 700 },
  ]);
  expect(lecturas).toBe(4);
  expect(promedio).toBeGreaterThan(20);
  expect(promedio).toBeLessThan(60);
  expect(distanciaMetros(24.0277, -104.6532, norte, -104.6532)).toBeGreaterThan(190);
});
