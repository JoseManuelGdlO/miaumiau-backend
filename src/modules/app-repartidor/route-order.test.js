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
