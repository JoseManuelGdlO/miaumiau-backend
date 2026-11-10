const { aplicarMetricas, mapaMetricas } = require('./metricas');

describe('metricas de entrega', () => {
  test('pone conteo y última entrega reales encima del cache', () => {
    const out = aplicarMetricas(
      [{ id: 2, total_entregas: 90, fecha_ultima_entrega: '2020-01-01', calificacion_promedio: 5, toJSON() { return { id: 2, total_entregas: 90, fecha_ultima_entrega: '2020-01-01', calificacion_promedio: 5 }; } }],
      [{ id: 2, total_entregas: '4', fecha_ultima_entrega: '2026-11-10', calificacion_promedio: '4.25' }],
    );
    expect(out[0].total_entregas).toBe(4);
    expect(out[0].fecha_ultima_entrega).toBe('2026-11-10');
    expect(out[0].calificacion_promedio).toBe(4.3);
  });

  test('sin filas deja entregas en 0', () => {
    const out = aplicarMetricas([{ id: 8, total_entregas: 12 }], []);
    expect(out[0].total_entregas).toBe(0);
    expect(out[0].fecha_ultima_entrega).toBe(null);
    expect(out[0].calificacion_promedio).toBe(null);
  });

  test('mapa ignora ids vacíos', () => {
    expect(mapaMetricas([{ id: 0, total_entregas: 3 }])).toEqual({});
  });
});
