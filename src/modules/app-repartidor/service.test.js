const { replaceCarga, leerSolicitud, toPedidoDto, noEntregar, detallePedido } = require('./service');

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
