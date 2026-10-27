const { direccionDeRespaldo } = require('./controller');

test('una ciudad de prueba se busca como lugar de México', () => {
  expect(direccionDeRespaldo('Durango')).toBe('Durango, México');
  expect(direccionDeRespaldo('  ')).toBe('');
  expect(direccionDeRespaldo('A')).toBe('');
});
