const { direccionDeRespaldo, enElEstado, centroDeCiudad, isStreetFound, esDomicilio } = require('./controller');

test('una ciudad de prueba se busca como lugar de México', () => {
  expect(direccionDeRespaldo('Durango')).toBe('Durango, México');
  expect(direccionDeRespaldo('  ')).toBe('');
  expect(direccionDeRespaldo('A')).toBe('');
});

test('Durango tiene un centro si Google no responde', () => {
  expect(centroDeCiudad('Durango').lat).toBeCloseTo(24.0277, 3);
  expect(centroDeCiudad('Bodega', 'otro')).toBeNull();
});

test('dirección fuera del departamento falla', () => {
  expect(enElEstado('Calle Independencia 12, Guadalajara, Jalisco, México', 'Durango')).toBe(false);
  expect(enElEstado('Calle Independencia 12, Durango, Durango, México', 'Durango')).toBe(true);
});

test('el centro de ciudad no cuenta como domicilio', () => {
  expect(isStreetFound('Durango, Durango, México', 'Durango')).toBe(false);
  expect(isStreetFound('34000 Durango, Durango, México', 'Durango')).toBe(false);
  expect(isStreetFound('Melchor Ocampo 234, Zona Centro, 34000 Durango, Durango, México', 'Melchor Ocampo 234')).toBe(true);
  expect(isStreetFound('Calle Independencia 12, Durango, Durango, México', 'Independencia 12')).toBe(true);
  expect(esDomicilio({
    lat: 24.0277,
    lng: -104.6532,
    formatted_address: 'Durango, México',
    aproximado: true,
  }, 'Durango')).toBe(false);
  expect(esDomicilio({
    lat: 24.02,
    lng: -104.66,
    formatted_address: 'Calle Independencia 12, Durango, Durango, México',
    aproximado: false,
  }, 'Durango')).toBe(true);
  expect(esDomicilio({
    lat: 20.67,
    lng: -103.35,
    formatted_address: 'Calle Independencia 12, Guadalajara, Jalisco, México',
    aproximado: false,
  }, 'Durango')).toBe(false);
});
