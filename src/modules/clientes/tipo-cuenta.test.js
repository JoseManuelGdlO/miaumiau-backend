const { cuentaDe } = require('./tipo-cuenta');

test('tipo_cuenta veterinaria enciende es_distribuidor', () => {
  expect(cuentaDe({ tipo_cuenta: 'veterinaria' })).toEqual({
    tipo_cuenta: 'veterinaria',
    es_distribuidor: true,
  });
});

test('general apaga el flag', () => {
  expect(cuentaDe({ tipo_cuenta: 'general' })).toEqual({
    tipo_cuenta: 'general',
    es_distribuidor: false,
  });
});

test('sin tipo, el boolean viejo sigue mapeando a distribuidor', () => {
  expect(cuentaDe({ es_distribuidor: true })).toEqual({
    tipo_cuenta: 'distribuidor',
    es_distribuidor: true,
  });
});
