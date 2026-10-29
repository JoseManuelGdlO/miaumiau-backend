const { franjaDeHorario, horarioNormalizado, horarioDeEntrega } = require('./horario');
const { reencolarNoEntregados, encolarAlDiaSiguiente, diaSiguiente, soltarParadasAbiertas } = require('./reencolar');
const { elegirLinea } = require('../mensajeria/reagendar-whatsapp');

test('antes de las 14 es mañana y desde las 14 es tarde', () => {
  expect(franjaDeHorario('13:59')).toBe('manana');
  expect(franjaDeHorario('14:00')).toBe('tarde');
  expect(franjaDeHorario('16:30:00')).toBe('tarde');
  expect(franjaDeHorario('')).toBeNull();
  expect(franjaDeHorario('25:00')).toBeNull();
  expect(horarioNormalizado('9:05')).toBe('09:05:00');
  expect(horarioNormalizado('')).toBeNull();
  expect(horarioDeEntrega('09:30').franja).toBe('manana');
  expect(horarioDeEntrega('13:59').franja).toBe('manana');
  expect(horarioDeEntrega('14:00').franja).toBe('tarde');
  expect(horarioDeEntrega('17:00').franja).toBe('tarde');
  expect(horarioDeEntrega('09:29').ok).toBe(false);
  expect(horarioDeEntrega('17:01').ok).toBe(false);
  expect(horarioDeEntrega('').ok).toBe(true);
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

test('al cerrar la ruta suelta lo pendiente y deja lo entregado', async () => {
  const pendiente = { estado: 'pendiente', notas: '', update: async (data) => Object.assign(pendiente, data) };
  const destruida = { estado_entrega: 'pendiente', pedido: pendiente, destroy: async () => { destruida.fuera = true; } };
  const entregada = { estado_entrega: 'entregado', destroy: async () => { entregada.fuera = true; } };
  await soltarParadasAbiertas({
    Ruta: { findAll: async () => [{ pedidos: [destruida, entregada] }] },
  }, 3, '2026-10-27');
  expect(pendiente.estado).toBe('confirmado');
  expect(destruida.fuera).toBe(true);
  expect(entregada.fuera).toBeUndefined();
});
