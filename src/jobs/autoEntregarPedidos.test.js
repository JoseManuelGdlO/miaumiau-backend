const autoEntregarPedidos = require('./autoEntregarPedidos');
const { compararFechaEntregaSoloDia } = autoEntregarPedidos;

test('medianoche UTC se lee como ese día calendario en México', () => {
  const fecha = new Date('2026-11-20T00:00:00.000Z');
  const ahora = new Date('2026-11-20T18:00:00.000Z');
  expect(compararFechaEntregaSoloDia(fecha, 'America/Mexico_City', ahora)).toBe('today');
});

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

test('si ya llegó no lo cierra aunque el día pasó', async () => {
  const parada = { estado_entrega: 'en_camino', llego_en: new Date(), update: async (data) => Object.assign(parada, data) };
  const pedido = {
    id: 7,
    numero_pedido: 'P-7',
    estado: 'en_camino',
    fecha_entrega_estimada: new Date('2020-01-01T12:00:00Z'),
    ciudad: { nombre: 'Durango', timezone: 'America/Mexico_City' },
    rutas: [parada],
    noEntregar: async () => { pedido.estado = 'no_entregado'; },
  };
  await autoEntregarPedidos({
    models: { Pedido: { findAll: async () => [pedido] } },
  });
  expect(pedido.estado).toBe('en_camino');
  expect(parada.estado_entrega).toBe('en_camino');
});

test('si ya validó el código no lo cierra aunque el día pasó', async () => {
  const parada = { estado_entrega: 'en_camino', codigo_validado_en: new Date(), update: async (data) => Object.assign(parada, data) };
  const pedido = {
    id: 8,
    numero_pedido: 'P-8',
    estado: 'en_camino',
    fecha_entrega_estimada: new Date('2020-01-01T12:00:00Z'),
    ciudad: { nombre: 'Durango', timezone: 'America/Mexico_City' },
    rutas: [parada],
    noEntregar: async () => { pedido.estado = 'no_entregado'; },
  };
  await autoEntregarPedidos({
    models: { Pedido: { findAll: async () => [pedido] } },
  });
  expect(pedido.estado).toBe('en_camino');
});

test('medianoche UTC de hoy no se cierra en México', async () => {
  const hoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const parada = { estado_entrega: 'pendiente', update: async (data) => Object.assign(parada, data) };
  const pedido = {
    id: 9,
    numero_pedido: 'P-9',
    estado: 'en_camino',
    fecha_entrega_estimada: new Date(`${hoy}T00:00:00.000Z`),
    ciudad: { nombre: 'Durango', timezone: 'America/Mexico_City' },
    rutas: [parada],
    noEntregar: async () => { pedido.estado = 'no_entregado'; },
  };
  await autoEntregarPedidos({
    models: { Pedido: { findAll: async () => [pedido] } },
  });
  expect(pedido.estado).toBe('en_camino');
  expect(parada.estado_entrega).toBe('pendiente');
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
