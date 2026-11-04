const { direccionDeRespaldo, enElEstado } = require('./controller');

test('una ciudad de prueba se busca como lugar de México', () => {
  expect(direccionDeRespaldo('Durango')).toBe('Durango, México');
  expect(direccionDeRespaldo('  ')).toBe('');
  expect(direccionDeRespaldo('A')).toBe('');
});

test('dirección fuera del departamento falla', () => {
  expect(enElEstado('Calle Independencia 12, Guadalajara, Jalisco, México', 'Durango')).toBe(false);
  expect(enElEstado('Calle Independencia 12, Durango, Durango, México', 'Durango')).toBe(true);
});
