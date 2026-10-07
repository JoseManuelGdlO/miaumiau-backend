const {
  approveCheck,
  attendCheck,
  appendNota,
  transition,
  reassignCheck,
  stamp,
  phoneOf,
  isOpenSolicitud,
  toSolicitudDetalle,
  toPedidoDia,
  NOTE_LIMIT,
} = require('./domain');

test('aprobar solo un check-in vigente sin leer', () => {
  const ok = { tipo: 'check_in', leida: false, estadoSolicitud: 'abierta', jornadaEstado: 'esperando_call_center', vigente: true };
  expect(approveCheck(ok).ok).toBe(true);
  expect(approveCheck({ ...ok, leida: true }).statusCode).toBe(409);
  expect(approveCheck({ ...ok, estadoSolicitud: 'cancelada' }).ok).toBe(false);
  expect(approveCheck({ ...ok, vigente: false }).ok).toBe(false);
  expect(approveCheck({ ...ok, tipo: 'soporte' }).ok).toBe(false);
});

test('atender llamada o soporte abiertos', () => {
  expect(attendCheck({ tipo: 'llamada_cliente', leida: false, estadoSolicitud: 'abierta' }).ok).toBe(true);
  expect(attendCheck({ tipo: 'soporte', leida: false, estadoSolicitud: 'abierta' }).ok).toBe(true);
  expect(attendCheck({ tipo: 'check_in', leida: false, estadoSolicitud: 'abierta' }).statusCode).toBe(409);
  expect(attendCheck({ tipo: 'soporte', leida: true, estadoSolicitud: 'abierta' }).ok).toBe(false);
});

test('la nota se agrega sin borrar y respeta 1000', () => {
  const stampText = '2026-10-07 12:45';
  expect(appendNota(null, '  ', stampText)).toEqual({ ok: true, notas: null, changed: false });
  expect(appendNota(null, 'No contestó', stampText).notas).toBe('[Call Center 2026-10-07 12:45] No contestó');
  expect(appendNota('Hola', 'No contestó', stampText).notas).toBe('Hola\n[Call Center 2026-10-07 12:45] No contestó');
  expect(appendNota('x'.repeat(NOTE_LIMIT), 'a', stampText).statusCode).toBe(422);
});

test('stamp usa la zona de la ciudad', () => {
  expect(stamp(new Date('2026-10-07T18:45:00Z'), 'America/Mexico_City')).toBe('2026-10-07 12:45');
});

test('transiciones de la pantalla Pedidos', () => {
  expect(transition('pendiente', 'confirmado')).toMatchObject({ ok: true, method: 'confirmar', route: null });
  expect(transition('confirmado', 'en_preparacion').method).toBe('preparar');
  expect(transition('en_preparacion', 'en_camino').method).toBe('enviar');
  expect(transition('en_camino', 'entregado')).toMatchObject({
    method: 'entregar',
    route: { estado_entrega: 'entregado', fecha_entrega_real: true },
  });
  expect(transition('en_camino', 'no_entregado').route).toEqual({ estado_entrega: 'fallido', fecha_entrega_real: true });
  expect(transition('pendiente', 'cancelado').route).toEqual({ estado_entrega: 'fallido', fecha_entrega_real: false });
  expect(transition('no_entregado', 'entregado').ok).toBe(true);
  expect(transition('en_preparacion', 'no_entregado').statusCode).toBe(422);
  expect(transition('entregado', 'cancelado').ok).toBe(false);
});

test('reasignar rechaza cerrado, otra ciudad, inactivo y el mismo repartidor', () => {
  const base = { pedidoEstado: 'en_camino', sameDriver: false, driverFound: true, sameCity: true, driverEstado: 'en_ruta' };
  expect(reassignCheck(base).ok).toBe(true);
  expect(reassignCheck({ ...base, pedidoEstado: 'entregado' }).statusCode).toBe(409);
  expect(reassignCheck({ ...base, pedidoEstado: 'cancelado' }).statusCode).toBe(409);
  expect(reassignCheck({ ...base, sameCity: false }).statusCode).toBe(403);
  expect(reassignCheck({ ...base, driverFound: false }).statusCode).toBe(403);
  expect(reassignCheck({ ...base, driverEstado: 'inactivo' }).statusCode).toBe(403);
  expect(reassignCheck({ ...base, sameDriver: true }).statusCode).toBe(422);
});

test('el teléfono prefiere la referencia y el dto no lleva código', () => {
  expect(phoneOf({ telefono_referencia: ' 618111 ', cliente: { telefono: '618222' } })).toBe('618111');
  expect(phoneOf({ telefono_referencia: '', cliente: { telefono: '618222' } })).toBe('618222');
  const dia = toPedidoDia({
    pedido: {
      id: 4,
      numero_pedido: 'P-4',
      estado: 'en_camino',
      codigo_entrega: '123456',
      telefono_referencia: '618111',
      direccion_entrega: 'Calle 1',
      cliente: { nombre_completo: 'Ana', telefono: '618222' },
    },
    rutaPedido: { id: 9, estado_entrega: 'pendiente' },
    ruta: { fkid_ciudad: 2, fkid_repartidor: 3, repartidor: { id: 3, nombre_completo: 'Luis' } },
  });
  expect(dia.telefono).toBe('618111');
  expect(dia.codigo_entrega).toBeUndefined();
  expect(dia.ciudad_id).toBe(2);
  const detalle = toSolicitudDetalle({
    notificacion: { id: 8, datos: { tipo: 'check_in' }, fecha_creacion: '2026-10-07', hora_creacion: '09:00:00' },
    repartidor: { id: 3, nombre_completo: 'Luis' },
    cargas: [{ nombre: 'Arena', cantidad: 2, precio_unitario: 10, es_extra: false, secreto: 1 }],
    pedido: { codigo_entrega: '123456', telefono_referencia: '618' },
  });
  expect(detalle.cargas).toEqual([{ nombre: 'Arena', cantidad: 2, precio_unitario: 10, es_extra: false }]);
  expect(detalle.codigo_entrega).toBeUndefined();
  expect(JSON.stringify(detalle)).not.toContain('123456');
});

test('la cola ignora leídas, canceladas y otros tipos', () => {
  expect(isOpenSolicitud({ leida: false, datos: { tipo: 'soporte', estado_solicitud: 'abierta' } })).toBe(true);
  expect(isOpenSolicitud({ leida: true, datos: { tipo: 'soporte', estado_solicitud: 'abierta' } })).toBe(false);
  expect(isOpenSolicitud({ leida: false, datos: { tipo: 'check_in', estado_solicitud: 'cancelada' } })).toBe(false);
  expect(isOpenSolicitud({ leida: false, datos: { tipo: 'stock', estado_solicitud: 'abierta' } })).toBe(false);
});
