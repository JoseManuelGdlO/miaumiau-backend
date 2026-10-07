const { aprobar, atender } = require('./service');

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
