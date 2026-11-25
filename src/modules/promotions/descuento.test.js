const { montoDescuento, basePromo, logicaDesdePromo, aplicaACliente, promoParaCliente } = require('./descuento');

test('porcentaje y tope', () => {
  expect(montoDescuento({ tipo_promocion: 'porcentaje', valor_descuento: 10 }, 200)).toBe(20);
  expect(montoDescuento({ tipo_promocion: 'porcentaje', valor_descuento: 50, descuento_maximo: 30 }, 200)).toBe(30);
});

test('monto fijo no pasa del total', () => {
  expect(montoDescuento({ tipo_promocion: 'monto_fijo', valor_descuento: 80 }, 50)).toBe(50);
});

test('sin productos ni unidades el descuento sigue sobre el total', () => {
  const promo = { tipo_promocion: 'porcentaje', valor_descuento: 10 };
  expect(basePromo(promo, [], 200)).toBe(200);
  expect(montoDescuento(promo, basePromo(promo, [], 200))).toBe(20);
});

test('solo descuenta los productos marcados y pide las unidades', () => {
  const promo = { tipo_promocion: 'porcentaje', valor_descuento: 10, productos_ids: [3], unidades_minimas: 2 };
  const lineas = [
    { fkid_producto: 3, cantidad: 1, precio_total: 200 },
    { fkid_producto: 2, cantidad: 4, precio_total: 240 },
  ];
  expect(basePromo(promo, lineas, 440)).toBe(0);
  lineas[0].cantidad = 2;
  expect(basePromo(promo, lineas, 440)).toBe(200);
  expect(montoDescuento(promo, basePromo(promo, lineas, 440))).toBe(20);
});

test('compra minima', () => {
  expect(montoDescuento({ tipo_promocion: 'porcentaje', valor_descuento: 10, compra_minima: 100 }, 80)).toBe(0);
});

test('logica para el bot', () => {
  expect(logicaDesdePromo({ tipo_promocion: 'porcentaje', valor_descuento: 15 }).tipo_accion).toBe('descuento_global');
  expect(logicaDesdePromo({ tipo_promocion: 'monto_fijo', valor_descuento: 50 }).unidad_valor).toBe('monto');
  expect(logicaDesdePromo({ tipo_promocion: 'envio_gratis' })).toBe(null);
});

test('aplica_a dist retail todos', () => {
  expect(aplicaACliente({ aplica_a: 'todos' }, false)).toBe(true);
  expect(aplicaACliente({ aplica_a: 'todos' }, true)).toBe(true);
  expect(aplicaACliente({ aplica_a: 'retail' }, false)).toBe(true);
  expect(aplicaACliente({ aplica_a: 'retail' }, true)).toBe(false);
  expect(aplicaACliente({ aplica_a: 'distribuidor' }, true)).toBe(true);
  expect(aplicaACliente({ aplica_a: 'distribuidor' }, false)).toBe(false);
});

test('promoParaCliente prioriza distribuidor de su ciudad', () => {
  const retail = { codigo: 'RETAIL', aplica_a: 'retail', ciudades: [{ id: 1 }] };
  const dist = { codigo: 'VET', aplica_a: 'distribuidor', ciudades: [{ id: 1 }] };
  const otra = { codigo: 'OTRA', aplica_a: 'distribuidor', ciudades: [{ id: 9 }] };
  expect(promoParaCliente([retail, dist, otra], { es_distribuidor: true, fkid_ciudad: 1 }).codigo).toBe('VET');
  expect(promoParaCliente([retail, dist], { es_distribuidor: false, fkid_ciudad: 1 }).codigo).toBe('RETAIL');
  expect(promoParaCliente([dist], { es_distribuidor: false, fkid_ciudad: 1 })).toBe(null);
});

test('promo sin ciudades aplica a todas', () => {
  const global = { codigo: 'ALL', aplica_a: 'todos', ciudades: [] };
  expect(promoParaCliente([global], { es_distribuidor: false, fkid_ciudad: 3 }).codigo).toBe('ALL');
});
