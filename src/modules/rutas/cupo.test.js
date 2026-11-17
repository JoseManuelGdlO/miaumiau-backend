const { exigirCupo, idsPedidosDePrueba, MAX_PARADAS_DIA, cuantosRepartidores } = require('./cupo');

test('no se agrega la parada 31', async () => {
  const db = {
    Ruta: {
      findAll: async () => [{ id: 1 }],
    },
    RutaPedido: {
      count: async () => MAX_PARADAS_DIA,
    },
  };
  await expect(exigirCupo(db, { repartidorId: 8, fecha: '2026-10-19', extra: 1 }))
    .rejects.toMatchObject({ status: 409, message: 'Ese repartidor ya tiene 30 pedidos hoy' });
  await expect(exigirCupo({
    Ruta: { findAll: async () => [{ id: 1 }] },
    RutaPedido: { count: async () => 29 },
  }, { repartidorId: 8, fecha: '2026-10-19' })).resolves.toBe(29);
});

test('3 pedidos salen en una sola ruta', () => {
  expect(cuantosRepartidores(3)).toBe(1);
  expect(cuantosRepartidores(8)).toBe(1);
  expect(cuantosRepartidores(9)).toBe(2);
  expect(cuantosRepartidores(12, true)).toBe(1);
});

test('un repartidor es_prueba no entra en el conteo de disponibilidad', async () => {
  const ids = await idsPedidosDePrueba({
    Repartidor: {
      findAll: async () => [{ id: 9 }],
    },
    Ruta: {
      findAll: async () => [{ id: 4 }],
    },
    RutaPedido: {
      findAll: async () => [{ fkid_pedido: 70 }, { fkid_pedido: 71 }],
    },
  });
  expect(ids).toEqual([70, 71]);
  expect(await idsPedidosDePrueba({
    Repartidor: { findAll: async () => [] },
  })).toEqual([]);
});
