const { franjaDeHorario, horarioNormalizado } = require('./horario');
const { reencolarNoEntregados, encolarAlDiaSiguiente, diaSiguiente } = require('./reencolar');
const { elegirLinea } = require('../mensajeria/reagendar-whatsapp');

test('antes de las 14 es mañana y desde las 14 es tarde', () => {
  expect(franjaDeHorario('13:59')).toBe('manana');
  expect(franjaDeHorario('14:00')).toBe('tarde');
  expect(franjaDeHorario('16:30:00')).toBe('tarde');
  expect(franjaDeHorario('')).toBeNull();
  expect(franjaDeHorario('25:00')).toBeNull();
  expect(horarioNormalizado('9:05')).toBe('09:05:00');
  expect(horarioNormalizado('')).toBeNull();
});

test('el no entregado de ayer vuelve a la cola de hoy', async () => {
  const pedido = {
    estado: 'no_entregado',
    notas: '',
    update: async (data) => Object.assign(pedido, data),
  };
  const moved = await reencolarNoEntregados({
    fecha: '2026-10-23',
    Pedido: { findAll: async () => [pedido, { estado: 'confirmado', update: async () => { throw new Error('no'); } }] },
  });
  expect(moved).toBe(1);
  expect(pedido.estado).toBe('confirmado');
  expect(pedido.fecha_entrega_estimada.toISOString()).toBe('2026-10-23T12:00:00.000Z');
  expect(pedido.notas).toContain('Volvió a la cola');
  expect(await reencolarNoEntregados({ fecha: 'hoy', Pedido: { findAll: async () => { throw new Error('no'); } } })).toBe(0);
});

test('un no entregado de hoy queda para mañana y elige la línea de su ciudad', async () => {
  const pedido = { estado: 'no_entregado', notas: '', update: async (data) => Object.assign(pedido, data) };
  await encolarAlDiaSiguiente(pedido, '2026-10-27');
  expect(diaSiguiente('2026-10-27')).toBe('2026-10-28');
  expect(pedido.estado).toBe('confirmado');
  expect(pedido.fecha_entrega_estimada.toISOString()).toBe('2026-10-28T12:00:00.000Z');
  const lineas = [
    { telefono: '6181111111', phoneid: 'linea-centro' },
    { telefono: '6182222222', phoneid: 'linea-norte' },
  ];
  expect(elegirLinea(lineas, { conversacionId: 'ya-habla', telefonoCiudad: '6182222222' })).toBe('ya-habla');
  expect(elegirLinea(lineas, { telefonoCiudad: '618 222 2222' })).toBe('linea-norte');
  expect(elegirLinea([], {})).toBe('986416624552272');
});
