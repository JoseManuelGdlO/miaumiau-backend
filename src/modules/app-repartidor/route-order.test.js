const { nearestNeighbor, ordenDesdeBodega } = require('./route-order');

test('nearestNeighbor recorre la parada más cercana', () => {
  const matrix = [
    [0, 10, 2],
    [10, 0, 3],
    [2, 3, 0],
  ];
  expect(nearestNeighbor([11, 22, 33], matrix)).toEqual([11, 33, 22]);
});

test('nearestNeighbor deja una sola parada como está', () => {
  expect(nearestNeighbor([8], [[0]])).toEqual([8]);
});

test('ordenDesdeBodega no empieza en el punto más lejano', () => {
  const matrix = [
    [0, 100, 5],
    [100, 0, 90],
    [5, 90, 0],
  ];
  expect(ordenDesdeBodega([11, 22], matrix)).toEqual([22, 11]);
});

test('ordenSinPisarManual conserva la parada manual y acomoda el resto', () => {
  const { ordenSinPisarManual } = require('./route-order');
  const rows = [
    { id: 1, orden_entrega: 1, orden_manual: true },
    { id: 2, orden_entrega: 2, orden_manual: false },
    { id: 3, orden_entrega: 3, orden_manual: false },
  ];
  expect(ordenSinPisarManual(rows, [3, 1, 2])).toEqual([
    { id: 3, orden_entrega: 2 },
    { id: 2, orden_entrega: 3 },
  ]);
});

test('prioridad distancia pone primero al más cercano aunque sea de las 13:00', () => {
  const { ordenRuta } = require('./route-order');
  const matrix = [
    [0, 100, 5],
    [100, 0, 90],
    [5, 90, 0],
  ];
  const paradas = [
    { id: 11, horario: '10:00' },
    { id: 22, horario: '13:00' },
  ];
  expect(ordenRuta(paradas, matrix, 'distancia')).toEqual([22, 11]);
});

test('prioridad hora no pone un pedido de las 13:00 antes que uno de las 10:00', () => {
  const { ordenRuta, asignacionesDeOrden } = require('./route-order');
  const matrix = [
    [0, 100, 5],
    [100, 0, 90],
    [5, 90, 0],
  ];
  const paradas = [
    { id: 11, horario: '10:00' },
    { id: 22, horario: '13:00' },
  ];
  expect(ordenRuta(paradas, matrix, 'hora')).toEqual([11, 22]);
  expect(asignacionesDeOrden(paradas, [11, 22]).map((row) => row.franja)).toEqual(['manana', 'tarde']);
});

test('prioridad hora mete el pedido sin hora en el hueco corto', () => {
  const { ordenRuta } = require('./route-order');
  const matrix = [
    [0, 5, 50, 80],
    [5, 0, 8, 40],
    [50, 8, 0, 9],
    [80, 40, 9, 0],
  ];
  const paradas = [
    { id: 'A', horario: '10:00' },
    { id: 'B', horario: null },
    { id: 'C', horario: '13:00' },
  ];
  expect(ordenRuta(paradas, matrix, 'hora')).toEqual(['A', 'B', 'C']);
});

test('sin modo o con distancia ignora el corte de las 12:00', () => {
  const { ordenRuta } = require('./route-order');
  const matrix = [
    [0, 100, 5],
    [100, 0, 90],
    [5, 90, 0],
  ];
  const paradas = [
    { id: 11, horario: '10:00' },
    { id: 22, horario: '13:00' },
  ];
  expect(ordenRuta(paradas, matrix)).toEqual([22, 11]);
  expect(ordenRuta(paradas, matrix, 'distancia')).toEqual([22, 11]);
  expect(ordenRuta(paradas, matrix, 'hora')).toEqual([11, 22]);
});
