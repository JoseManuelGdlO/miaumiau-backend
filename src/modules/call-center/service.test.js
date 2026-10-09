const { aprobar, atender, guardarExtras, buscarInventario, cambiarEstado, reasignar, listarSolicitudes, listarCargasValidadas, detalleSolicitud, listarPedidos, listarRepartidores } = require('./service');

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

test('aprobar marca leída, guarda quién aprobó y no valida la jornada', async () => {
  const jornada = {
    id: 3,
    estado: 'esperando_call_center',
    fkid_notificacion: 9,
    update: async (data) => Object.assign(jornada, data),
  };
  const n = notificacion();
  const result = await aprobar({
    notificacion: n,
    jornada,
    usuario: { id: 12, nombre_completo: 'Mariana G.' },
  });
  expect(result).toEqual({ atendida: true });
  expect(n.leida).toBe(true);
  expect(jornada.estado).toBe('esperando_call_center');
  expect(jornada.validado_por_usuario_id).toBe(12);
  expect(jornada.validado_por_nombre).toBe('Mariana G.');
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
  const result = await cambiarEstado({
    pedido,
    rutaPedido,
    estado: 'entregado',
    now,
    transaction: async (fn) => fn(),
  });
  expect(result).toEqual({ id: 4, estado: 'entregado' });
  expect(rutaPedido.estado_entrega).toBe('entregado');
  expect(rutaPedido.fecha_entrega_real).toBe(now);
});

test('cancelado deja la ruta en fallido sin fecha', async () => {
  const pedido = { id: 4, estado: 'pendiente', cancelar: async () => { pedido.estado = 'cancelado'; } };
  const rutaPedido = { estado_entrega: 'pendiente', update: async (patch) => Object.assign(rutaPedido, patch) };
  await cambiarEstado({
    pedido,
    rutaPedido,
    estado: 'cancelado',
    transaction: async (fn) => fn(),
    models: {
      ProductoPedido: { findAll: async () => [] },
      PaquetePedido: { findAll: async () => [] },
    },
  });
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
    transaction: async (fn) => fn(),
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

test('guardarExtras reemplaza solo las líneas extra y no marca leída', async () => {
  const destroyed = [];
  const created = [];
  const n = notificacion();
  const jornada = {
    id: 3,
    estado: 'esperando_call_center',
    fkid_notificacion: 9,
    cargas: [
      { id: 1, nombre: 'Arena', fkid_producto: 4, cantidad: 5, precio_unitario: 10, es_extra: false },
    ],
  };
  const result = await guardarExtras({
    notificacion: n,
    jornada,
    lineas: [{ fkid_producto: 8, cantidad: 2, precio_unitario: 15 }],
    models: {
      Inventario: { findByPk: async (id) => (id === 8 ? { id: 8, nombre: 'Snack' } : null) },
      JornadaCarga: {
        destroy: async (query) => { destroyed.push(query); },
        bulkCreate: async (rows) => { created.push(...rows); },
      },
    },
  });
  expect(n.leida).toBe(false);
  expect(destroyed[0].where).toEqual({ fkid_jornada: 3, es_extra: true });
  expect(created).toEqual([
    expect.objectContaining({
      fkid_jornada: 3,
      nombre: 'Snack',
      fkid_producto: 8,
      cantidad: 2,
      precio_unitario: 15,
      es_extra: true,
    }),
  ]);
  expect(result.cargas[0].es_extra).toBe(true);
  expect(jornada.cargas[0].es_extra).toBe(false);
});

test('guardarExtras responde 422 si el producto no existe', async () => {
  const n = notificacion();
  await expect(guardarExtras({
    notificacion: n,
    jornada: { id: 3, estado: 'esperando_call_center', fkid_notificacion: 9 },
    lineas: [{ fkid_producto: 99, cantidad: 1, precio_unitario: 10 }],
    models: { Inventario: { findByPk: async () => null } },
  })).rejects.toMatchObject({ status: 422, message: 'Producto extra sin inventario' });
});

test('buscarInventario devuelve id, nombre y precio', async () => {
  const rows = await buscarInventario({
    q: 'Are',
    models: {
      Inventario: {
        findAll: async (query) => {
          expect(query.limit).toBe(20);
          return [{ id: 4, nombre: 'Arena', precio_venta: '10.50' }];
        },
      },
    },
  });
  expect(rows).toEqual([{ id: 4, nombre: 'Arena', precio_venta: 10.5 }]);
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
    JornadaRepartidor: { findByPk: async () => ({ id: 5, dinero_esperado: 40, cargas: [{ id: 2, fkid_producto: 4, nombre: 'Arena', cantidad: 1, precio_unitario: 10, es_extra: false }] }) },
    Pedido: { findByPk: async () => null },
  };
  const list = await listarSolicitudes({ models });
  expect(list.map((row) => row.id)).toEqual([1]);
  const detail = await detalleSolicitud({ models, notificacionId: 1, notificacion: abierta });
  expect(detail.cargas[0]).toMatchObject({ id: 2, fkid_producto: 4, nombre: 'Arena', es_extra: false });
  expect(detail.dinero_esperado).toBe(40);
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

function parada(id, fecha, baja) {
  const row = {
    id,
    fkid_ruta: id,
    orden_entrega: 1,
    estado_entrega: 'en_camino',
    llego_en: new Date('2026-10-01T00:00:00Z'),
    codigo_validado_en: new Date('2026-10-01T00:00:00Z'),
    update: jest.fn(async (patch) => Object.assign(row, patch)),
    pedido: { id: 4, estado: 'en_camino', codigo_entrega: '123456' },
    ruta: {
      id,
      baja_logica: baja,
      fecha_ruta: fecha,
      fkid_ciudad: 7,
      fkid_repartidor: 3,
      total_pedidos: 2,
      estado: 'en_progreso',
      ciudad: { timezone: 'America/Mexico_City' },
      update: jest.fn(),
    },
  };
  row.ruta.update.mockImplementation(async (patch) => Object.assign(row.ruta, patch));
  return row;
}

test('cerrar actualiza la parada viva de hoy y no la baja', async () => {
  const now = new Date('2026-10-07T18:00:00Z');
  const ayer = parada(3, '2026-10-06', false);
  const baja = parada(2, '2026-10-01', true);
  const hoy = parada(1, '2026-10-07', false);
  const bajaHoy = parada(4, '2026-10-07', true);
  const pedido = { id: 4, estado: 'en_camino', entregar: async () => { pedido.estado = 'entregado'; } };
  const models = {
    RutaPedido: {
      findAll: async (query) => {
        expect(query.where).toEqual({ fkid_pedido: 4 });
        const ruta = query.include.find((item) => item.association === 'ruta');
        expect(ruta.required).toBe(true);
        expect(ruta.where).toEqual({ baja_logica: false });
        return [ayer, baja, hoy, bajaHoy];
      },
    },
  };
  await cambiarEstado({
    models,
    pedido,
    estado: 'entregado',
    now,
    transaction: async (fn) => fn(),
  });
  expect(hoy.estado_entrega).toBe('entregado');
  expect(hoy.fecha_entrega_real).toBe(now);
  expect(ayer.update).not.toHaveBeenCalled();
  expect(baja.update).not.toHaveBeenCalled();
  expect(bajaHoy.update).not.toHaveBeenCalled();
});

test('reasignar mueve la parada viva de hoy y no la baja', async () => {
  const now = new Date('2026-10-07T18:00:00Z');
  const tx = { id: 'tx' };
  const ayer = parada(3, '2026-10-06', false);
  const baja = parada(2, '2026-10-01', true);
  const hoy = parada(1, '2026-10-07', false);
  const bajaHoy = parada(4, '2026-10-07', true);
  const destino = { id: 20, total_pedidos: 0, estado: 'planificada', update: jest.fn(async (patch) => Object.assign(destino, patch)) };
  const models = {
    RutaPedido: {
      findAll: async (query) => (query.where.fkid_pedido != null ? [ayer, baja, hoy, bajaHoy] : []),
    },
    Ruta: {
      findAll: async () => [],
      create: async () => destino,
    },
  };
  const result = await reasignar({
    models,
    pedidoId: 4,
    now,
    repartidor: { id: 8, nombre_completo: 'Marta López', fkid_ciudad: 7, estado: 'activo' },
    transaction: async (fn) => fn(tx),
  });
  expect(result).toEqual({ ruta_id: 20, creada: true, orden_entrega: 1 });
  expect(hoy.update).toHaveBeenCalledWith(expect.objectContaining({ fkid_ruta: 20 }), { transaction: tx });
  expect(hoy.ruta.update).toHaveBeenCalledWith({ total_pedidos: 1 }, { transaction: tx });
  expect(destino.update).toHaveBeenCalledWith({ total_pedidos: 1 }, { transaction: tx });
  expect(ayer.update).not.toHaveBeenCalled();
  expect(baja.update).not.toHaveBeenCalled();
  expect(bajaHoy.update).not.toHaveBeenCalled();
  expect(hoy.pedido.estado).toBe('en_camino');
  expect(hoy.pedido.codigo_entrega).toBe('123456');
});

test('cerrar sin ruta de hoy responde 409 y no cambia el pedido', async () => {
  const pedido = { id: 4, estado: 'en_camino', entregar: jest.fn() };
  const baja = parada(2, '2026-10-01', true);
  await expect(cambiarEstado({
    pedido,
    estado: 'entregado',
    now: new Date('2026-10-07T18:00:00Z'),
    models: { RutaPedido: { findAll: async () => [baja] } },
  })).rejects.toMatchObject({ status: 409, message: 'Ese pedido no está en una ruta de hoy' });
  expect(pedido.entregar).not.toHaveBeenCalled();
  expect(baja.update).not.toHaveBeenCalled();
});

test('hoy se calcula en la zona de la ciudad, no en UTC', async () => {
  const pedido = { id: 4, estado: 'en_camino', entregar: jest.fn() };
  const mananaEnMexico = parada(1, '2026-10-08', false);
  await expect(cambiarEstado({
    pedido,
    estado: 'entregado',
    now: new Date('2026-10-08T05:30:00Z'),
    models: { RutaPedido: { findAll: async () => [mananaEnMexico] } },
  })).rejects.toMatchObject({ status: 409 });
  expect(pedido.entregar).not.toHaveBeenCalled();
});

test('cancelar desde pendiente restaura líneas y paquetes en la misma transacción', async () => {
  const tx = { id: 'tx' };
  const regalo = { id: 9, restaurarStock: jest.fn() };
  const directo = {
    id: 1,
    save: jest.fn(async () => {}),
    restaurarStock: jest.fn(function restaurarStock() {
      return this.save({ validate: false, fields: ['stock_inicial'] });
    }),
  };
  const enPaquete = {
    id: 2,
    save: jest.fn(async () => {}),
    restaurarStock: jest.fn(function restaurarStock() {
      return this.save({ validate: false, fields: ['stock_inicial'] });
    }),
  };
  const pedido = {
    id: 4,
    estado: 'pendiente',
    save: jest.fn(async function save() { this.estado = 'cancelado'; }),
    cancelar() { return this.save(); },
  };
  const rutaPedido = { update: jest.fn(async (patch) => Object.assign(rutaPedido, patch)) };
  const seen = [];
  const models = {
    ProductoPedido: {
      findAll: async (query) => {
        seen.push(query.transaction);
        return [
          { fkid_producto: null, cantidad: 1, producto: regalo },
          { fkid_producto: 1, cantidad: 2, producto: directo },
        ];
      },
    },
    PaquetePedido: {
      findAll: async (query) => {
        seen.push(query.transaction);
        return [{ fkid_paquete: 9, cantidad: 3 }];
      },
    },
    ProductoPaquete: {
      findAll: async (query) => {
        seen.push(query.transaction);
        return [{ fkid_producto: 2, cantidad: 4 }];
      },
    },
    Inventario: {
      findByPk: async (id, query) => {
        expect(id).toBe('2');
        expect(query.transaction).toBe(tx);
        return enPaquete;
      },
    },
  };
  await cambiarEstado({
    models,
    pedido,
    rutaPedido,
    estado: 'cancelado',
    transaction: async (fn) => fn(tx),
  });
  expect(seen).toEqual([tx, tx, tx]);
  expect(regalo.restaurarStock).not.toHaveBeenCalled();
  expect(directo.restaurarStock).toHaveBeenCalledWith(2);
  expect(enPaquete.restaurarStock).toHaveBeenCalledWith(12);
  expect(directo.save).toHaveBeenCalledWith(expect.objectContaining({ transaction: tx, validate: false }));
  expect(enPaquete.save).toHaveBeenCalledWith(expect.objectContaining({ transaction: tx, validate: false }));
  expect(pedido.save).toHaveBeenCalledWith(expect.objectContaining({ transaction: tx }));
  expect(rutaPedido.update).toHaveBeenCalledWith(
    { estado_entrega: 'fallido' },
    { transaction: tx },
  );
  expect(pedido.estado).toBe('cancelado');
});

test('cancelar desde confirmado también restaura la línea', async () => {
  const producto = { id: 1, restaurarStock: jest.fn(async () => {}) };
  const pedido = { id: 4, estado: 'confirmado', cancelar: async () => { pedido.estado = 'cancelado'; } };
  const rutaPedido = { update: async (patch) => Object.assign(rutaPedido, patch) };
  await cambiarEstado({
    pedido,
    rutaPedido,
    estado: 'cancelado',
    transaction: async (fn) => fn(),
    models: {
      ProductoPedido: { findAll: async () => [{ fkid_producto: 1, cantidad: 5, producto }] },
      PaquetePedido: { findAll: async () => [] },
    },
  });
  expect(producto.restaurarStock).toHaveBeenCalledWith(5);
});

test('cancelar en preparación o en camino no restaura stock', async () => {
  for (const estado of ['en_preparacion', 'en_camino']) {
    const pedido = { id: 4, estado, cancelar: async () => { pedido.estado = 'cancelado'; } };
    const rutaPedido = { update: async (patch) => Object.assign(rutaPedido, patch) };
    const models = { ProductoPedido: { findAll: jest.fn() } };
    await cambiarEstado({
      pedido,
      rutaPedido,
      estado: 'cancelado',
      models,
      transaction: async (fn) => fn(),
    });
    expect(models.ProductoPedido.findAll).not.toHaveBeenCalled();
    expect(rutaPedido.estado_entrega).toBe('fallido');
  }
});

test.each(['pendiente', 'confirmado'])('el pedido se relee con LOCK.UPDATE y el segundo cancelado desde %s no restaura', async (origen) => {
  const tx = { LOCK: { UPDATE: 'UPDATE' } };
  const lock = { transaction: tx, lock: 'UPDATE' };
  const restaurar = jest.fn(async () => {});
  let estado = origen;
  const pedido = { id: 4, estado: origen, baja_logica: false };
  const rutaPedido = { id: 9, update: async (patch) => Object.assign(rutaPedido, patch) };
  const models = {
    Pedido: {
      findByPk: jest.fn(async (id, opts) => {
        expect(id).toBe(4);
        expect(opts).toEqual(lock);
        return {
          id: 4,
          estado,
          baja_logica: false,
          cancelar() { estado = 'cancelado'; },
        };
      }),
    },
    RutaPedido: {
      findByPk: jest.fn(async (id, opts) => {
        expect(id).toBe(9);
        expect(opts).toEqual(lock);
        return rutaPedido;
      }),
    },
    ProductoPedido: {
      findAll: jest.fn(async () => [{ fkid_producto: 1, cantidad: 2, producto: { id: 1, restaurarStock: restaurar } }]),
    },
    PaquetePedido: { findAll: async () => [] },
  };
  const deps = {
    models,
    pedido,
    rutaPedido,
    estado: 'cancelado',
    transaction: async (fn) => fn(tx),
  };
  await cambiarEstado(deps);
  expect(restaurar).toHaveBeenCalledTimes(1);
  expect(models.Pedido.findByPk).toHaveBeenCalledWith(4, lock);
  await expect(cambiarEstado(deps)).rejects.toMatchObject({ status: 422 });
  expect(restaurar).toHaveBeenCalledTimes(1);
  expect(models.ProductoPedido.findAll).toHaveBeenCalledTimes(1);
});

test('reasignar bloquea el pedido, la parada y las rutas', async () => {
  const tx = { LOCK: { UPDATE: 'UPDATE' } };
  const lock = { transaction: tx, lock: 'UPDATE' };
  const pedido = { id: 4, estado: 'en_camino' };
  const ruta = {
    id: 1,
    fkid_ciudad: 7,
    fkid_repartidor: 3,
    fecha_ruta: '2026-10-07',
    total_pedidos: 2,
    update: jest.fn(async (patch) => Object.assign(ruta, patch)),
  };
  const rutaPedido = {
    id: 11,
    pedido,
    ruta,
    update: jest.fn(async (patch) => Object.assign(rutaPedido, patch)),
  };
  const destino = {
    id: 20,
    total_pedidos: 4,
    estado: 'planificada',
    update: jest.fn(async (patch) => Object.assign(destino, patch)),
  };
  const models = {
    Pedido: { findByPk: jest.fn(async () => pedido) },
    RutaPedido: {
      findByPk: jest.fn(async () => rutaPedido),
      findAll: async () => [{ orden_entrega: 3 }],
    },
    Ruta: {
      findByPk: jest.fn(async (id) => (id === 20 ? destino : ruta)),
      findAll: async (query) => {
        expect(query.lock).toBe('UPDATE');
        expect(query.transaction).toBe(tx);
        return [destino];
      },
    },
  };
  const result = await reasignar({
    models,
    rutaPedido,
    fechaHoy: '2026-10-07',
    repartidor: { id: 8, nombre_completo: 'Marta López', fkid_ciudad: 7, estado: 'activo' },
    transaction: async (fn) => fn(tx),
  });
  expect(result).toEqual({ ruta_id: 20, creada: false, orden_entrega: 4 });
  expect(models.Pedido.findByPk).toHaveBeenCalledWith(4, lock);
  expect(models.RutaPedido.findByPk).toHaveBeenCalledWith(11, lock);
  expect(models.Ruta.findByPk).toHaveBeenCalledWith(1, lock);
  expect(models.Ruta.findByPk).toHaveBeenCalledWith(20, lock);
  expect(rutaPedido.update).toHaveBeenCalledWith(expect.objectContaining({ fkid_ruta: 20 }), { transaction: tx });
  expect(ruta.update).toHaveBeenCalledWith({ total_pedidos: 1 }, { transaction: tx });
  expect(destino.update).toHaveBeenCalledWith({ total_pedidos: 5 }, { transaction: tx });
});

test('un repartidor dado de baja responde 403', async () => {
  const rutaPedido = {
    update: jest.fn(),
    pedido: { estado: 'en_camino' },
    ruta: { fkid_ciudad: 7, fkid_repartidor: 3, fecha_ruta: '2026-10-07', update: jest.fn() },
  };
  await expect(reasignar({
    rutaPedido,
    fechaHoy: '2026-10-07',
    repartidor: { id: 8, fkid_ciudad: 7, estado: 'activo', baja_logica: true, nombre_completo: 'Marta' },
  })).rejects.toMatchObject({ status: 403 });
  expect(rutaPedido.update).not.toHaveBeenCalled();
});

test('repartidores sin ciudad responde 422', async () => {
  const models = { Repartidor: { findAll: jest.fn() } };
  await expect(listarRepartidores({ models })).rejects.toMatchObject({ status: 422 });
  await expect(listarRepartidores({ models, ciudadId: '' })).rejects.toMatchObject({ status: 422 });
  expect(models.Repartidor.findAll).not.toHaveBeenCalled();
});

test('el histórico deja fuera abiertas y canceladas', async () => {
  const list = await listarCargasValidadas({
    rows: [
      { id: 1, leida: false, prioridad: 'alta', fecha_creacion: '2026-10-09', hora_creacion: '09:00:00', datos: { tipo: 'check_in', estado_solicitud: 'abierta', jornada_id: 3, repartidor_id: 1 } },
      { id: 2, leida: true, prioridad: 'alta', fecha_creacion: '2026-10-09', hora_creacion: '10:00:00', datos: { tipo: 'check_in', estado_solicitud: 'abierta', jornada_id: 5, repartidor_id: 3 } },
      { id: 3, leida: true, prioridad: 'alta', fecha_creacion: '2026-10-09', hora_creacion: '11:00:00', datos: { tipo: 'check_in', estado_solicitud: 'cancelada', jornada_id: 6, repartidor_id: 3 } },
    ],
    models: {
      Repartidor: { findByPk: async (id) => ({ id, nombre_completo: 'Luis' }) },
      JornadaRepartidor: {
        findByPk: async () => ({
          dinero_esperado: 80,
          validado_por_nombre: 'Mariana G.',
          cargas: [{ id: 1, fkid_producto: 4, nombre: 'Arena', cantidad: 2, precio_unitario: 10, es_extra: false }],
        }),
      },
    },
  });
  expect(list.map((row) => row.id)).toEqual([2]);
  expect(list[0].validado_por_nombre).toBe('Mariana G.');
  expect(list[0].dinero_esperado).toBe(80);
  expect(list[0].cargas[0].nombre).toBe('Arena');
});

test('la cola consulta solo solicitudes abiertas', async () => {
  const { Op } = require('sequelize');
  let seen;
  const models = {
    Notificacion: { findAll: async (query) => { seen = query; return []; } },
  };
  await listarSolicitudes({ models });
  expect(seen.where.leida).toBe(false);
  const sql = seen.where[Op.and].map((part) => part.val).join('\n');
  expect(sql).toContain("'check_in'");
  expect(sql).toContain("'llamada_cliente'");
  expect(sql).toContain("'soporte'");
  expect(sql).toContain('estado_solicitud');
  expect(sql).toContain('cancelada');
});

test('deps.rows no consulta la base', async () => {
  const models = {
    Notificacion: { findAll: async () => { throw new Error('consulta'); } },
    Repartidor: { findByPk: async () => null },
    Pedido: { findByPk: async () => null },
  };
  const list = await listarSolicitudes({
    models,
    rows: [
      {
        id: 1,
        leida: false,
        prioridad: 'alta',
        fecha_creacion: '2026-10-07',
        hora_creacion: '09:00:00',
        datos: { tipo: 'soporte', estado_solicitud: 'abierta' },
      },
      { id: 2, leida: false, datos: { tipo: 'stock', estado_solicitud: 'abierta' } },
    ],
  });
  expect(list.map((row) => row.id)).toEqual([1]);
});

test('atender relee y bloquea la solicitud antes de anotar', async () => {
  const tx = { LOCK: { UPDATE: 'UPDATE' } };
  const n = notificacion({
    datos: { tipo: 'llamada_cliente', estado_solicitud: 'abierta', pedido_id: 5 },
  });
  n.update = jest.fn(async (patch) => Object.assign(n, patch));
  const pedido = {
    id: 5,
    notas: '[Call Center 2026-10-07 12:40] Primera',
    ciudad: { timezone: 'America/Mexico_City' },
    update: jest.fn(async (patch) => Object.assign(pedido, patch)),
  };
  const models = {
    Notificacion: {
      findByPk: jest.fn(async (_id, opts) => {
        expect(opts).toEqual({ transaction: tx, lock: 'UPDATE' });
        return n;
      }),
    },
    Pedido: {
      findByPk: jest.fn(async (_id, opts) => {
        expect(opts).toEqual({ transaction: tx, lock: 'UPDATE' });
        return pedido;
      }),
    },
  };
  await atender({
    models,
    notificacionId: 9,
    nota: 'Segunda',
    now: new Date('2026-10-07T18:45:00Z'),
    transaction: async (fn) => fn(tx),
  });
  expect(pedido.notas).toBe('[Call Center 2026-10-07 12:40] Primera\n[Call Center 2026-10-07 12:45] Segunda');
  expect(n.update).toHaveBeenCalledWith(expect.objectContaining({ leida: true }), { transaction: tx });
  expect(pedido.update).toHaveBeenCalledWith(expect.any(Object), { transaction: tx });
});

test('atender no anota si la relectura ya está leída', async () => {
  const tx = { LOCK: { UPDATE: 'UPDATE' } };
  const n = notificacion({
    leida: true,
    datos: { tipo: 'llamada_cliente', estado_solicitud: 'abierta', pedido_id: 5 },
  });
  const models = {
    Notificacion: { findByPk: async () => n },
    Pedido: { findByPk: async () => { throw new Error('no leer el pedido'); } },
  };
  await expect(atender({
    models,
    notificacionId: 9,
    nota: 'tarde',
    transaction: async (fn) => fn(tx),
  })).rejects.toMatchObject({ status: 409 });
  expect(n.leida).toBe(true);
});

test('aprobar avisa al repartidor de la jornada', async () => {
  const notify = jest.fn();
  const jornada = {
    id: 3,
    fkid_repartidor: 8,
    estado: 'esperando_call_center',
    fkid_notificacion: 9,
    update: async (data) => Object.assign(jornada, data),
  };
  await aprobar({
    notificacion: notificacion(),
    jornada,
    usuario: { id: 12, nombre_completo: 'Mariana G.' },
    notify,
  });
  expect(notify).toHaveBeenCalledWith(8, { type: 'solicitud.atendida' });
});

test('guardar extras avisa y un notify roto no falla el guardado', async () => {
  const notify = jest.fn(() => {
    throw new Error('socket caído');
  });
  const jornada = {
    id: 3,
    fkid_repartidor: 8,
    estado: 'esperando_call_center',
    fkid_notificacion: 9,
  };
  const result = await guardarExtras({
    notificacion: notificacion(),
    jornada,
    lineas: [{ fkid_producto: 4, cantidad: 2, precio_unitario: 10 }],
    notify,
    models: {
      Inventario: { findByPk: async () => ({ id: 4, nombre: 'Arena', precio_venta: 10, baja_logica: false }) },
      JornadaCarga: { destroy: async () => {}, bulkCreate: async () => {} },
    },
  });
  expect(result.cargas[0].es_extra).toBe(true);
  expect(notify).toHaveBeenCalledWith(8, { type: 'jornada.actualizada' });
});

test('cancelar avisa al repartidor de la ruta de hoy', async () => {
  const notify = jest.fn();
  const pedido = { id: 4, estado: 'en_camino', baja_logica: false, cancelar: async () => { pedido.estado = 'cancelado'; } };
  const rutaPedido = {
    id: 11,
    estado_entrega: 'en_camino',
    update: async (patch) => Object.assign(rutaPedido, patch),
    ruta: { fkid_repartidor: 8 },
  };
  await cambiarEstado({
    pedido,
    rutaPedido,
    estado: 'cancelado',
    pedidoId: 4,
    notify,
    transaction: async (fn) => fn({}),
  });
  expect(notify).toHaveBeenCalledWith(8, { type: 'ruta.actualizada', pedidoId: 4 });
});

test('confirmar no avisa porque no toca la ruta', async () => {
  const notify = jest.fn();
  const pedido = { id: 4, estado: 'pendiente', baja_logica: false, confirmar: async () => { pedido.estado = 'confirmado'; } };
  await cambiarEstado({
    pedido,
    estado: 'confirmado',
    pedidoId: 4,
    notify,
    transaction: async (fn) => fn({}),
  });
  expect(notify).not.toHaveBeenCalled();
});

test('reasignar avisa al repartidor que suelta y al que recibe', async () => {
  const notify = jest.fn();
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
    pedido: { id: 4, estado: 'en_camino', codigo_entrega: '123456', baja_logica: false },
    ruta: {
      id: 1,
      fkid_ciudad: 7,
      fkid_repartidor: 3,
      fecha_ruta: '2026-10-07',
      total_pedidos: 2,
      estado: 'en_progreso',
      baja_logica: false,
      update: async (patch) => Object.assign(rutaPedido.ruta, patch),
    },
  };
  const destino = { id: 20, total_pedidos: 0, update: async (patch) => Object.assign(destino, patch) };
  const models = {
    Ruta: {
      findAll: async () => [],
      create: async (row) => { created.push(row); return destino; },
    },
    RutaPedido: { findAll: async () => [] },
  };
  await reasignar({
    models,
    rutaPedido,
    fechaHoy: '2026-10-07',
    pedidoId: 4,
    repartidor: { id: 9, nombre_completo: 'Ana', fkid_ciudad: 7, estado: 'activo', baja_logica: false },
    notify,
    transaction: async (fn) => fn(),
  });
  expect(notify).toHaveBeenCalledWith(3, { type: 'ruta.actualizada', pedidoId: 4 });
  expect(notify).toHaveBeenCalledWith(9, { type: 'ruta.actualizada', pedidoId: 4 });
});
