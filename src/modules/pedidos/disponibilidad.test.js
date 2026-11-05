const { exigirFechaLibre, listarDisponibilidad, mensajeSaturado } = require('./disponibilidad');

test('un día saturado apunta a la fecha libre más cercana', async () => {
  let n = 0;
  const db = {
    Repartidor: { count: async () => 1 },
    Pedido: {
      count: async () => {
        n += 1;
        return n === 1 ? 25 : 3;
      },
    },
  };
  const ciudad = { getDiasTrabajo: () => [0, 1, 2, 3, 4, 5, 6] };
  const { dias, proxima_fecha } = await listarDisponibilidad(db, {
    desde: new Date(2026, 10, 5),
    ciudad,
    ciudadId: 1,
    dias: 3,
    excluirIds: [],
  });
  expect(dias[0]).toEqual(expect.objectContaining({
    disponible: false,
    motivo_no_disponible: 'Saturado',
    capacidad: 25,
    mensaje: mensajeSaturado('05-11-2026', '06-11-2026'),
  }));
  expect(proxima_fecha).toBe('06-11-2026');
});

test('exigir fecha libre rechaza el día lleno', async () => {
  let n = 0;
  const db = {
    Repartidor: { count: async () => 1 },
    Pedido: {
      count: async () => {
        n += 1;
        return n === 1 ? 25 : 0;
      },
    },
  };
  const result = await exigirFechaLibre(db, {
    ciudad: { getDiasTrabajo: () => [0, 1, 2, 3, 4, 5, 6] },
    ciudadId: 2,
    fecha: new Date(2026, 10, 5),
    dias: 3,
  });
  expect(result.ok).toBe(false);
  expect(result.status).toBe(409);
  expect(result.proxima_fecha).toBe('06-11-2026');
  expect(result.message).toContain('saturado');
  expect(result.message).toContain('06/11/2026');
});
