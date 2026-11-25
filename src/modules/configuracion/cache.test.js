const { cargarConfiguracion, configuraciones, evidenciasOcultas, FLAG_OCULTAR_EVIDENCIAS } = require('./cache');

const fila = (activo) => ({
  identificador: FLAG_OCULTAR_EVIDENCIAS,
  nombre: 'Ocultar evidencias fotográficas',
  descripcion: 'oculta las fotos',
  activo,
});

test('al cargar, la flag activa oculta las evidencias y la apagada las pide', async () => {
  expect(evidenciasOcultas()).toBe(true);

  await cargarConfiguracion({ Configuracion: { findAll: async () => [fila(1)] } });
  expect(configuraciones()).toEqual([expect.objectContaining({ identificador: FLAG_OCULTAR_EVIDENCIAS, activo: true })]);
  expect(evidenciasOcultas()).toBe(true);

  await cargarConfiguracion({ Configuracion: { findAll: async () => [fila(0)] } });
  expect(evidenciasOcultas()).toBe(false);
  expect(evidenciasOcultas({ evidenciasOcultas: true })).toBe(true);
});
