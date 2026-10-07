const { replaceCarga, leerSolicitud, toPedidoDto } = require('./service');

test('replaceCarga en espera cancela la notificación y responde 409', async () => {
  const updates = [];
  const jornada = {
    id: 1,
    estado: 'esperando_call_center',
    fkid_notificacion: 9,
    cargas: [{ nombre: 'Arena', cantidad: 1, precio_unitario: 10, es_extra: false }],
    update: async (data) => Object.assign(jornada, data),
  };
  const notificacion = { id: 9, leida: false, datos: { estado_solicitud: 'abierta' }, update: async (data) => updates.push(data) };
  const result = await replaceCarga({
    jornada,
    lineas: [{ nombre: 'Arena', cantidad: 2, precio_unitario: 10, es_extra: false }],
    notificacion,
    replaceLineas: async () => {},
  });
  expect(result.statusCode).toBe(409);
  expect(jornada.estado).toBe('borrador');
  expect(updates[0].leida).toBe(true);
  expect(updates[0].datos.estado_solicitud).toBe('cancelada');
});

test('leerSolicitud valida la jornada solo si la notificación vigente está leída', async () => {
  const jornada = { id: 3, estado: 'esperando_call_center', fkid_notificacion: 9, update: async (data) => Object.assign(jornada, data) };
  const opened = await leerSolicitud({
    jornada,
    notificacion: { id: 9, leida: true, datos: { tipo: 'check_in', estado_solicitud: 'abierta', jornada_id: 3 } },
  });
  expect(opened.atendida).toBe(true);
  expect(jornada.estado).toBe('validada');
});

test('toPedidoDto no incluye telefono ni codigo_entrega', () => {
  const dto = toPedidoDto({
    id: 1,
    numero_pedido: 'P-1',
    codigo_entrega: '482193',
    telefono: '618',
    cliente: { id: 2, nombre_completo: 'María', telefono: '618' },
  });
  expect(dto).not.toHaveProperty('telefono');
  expect(dto).not.toHaveProperty('codigo_entrega');
  expect(dto.cliente).not.toHaveProperty('telefono');
});
