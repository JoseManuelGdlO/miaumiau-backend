const { aprobar, atender, cambiarEstado, reasignar, listarSolicitudes, detalleSolicitud, listarPedidos, listarRepartidores } = require('./service');

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

test('reasignar crea la ruta, conserva el código y limpia la llegada', async () => {
  const created = [];
  const rutaPedido = {
    fkid_ruta: 1,
    orden_entrega: 2,
    estado_entrega: 'en_camino',
    llego_en: new Date(),
    codigo_validado_en: new Date(),
    lat: 1,
    lng: 2,
    update: async (patch) => Object.assign(rutaPedido, patch),
    pedido: { id: 4, estado: 'en_camino', codigo_entrega: '123456' },
    ruta: { id: 1, fkid_ciudad: 7, fkid_repartidor: 3, fecha_ruta: '2026-10-07', total_pedidos: 2, estado: 'en_progreso', update: async (patch) => Object.assign(rutaPedido.ruta, patch) },
  };
  const destino = { id: 20, total_pedidos: 0, update: async (patch) => Object.assign(destino, patch) };
  const models = {
    Ruta: {
      findAll: async () => [],
      create: async (row) => { created.push(row); return destino; },
    },
    RutaPedido: { findAll: async () => [] },
  };
  const result = await reasignar({
    models,
    rutaPedido,
    fechaHoy: '2026-10-07',
    repartidor: { id: 8, nombre_completo: 'Marta López', fkid_ciudad: 7, estado: 'activo' },
  });
  expect(result).toEqual({ ruta_id: 20, creada: true, orden_entrega: 1 });
  expect(created[0].nombre_ruta).toBe('Call Center 2026-10-07 Marta López');
  expect(created[0].estado).toBe('planificada');
  expect(rutaPedido.fkid_ruta).toBe(20);
  expect(rutaPedido.estado_entrega).toBe('pendiente');
  expect(rutaPedido.llego_en).toBeNull();
  expect(rutaPedido.codigo_validado_en).toBeNull();
  expect(rutaPedido.lat).toBe(1);
  expect(rutaPedido.pedido.codigo_entrega).toBe('123456');
  expect(rutaPedido.pedido.estado).toBe('en_camino');
  expect(rutaPedido.ruta.total_pedidos).toBe(1);
  expect(destino.total_pedidos).toBe(1);
});

test('reasignar un pedido cerrado responde 409', async () => {
  const rutaPedido = {
    pedido: { estado: 'entregado' },
    ruta: { fkid_ciudad: 7, fkid_repartidor: 3, fecha_ruta: '2026-10-07' },
  };
  await expect(reasignar({
    rutaPedido,
    fechaHoy: '2026-10-07',
    repartidor: { id: 8, fkid_ciudad: 7, estado: 'activo', nombre_completo: 'Marta' },
  })).rejects.toMatchObject({ status: 409 });
});

test('el mismo repartidor responde 422', async () => {
  const rutaPedido = {
    pedido: { estado: 'en_camino' },
    ruta: { fkid_ciudad: 7, fkid_repartidor: 8, fecha_ruta: '2026-10-07' },
  };
  await expect(reasignar({
    rutaPedido,
    fechaHoy: '2026-10-07',
    repartidor: { id: 8, fkid_ciudad: 7, estado: 'activo', nombre_completo: 'Marta' },
  })).rejects.toMatchObject({ status: 422 });
});

test('otra ciudad responde 403', async () => {
  const rutaPedido = {
    pedido: { estado: 'en_camino' },
    ruta: { fkid_ciudad: 7, fkid_repartidor: 3, fecha_ruta: '2026-10-07' },
  };
  await expect(reasignar({
    rutaPedido,
    fechaHoy: '2026-10-07',
    repartidor: { id: 8, fkid_ciudad: 9, estado: 'inactivo', nombre_completo: 'Marta' },
  })).rejects.toMatchObject({ status: 403 });
});

test('la lista deja fuera lo leído y arma el detalle sin código', async () => {
  const abierta = {
    id: 1,
    leida: false,
    prioridad: 'alta',
    fecha_creacion: '2026-10-07',
    hora_creacion: '09:00:00',
    datos: { tipo: 'check_in', estado_solicitud: 'abierta', repartidor_id: 3, jornada_id: 5 },
  };
  const models = {
    Notificacion: { findAll: async () => [abierta, { ...abierta, id: 2, leida: true }] },
    Repartidor: { findByPk: async () => ({ id: 3, nombre_completo: 'Luis' }) },
    JornadaRepartidor: { findByPk: async () => ({ id: 5, cargas: [{ nombre: 'Arena', cantidad: 1, precio_unitario: 10, es_extra: false }] }) },
    Pedido: { findByPk: async () => null },
  };
  const list = await listarSolicitudes({ models });
  expect(list.map((row) => row.id)).toEqual([1]);
  const detail = await detalleSolicitud({ models, notificacionId: 1, notificacion: abierta });
  expect(detail.cargas[0].nombre).toBe('Arena');
  expect(detail.codigo_entrega).toBeUndefined();
});

test('los pedidos del día salen con teléfono y sin código', async () => {
  const models = {
    City: { findByPk: async () => ({ timezone: 'America/Mexico_City' }) },
    RutaPedido: {
      findAll: async () => [{
        id: 9,
        estado_entrega: 'pendiente',
        pedido: {
          id: 4,
          numero_pedido: 'P-4',
          estado: 'confirmado',
          codigo_entrega: '999999',
          telefono_referencia: '',
          direccion_entrega: 'Calle 1',
          cliente: { nombre_completo: 'Ana', telefono: '618222' },
        },
        ruta: { fkid_ciudad: 2, fkid_repartidor: 3, repartidor: { id: 3, nombre_completo: 'Luis' } },
      }],
    },
  };
  const rows = await listarPedidos({ models, now: new Date('2026-10-07T18:00:00Z') });
  expect(rows[0].telefono).toBe('618222');
  expect(rows[0].codigo_entrega).toBeUndefined();
});

test('repartidores excluye inactivos', async () => {
  const { Op } = require('sequelize');
  const models = {
    Repartidor: {
      findAll: async (query) => {
        expect(query.where.fkid_ciudad).toBe(2);
        expect(query.where.estado[Op.in]).toEqual(['activo', 'disponible', 'ocupado', 'en_ruta']);
        return [{ id: 3, nombre_completo: 'Luis', estado: 'activo' }];
      },
    },
  };
  const rows = await listarRepartidores({ models, ciudadId: 2 });
  expect(rows).toEqual([{ id: 3, nombre_completo: 'Luis', estado: 'activo' }]);
});
