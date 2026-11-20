const { avisoDeEvento } = require('./avisos');

test('avisoDeEvento copia los avisos de la app', () => {
  expect(avisoDeEvento({ type: 'ruta.actualizada', pedidoId: 9 })).toEqual({
    titulo: 'Te asignaron un pedido',
    mensaje: 'Revisa tu ruta.',
    data: { pedidoId: '9' },
  });
  expect(avisoDeEvento({ type: 'ruta.actualizada', pedidoId: 9, motivo: 'pago' })).toBe(null);
  expect(avisoDeEvento({ type: 'soporte.mensaje', texto: 'El NIP es 123456' })).toEqual({
    titulo: 'Call Center',
    mensaje: 'El NIP es 123456',
  });
  expect(avisoDeEvento({ type: 'jornada.actualizada' })).toEqual({
    titulo: 'Aviso de Call Center',
    mensaje: 'Hay una actualización en tu ruta.',
  });
  expect(avisoDeEvento({ type: 'solicitud.atendida' })).toEqual({
    titulo: 'Aviso de Call Center',
    mensaje: 'Hay una actualización en tu ruta.',
  });
  expect(avisoDeEvento({ type: 'ready' })).toBe(null);
});
