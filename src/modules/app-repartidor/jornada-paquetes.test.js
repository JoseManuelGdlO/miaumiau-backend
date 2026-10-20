const { disponiblesDe } = require('./jornada-paquetes');

test('disponiblesDe usa el producto que menos paquetes alcanza', () => {
  const paquete = {
    productos: [
      { cantidad: 2, producto: { fkid_ciudad: 1, stock_inicial: 5, baja_logica: false } },
      { cantidad: 1, producto: { fkid_ciudad: 1, stock_inicial: 3, baja_logica: false } },
    ],
  };
  expect(disponiblesDe(paquete, 1)).toBe(2);
});

test('disponiblesDe es cero si el producto es de otra ciudad', () => {
  const paquete = {
    productos: [
      { cantidad: 1, producto: { fkid_ciudad: 2, stock_inicial: 8, baja_logica: false } },
    ],
  };
  expect(disponiblesDe(paquete, 1)).toBe(0);
});
