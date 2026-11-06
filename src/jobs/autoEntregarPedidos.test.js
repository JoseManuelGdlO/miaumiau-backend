const autoEntregarPedidos = require('./autoEntregarPedidos');

test('si el día pasó y nadie lo entregó queda no entregado', async () => {
  const parada = { estado_entrega: 'pendiente', update: async (data) => Object.assign(parada, data) };
  const pedido = {
    id: 4,
    numero_pedido: 'P-4',
    estado: 'en_camino',
    fecha_entrega_estimada: new Date('2020-01-01T12:00:00Z'),
    ciudad: { nombre: 'Durango', timezone: 'America/Mexico_City' },
    rutas: [parada],
    noEntregar: async () => { pedido.estado = 'no_entregado'; },
  };
  const result = await autoEntregarPedidos({
    models: { Pedido: { findAll: async () => [pedido] } },
  });
  expect(pedido.estado).toBe('no_entregado');
  expect(parada.estado_entrega).toBe('fallido');
  expect(result.pedidos[0].nuevo_estado).toBe('no_entregado');
});

test('un entregado de verdad no se toca', async () => {
  const pedido = {
    id: 5,
    estado: 'entregado',
    fecha_entrega_estimada: new Date('2020-01-01T12:00:00Z'),
    ciudad: { nombre: 'Durango', timezone: 'America/Mexico_City' },
    rutas: [{ estado_entrega: 'entregado' }],
    noEntregar: async () => { pedido.estado = 'no_entregado'; },
  };
  await autoEntregarPedidos({
    models: { Pedido: { findAll: async () => [pedido] } },
  });
  expect(pedido.estado).toBe('entregado');
});

test('un entregado falso del job viejo se corrige', async () => {
  const parada = { estado_entrega: 'en_camino', update: async (data) => Object.assign(parada, data) };
  const pedido = {
    id: 6,
    numero_pedido: 'P-6',
    estado: 'entregado',
    fecha_entrega_estimada: new Date('2020-01-01T12:00:00Z'),
    ciudad: { nombre: 'Durango', timezone: 'America/Mexico_City' },
    rutas: [parada],
    noEntregar: async () => { pedido.estado = 'no_entregado'; },
  };
  await autoEntregarPedidos({
    models: { Pedido: { findAll: async () => [pedido] } },
  });
  expect(pedido.estado).toBe('no_entregado');
  expect(parada.estado_entrega).toBe('fallido');
});
