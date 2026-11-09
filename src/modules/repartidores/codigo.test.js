const { armarCodigo, claveEstado, codigoLibre, partesCodigo } = require('./codigo');

test('claveEstado usa la abreviatura del estado', () => {
  expect(claveEstado('Durango')).toBe('DGO');
  expect(claveEstado('Ciudad de México')).toBe('CDMX');
});

test('Durango + Bodega usa el estado y un tag de ubicación', () => {
  expect(partesCodigo('Durango', 'Bodega')).toEqual({ estado: 'DGO', sitio: 'BOD' });
  expect(partesCodigo('Durango', 'Durango')).toEqual({ estado: 'DGO', sitio: '' });
  expect(armarCodigo('Durango', 'Bodega')).toMatch(/^REP-DGO-BOD-[a-f0-9]{4}$/);
  expect(armarCodigo('Durango', 'Durango')).toMatch(/^REP-DGO-[a-f0-9]{6}$/);
});

test('codigoLibre no reusa un código ocupado y conserva estado y sitio', async () => {
  const ocupados = new Set(['REP-DGO-BOD-aaaa']);
  const Repartidor = {
    findOne: async ({ where }) => (ocupados.has(where.codigo_repartidor) ? { id: 1 } : null),
  };
  const codigo = await codigoLibre(Repartidor, 'REP-DGO-BOD-aaaa', 'Durango', 'Bodega');
  expect(codigo).not.toBe('REP-DGO-BOD-aaaa');
  expect(codigo.startsWith('REP-DGO-BOD-')).toBe(true);
  expect(codigo.length).toBeLessThanOrEqual(20);
});
