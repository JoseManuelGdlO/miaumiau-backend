const { avisarNoEncontrado, anotarIncidenciaReagendar } = require('./reagendar-whatsapp');

test('nadie avisa por WhatsApp que el pedido quedó para el día siguiente', async () => {
  const calls = [];
  const ok = await avisarNoEncontrado({
    telefono: '5216180000000',
    linea: '1',
    send: async (...args) => {
      calls.push(args);
      return { success: true };
    },
  });
  expect(ok).toBe(true);
  expect(calls[0][1]).toMatch(/no contestaron/);
  expect(calls[0][1]).toMatch(/reagendado/);
  expect(await avisarNoEncontrado({ telefono: '', linea: '1', send: async () => ({ success: true }) })).toBe(false);
});

test('No puedo abre incidencia para Call Center', async () => {
  const created = [];
  const aviso = await anotarIncidenciaReagendar(
    { id: 9, numero_pedido: 'P-9', repartidor_id: 3 },
    {},
    { findAll: async () => [], create: async (row) => { created.push(row); return row; } },
  );
  expect(aviso.nombre).toBe('Cliente no puede recibir');
  expect(aviso.datos.tipo).toBe('soporte');
  expect(aviso.datos.motivo).toBe('no_puedo');
  expect(aviso.datos.pedido_id).toBe(9);
  expect(created).toHaveLength(1);
});

test('elegir fecha actualiza la misma incidencia para aprobarla', async () => {
  const abierta = {
    datos: { tipo: 'soporte', motivo: 'no_puedo', pedido_id: 9, estado_solicitud: 'abierta' },
    update: async (row) => Object.assign(abierta, row),
  };
  const aviso = await anotarIncidenciaReagendar(
    { id: 9, numero_pedido: 'P-9', repartidor_id: 3 },
    { fecha: '2026-11-28' },
    { findAll: async () => [abierta], create: async () => { throw new Error('no debía crear otra'); } },
  );
  expect(aviso.nombre).toBe('Fecha propuesta');
  expect(aviso.datos.motivo).toBe('propuesta');
  expect(aviso.datos.fecha_propuesta).toBe('2026-11-28');
});
