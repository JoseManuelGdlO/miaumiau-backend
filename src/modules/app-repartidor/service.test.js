const { replaceCarga, leerSolicitud, solicitarValidacion, refrescarCargaEnValidacion, obtenerJornada, toPedidoDto, noEntregar, detallePedido } = require('./service');

function rutaConArena() {
  return [{
    estado: 'planificada',
    pedidos: [
      {
        pedido: {
          estado: 'confirmado',
          total: 80,
          productos: [
            { fkid_producto: 4, cantidad: 2, precio_unidad: 10, baja_logica: false, producto: { id: 4, nombre: 'Arena' } },
          ],
          paquetes: [{
            cantidad: 1,
            paquete: {
              productos: [{
                fkid_producto: 4,
                cantidad: 3,
                producto: { id: 4, nombre: 'Arena', precio_venta: 15 },
              }],
            },
          }],
        },
      },
      {
        pedido: {
          estado: 'cancelado',
          total: 999,
          productos: [
            { fkid_producto: 4, cantidad: 50, precio_unidad: 10, producto: { id: 4, nombre: 'Arena' } },
          ],
        },
      },
    ],
  }];
}

test('replaceCarga responde 403', async () => {
  await expect(replaceCarga({
    lineas: [{ nombre: 'Arena', cantidad: 2, precio_unitario: 10, es_extra: true }],
  })).rejects.toMatchObject({ status: 403, message: 'La carga la calcula el sistema' });
});

test('solicitarValidacion persiste la carga calculada', async () => {
  const created = [];
  const jornada = {
    id: 3,
    fkid_repartidor: 1,
    estado: 'borrador',
    cargas: [],
    update: async (data) => Object.assign(jornada, data),
  };
  let aviso;
  const updates = [];
  const result = await solicitarValidacion({
    jornada,
    repartidorId: 1,
    fecha: '2026-10-09',
    repartidor: { nombre_completo: 'Ana Ruiz' },
    models: {
      Ruta: { findAll: async () => rutaConArena() },
      JornadaCarga: {
        destroy: async () => {},
        bulkCreate: async (rows) => { created.push(...rows); },
      },
    },
    crearNotificacion: async (payload) => {
      aviso = payload;
      return {
        id: 9,
        update: async (patch) => { updates.push(patch); },
      };
    },
  });
  expect(created).toEqual([
    expect.objectContaining({
      fkid_jornada: 3,
      nombre: 'Arena',
      fkid_producto: 4,
      cantidad: 5,
      precio_unitario: 10,
      es_extra: false,
    }),
  ]);
  expect(jornada.estado).toBe('esperando_call_center');
  expect(Number(jornada.dinero_esperado)).toBe(80);
  expect(jornada.fkid_notificacion).toBe(9);
  expect(result.notificacion_id).toBe(9);
  expect(aviso).toMatchObject({
    nombre: 'Validar carga de Ana Ruiz',
    descripcion: 'Ana Ruiz',
    datos: expect.objectContaining({
      tipo: 'check_in',
      repartidor_nombre: 'Ana Ruiz',
      repartidor_id: 1,
      jornada_id: 3,
    }),
  });
  expect(updates[0].datos.actionUrl).toBe('/dashboard/call-center?tab=validacion&solicitud=9');
});

test('solicitarValidacion reutiliza la solicitud abierta del check-in', async () => {
  const updates = [];
  const notificacion = {
    id: 9,
    leida: false,
    datos: {
      tipo: 'check_in',
      estado_solicitud: 'abierta',
      espera_reenvio: true,
      jornada_id: 3,
      repartidor_id: 1,
      archivada: true,
    },
    update: async (patch) => {
      updates.push(patch);
      Object.assign(notificacion, patch);
    },
  };
  const jornada = {
    id: 3,
    fkid_repartidor: 1,
    fkid_notificacion: 9,
    estado: 'borrador',
    cargas: [],
    update: async (data) => Object.assign(jornada, data),
  };
  const result = await solicitarValidacion({
    jornada,
    repartidorId: 1,
    fecha: '2026-10-09',
    models: {
      Ruta: { findAll: async () => rutaConArena() },
      JornadaCarga: { destroy: async () => {}, bulkCreate: async () => {} },
      Notificacion: { findByPk: async () => notificacion },
    },
    crearNotificacion: async () => { throw new Error('no debía crear otra solicitud'); },
  });
  expect(result.notificacion_id).toBe(9);
  expect(jornada.fkid_notificacion).toBe(9);
  expect(jornada.estado).toBe('esperando_call_center');
  expect(updates[0].datos.espera_reenvio).toBe(false);
  expect(updates[0].datos.estado_solicitud).toBe('abierta');
  expect(updates[0].datos.archivada).toBe(true);
});

test('solicitarValidacion responde 422 sin productos en la ruta', async () => {
  await expect(solicitarValidacion({
    repartidorId: 1,
    fecha: '2026-10-09',
    models: { Ruta: { findAll: async () => [] } },
  })).rejects.toMatchObject({ status: 422, message: 'No hay productos en la ruta de hoy' });
});

test('refrescarCargaEnValidacion reescribe la ruta y conserva el extra', async () => {
  const destroyed = [];
  const created = [];
  const jornada = {
    id: 3,
    estado: 'esperando_call_center',
    fkid_notificacion: 9,
    cargas: [
      { nombre: 'Vieja', fkid_producto: 4, cantidad: 1, precio_unitario: 10, es_extra: false },
      { nombre: 'Snack', fkid_producto: 8, cantidad: 2, precio_unitario: 10, es_extra: true },
    ],
    update: async (data) => Object.assign(jornada, data),
  };
  const refreshed = await refrescarCargaEnValidacion({
    jornada,
    repartidorId: 1,
    fecha: new Date('2026-10-09T00:00:00Z'),
    models: {
      Ruta: { findAll: async () => rutaConArena() },
      JornadaCarga: {
        destroy: async (query) => { destroyed.push(query); },
        bulkCreate: async (rows) => { created.push(...rows); },
      },
    },
  });
  expect(refreshed).toBe(true);
  expect(destroyed).toEqual([{ where: { fkid_jornada: 3, es_extra: false } }]);
  expect(created).toEqual([
    expect.objectContaining({ nombre: 'Arena', cantidad: 5, es_extra: false }),
  ]);
  expect(jornada.estado).toBe('esperando_call_center');
  expect(jornada.fkid_notificacion).toBe(9);
  expect(Number(jornada.dinero_esperado)).toBe(100);
});

test('refrescarCargaEnValidacion no toca una jornada que no está en validación', async () => {
  const jornada = {
    id: 3,
    estado: 'borrador',
    cargas: [{ nombre: 'Snack', fkid_producto: 8, cantidad: 2, precio_unitario: 10, es_extra: true }],
    update: async () => { throw new Error('no debía guardar'); },
  };
  const refreshed = await refrescarCargaEnValidacion({
    jornada,
    repartidorId: 1,
    fecha: '2026-10-09',
    models: {
      Ruta: { findAll: async () => { throw new Error('no debía leer la ruta'); } },
      JornadaCarga: { destroy: async () => { throw new Error('no debía borrar'); } },
    },
  });
  expect(refreshed).toBe(false);
  expect(jornada.estado).toBe('borrador');
});

test('obtenerJornada en borrador recalcula la ruta y conserva el extra', async () => {
  const data = await obtenerJornada({
    jornada: {
      id: 3,
      fecha: '2026-10-09',
      estado: 'borrador',
      fkid_notificacion: null,
      cargas: [{ nombre: 'Vieja', cantidad: 9, precio_unitario: 1, es_extra: true }],
      efectivo_a_depositar: 0,
      comprobante_deposito_path: null,
      cerrada_en: null,
    },
    models: { Ruta: { findAll: async () => rutaConArena() } },
  });
  expect(data.cargas).toEqual([
    expect.objectContaining({ nombre: 'Arena', cantidad: 5, es_extra: false }),
    expect.objectContaining({ nombre: 'Vieja', cantidad: 9, precio_unitario: 1, es_extra: true }),
  ]);
  expect(data.dinero_esperado).toBe(89);
  expect(data.validado_por_nombre).toBeNull();
});

test('solicitarValidacion conserva el producto extra al volver a enviar', async () => {
  const created = [];
  const jornada = {
    id: 3,
    fkid_repartidor: 1,
    estado: 'borrador',
    cargas: [{ nombre: 'Snack', fkid_producto: 8, cantidad: 2, precio_unitario: 10, es_extra: true }],
    update: async (data) => Object.assign(jornada, data),
  };
  await solicitarValidacion({
    jornada,
    repartidorId: 1,
    fecha: '2026-10-09',
    models: {
      Ruta: { findAll: async () => rutaConArena() },
      JornadaCarga: {
        destroy: async () => {},
        bulkCreate: async (rows) => { created.push(...rows); },
      },
    },
    crearNotificacion: async () => ({ id: 9, update: async () => {} }),
  });
  expect(created).toEqual(expect.arrayContaining([
    expect.objectContaining({ nombre: 'Arena', es_extra: false, cantidad: 5 }),
    expect.objectContaining({ nombre: 'Snack', fkid_producto: 8, cantidad: 2, es_extra: true }),
  ]));
  expect(jornada.estado).toBe('esperando_call_center');
  expect(Number(jornada.dinero_esperado)).toBe(100);
});

test('leerSolicitud valida la jornada solo si la notificación vigente está leída', async () => {
  const jornada = { id: 3, estado: 'esperando_call_center', fkid_notificacion: 9, update: async (data) => Object.assign(jornada, data) };
  const opened = await leerSolicitud({
    jornada,
    repartidorId: 1,
    notificacion: {
      id: 9,
      leida: true,
      datos: { tipo: 'check_in', estado_solicitud: 'abierta', jornada_id: 3, repartidor_id: 1 },
    },
  });
  expect(opened.atendida).toBe(true);
  expect(jornada.estado).toBe('validada');
});

test('leerSolicitud 403 si la notificación es de otro repartidor', async () => {
  await expect(
    leerSolicitud({
      repartidorId: 1,
      notificacion: {
        id: 9,
        leida: true,
        datos: { tipo: 'check_in', estado_solicitud: 'abierta', jornada_id: 3, repartidor_id: 2 },
      },
    })
  ).rejects.toMatchObject({ status: 403 });
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

test('noEntregar busca la llamada del pedido sin tope de 200', async () => {
  const queries = [];
  const record = (query) => {
    queries.push(query);
    return {
      leida: true,
      datos: { tipo: 'llamada_cliente', pedido_id: 5, estado_solicitud: 'abierta' },
    };
  };
  const pedido = { id: 5, estado: 'en_camino', update: async (data) => Object.assign(pedido, data) };
  const rutaPedido = { pedido, update: async (data) => Object.assign(rutaPedido, data) };
  await noEntregar({
    jornada: { estado: 'validada' },
    pedidoId: 5,
    repartidorId: 1,
    rutaPedido,
    models: {
      Notificacion: {
        findAll: async (query) => [record(query)],
        findOne: async (query) => record(query),
      },
    },
  });
  expect(queries).toHaveLength(1);
  expect(queries[0].limit).toBeUndefined();
  expect(queries[0].where.leida).toBe(true);
  expect(pedido.estado).toBe('no_entregado');
});

test('detallePedido no selecciona codigo_entrega', async () => {
  let pedidoInclude;
  const dto = await detallePedido({
    jornada: { estado: 'validada' },
    pedidoId: 7,
    repartidorId: 1,
    models: {
      RutaPedido: {
        findOne: async (query) => {
          pedidoInclude = query.include.find((item) => item.as === 'pedido');
          return {
            pedido: { id: 7, cliente: { id: 1, nombre_completo: 'Ana' } },
            ruta: { fkid_repartidor: 1 },
          };
        },
      },
    },
  });
  expect(pedidoInclude.attributes).toEqual({ exclude: ['codigo_entrega'] });
  expect(dto).not.toHaveProperty('codigo_entrega');
});
