const { precioLista } = require('./precio');

const inv = { precio_venta: 110, precio_distribuidor: 90, umbral_mayoreo: 10 };

test('general sin umbral paga venta', () => {
  expect(precioLista(inv, { es_distribuidor: false, cantidad: 2 })).toBe(110);
});

test('veterinaria o distribuidor pagan precio_distribuidor', () => {
  expect(precioLista(inv, { es_distribuidor: true, cantidad: 1 })).toBe(90);
});

test('general que llega al umbral paga mayoreo', () => {
  expect(precioLista(inv, { es_distribuidor: false, cantidad: 10 })).toBe(90);
});

test('sin precio_distribuidor usa venta', () => {
  expect(precioLista({ precio_venta: 50 }, { es_distribuidor: true, cantidad: 20 })).toBe(50);
});

test('umbral null no dispara mayoreo', () => {
  expect(precioLista({ precio_venta: 110, precio_distribuidor: 90 }, { cantidad: 99 })).toBe(110);
});
