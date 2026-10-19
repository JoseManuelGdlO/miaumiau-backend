const { nearestNeighbor } = require('./route-order');

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
