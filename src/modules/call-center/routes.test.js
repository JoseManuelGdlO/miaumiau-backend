const router = require('./routes');

test('expone la API de call center', () => {
  const paths = router.stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  expect(paths).toEqual(expect.arrayContaining([
    'GET /solicitudes',
    'GET /solicitudes/:id',
    'POST /solicitudes/:id/aprobar',
    'PUT /solicitudes/:id/extras',
    'GET /inventario',
    'POST /solicitudes/:id/atender',
    'GET /pedidos',
    'PATCH /pedidos/:id/estado',
    'GET /repartidores',
    'POST /pedidos/:id/reasignar',
  ]));
});
