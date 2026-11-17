const { montoDescuento, logicaDesdePromo, aplicaACliente } = require('./descuento');

test('porcentaje y tope', () => {
  expect(montoDescuento({ tipo_promocion: 'porcentaje', valor_descuento: 10 }, 200)).toBe(20);
  expect(montoDescuento({ tipo_promocion: 'porcentaje', valor_descuento: 50, descuento_maximo: 30 }, 200)).toBe(30);
});

test('monto fijo no pasa del total', () => {
  expect(montoDescuento({ tipo_promocion: 'monto_fijo', valor_descuento: 80 }, 50)).toBe(50);
});

test('compra minima', () => {
  expect(montoDescuento({ tipo_promocion: 'porcentaje', valor_descuento: 10, compra_minima: 100 }, 80)).toBe(0);
});

test('logica para el bot', () => {
  expect(logicaDesdePromo({ tipo_promocion: 'porcentaje', valor_descuento: 15 }).tipo_accion).toBe('descuento_global');
  expect(aplicaACliente({ aplica_a: 'distribuidor' }, true)).toBe(true);
  expect(aplicaACliente({ aplica_a: 'distribuidor' }, false)).toBe(false);
});
