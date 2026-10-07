const { aprobar, atender, cambiarEstado } = require('./service');

function notificacion(data) {
  const row = {
    id: 9,
    leida: false,
    datos: { tipo: 'check_in', estado_solicitud: 'abierta', jornada_id: 3, repartidor_id: 1 },
    update: async (patch) => Object.assign(row, patch),
    ...data,
  };
  return row;
}

test('aprobar marca leída y no valida la jornada', async () => {
  const jornada = { id: 3, estado: 'esperando_call_center', fkid_notificacion: 9, update: async () => { throw new Error('no tocar'); } };
  const n = notificacion();
  const result = await aprobar({ notificacion: n, jornada });
  expect(result).toEqual({ atendida: true });
  expect(n.leida).toBe(true);
  expect(jornada.estado).toBe('esperando_call_center');
});

test('aprobar un check-in cancelado responde 409', async () => {
  const n = notificacion({ datos: { tipo: 'check_in', estado_solicitud: 'cancelada' } });
  await expect(aprobar({
    notificacion: n,
    jornada: { id: 3, estado: 'esperando_call_center', fkid_notificacion: 9 },
  })).rejects.toMatchObject({ status: 409 });
});

test('atender agrega la nota y no borra la anterior', async () => {
  const n = notificacion({ datos: { tipo: 'llamada_cliente', estado_solicitud: 'abierta', pedido_id: 5, repartidor_id: 1 } });
  const pedido = { id: 5, notas: 'Portón azul', update: async (patch) => Object.assign(pedido, patch) };
  const result = await atender({
    notificacion: n,
    pedido,
    nota: ' No contestó ',
    now: new Date('2026-10-07T18:45:00Z'),
    timezone: 'America/Mexico_City',
    transaction: async (fn) => fn(),
  });
  expect(result.atendida).toBe(true);
  expect(n.leida).toBe(true);
  expect(pedido.notas).toBe('Portón azul\n[Call Center 2026-10-07 12:45] No contestó');
});

test('soporte sin pedido guarda la nota en la notificación', async () => {
  const n = notificacion({ datos: { tipo: 'soporte', estado_solicitud: 'abierta', motivo: 'incidencia', repartidor_id: 1 } });
  await atender({
    notificacion: n,
    nota: 'Se revisó la carga',
    transaction: async (fn) => fn(),
  });
  expect(n.leida).toBe(true);
  expect(n.datos.nota).toBe('Se revisó la carga');
});

test('atender pasa la misma transacción a pedido y notificación', async () => {
  const tx = { id: 'tx' };
  const n = notificacion({ datos: { tipo: 'llamada_cliente', estado_solicitud: 'abierta', pedido_id: 5, repartidor_id: 1 } });
  const pedido = { id: 5, notas: 'Portón azul', update: jest.fn(async (patch) => Object.assign(pedido, patch)) };
  n.update = jest.fn(n.update);
  await atender({
    notificacion: n,
    pedido,
    nota: 'Nota tx',
    now: new Date('2026-10-07T18:45:00Z'),
    timezone: 'America/Mexico_City',
    transaction: async (fn) => fn(tx),
  });
  expect(pedido.update).toHaveBeenCalledWith(
    expect.objectContaining({ notas: expect.stringContaining('Nota tx') }),
    { transaction: tx },
  );
  expect(n.update).toHaveBeenCalledWith(
    expect.objectContaining({ leida: true }),
    { transaction: tx },
  );
});

test('una nota larga no marca leída', async () => {
  const n = notificacion({ datos: { tipo: 'soporte', estado_solicitud: 'abierta', pedido_id: 5 } });
  const pedido = { id: 5, notas: 'x'.repeat(1000), update: async () => { throw new Error('no guardar'); } };
  await expect(atender({
    notificacion: n,
    pedido,
    nota: 'a',
    now: new Date('2026-10-07T18:45:00Z'),
    timezone: 'America/Mexico_City',
    transaction: async (fn) => fn(),
  })).rejects.toMatchObject({ status: 422 });
  expect(n.leida).toBe(false);
});

test('entregado mueve la ruta y no suma puntos', async () => {
  const pedido = { id: 4, estado: 'en_camino', entregar: async () => { pedido.estado = 'entregado'; } };
  const rutaPedido = { estado_entrega: 'pendiente', update: async (patch) => Object.assign(rutaPedido, patch) };
  const now = new Date('2026-10-07T18:00:00Z');
  const result = await cambiarEstado({ pedido, rutaPedido, estado: 'entregado', now });
  expect(result).toEqual({ id: 4, estado: 'entregado' });
  expect(rutaPedido.estado_entrega).toBe('entregado');
  expect(rutaPedido.fecha_entrega_real).toBe(now);
});

test('cancelado deja la ruta en fallido sin fecha', async () => {
  const pedido = { id: 4, estado: 'pendiente', cancelar: async () => { pedido.estado = 'cancelado'; } };
  const rutaPedido = { estado_entrega: 'pendiente', update: async (patch) => Object.assign(rutaPedido, patch) };
  await cambiarEstado({ pedido, rutaPedido, estado: 'cancelado' });
  expect(rutaPedido.estado_entrega).toBe('fallido');
  expect(rutaPedido.fecha_entrega_real).toBeUndefined();
});

test('un par fuera de la tabla responde 422', async () => {
  const pedido = { id: 4, estado: 'en_preparacion' };
  await expect(cambiarEstado({ pedido, estado: 'no_entregado' })).rejects.toMatchObject({ status: 422 });
});
