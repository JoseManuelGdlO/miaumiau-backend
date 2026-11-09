const { replaceCarga, leerSolicitud, solicitarValidacion, refrescarCargaEnValidacion, obtenerJornada, toPedidoDto, noEntregar, detallePedido, llegada, entregar, listarAvisos, avisarCodigoAlCrear, registrarUbicacion, registrarVelocidad, resumenVelocidad, ubicacionPedido } = require('./service');

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
      datos: {
        tipo: 'llamada_cliente',
        pedido_id: 5,
        estado_solicitud: 'abierta',
        espera_desde: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
        intento_liberado: true,
      },
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
  expect(queries[0].where.leida).toBeUndefined();
  expect(pedido.estado).toBe('no_entregado');
  expect(String(pedido.notas || '')).not.toContain('Volvió a la cola');
});

test('noEntregar no cierra la parada si Call Center no liberó el intento', async () => {
  const pedido = { id: 5, estado: 'en_camino', update: async () => { throw new Error('no'); } };
  await expect(noEntregar({
    jornada: { estado: 'validada' },
    pedidoId: 5,
    repartidorId: 1,
    rutaPedido: { pedido, update: async () => { throw new Error('no'); } },
    models: {
      Notificacion: {
        findAll: async () => [{
          datos: {
            tipo: 'llamada_cliente',
            pedido_id: 5,
            estado_solicitud: 'abierta',
            espera_desde: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
          },
        }],
      },
    },
  })).rejects.toMatchObject({ status: 403, message: 'Call Center tiene que liberar el intento' });
});

test('entregar a un tercero pide nombre y apellido', async () => {
  await expect(entregar({
    jornada: { estado: 'validada' },
    repartidorId: 1,
    rutaPedido: {
      codigo_validado_en: new Date(),
      entrega_tercero_en: new Date(),
      pedido: { estado: 'en_camino', total: 10 },
      update: async () => {},
    },
    metodo: 'efectivo',
    monto_efectivo: 10,
    receptorNombre: 'Ana',
    receptorFile: { filename: 'a.jpg' },
  })).rejects.toMatchObject({ status: 422, message: 'Escribe nombre y apellido de quien recibe' });
});

test('la campana solo lista avisos reales de Call Center', async () => {
  const avisos = await listarAvisos({
    repartidorId: 1,
    notificaciones: [
      { id: 1, datos: { tipo: 'llamada_cliente', llamada_atendida: true } },
      { id: 2, datos: { ayuda: 'tercero', autorizado: true } },
      { id: 3, datos: { tipo: 'soporte', motivo: 'incidencia' } },
    ],
  });
  expect(avisos).toEqual([
    {
      id: 1,
      tipo: 'CONTACTO_CLIENTE',
      titulo: 'Cliente contactado por Call Center',
      mensaje: 'Call Center ya se comunicó con el cliente',
      leido: false,
      created_at: null,
      pedido: null,
    },
    {
      id: 2,
      tipo: 'INSTRUCCION_ACTUALIZADA',
      titulo: 'Entrega a otra persona',
      mensaje: 'Call Center autorizó la entrega a otra persona',
      leido: false,
      created_at: null,
      pedido: null,
    },
  ]);
});

test('la campana lista el aviso de pago por transferencia', async () => {
  const avisos = await listarAvisos({
    repartidorId: 1,
    notificaciones: [
      {
        id: 9,
        descripcion: 'P-5',
        created_at: '2026-11-04T18:20:00.000Z',
        datos: { tipo: 'pago', pedido_id: 5, repartidor_id: 1 },
      },
    ],
  });
  expect(avisos).toEqual([
    {
      id: 9,
      tipo: 'INSTRUCCION_ACTUALIZADA',
      titulo: 'Pago por transferencia',
      mensaje: 'Call Center registró el pago por transferencia',
      leido: false,
      created_at: '2026-11-04T18:20:00.000Z',
      pedido: { id: 5, numero_pedido: 'P-5', cliente: { nombre_completo: null } },
    },
  ]);
});

test('la campana une pedido y cliente', async () => {
  const avisos = await listarAvisos({
    repartidorId: 1,
    notificaciones: [
      {
        id: 1,
        created_at: '2026-11-04T13:36:00.000Z',
        datos: { tipo: 'llamada_cliente', intento_liberado: true, pedido_id: 55 },
      },
    ],
    models: {
      Pedido: {
        findAll: async () => [{ id: 55, numero_pedido: '1042', cliente: { nombre_completo: 'Selma Embila' } }],
      },
      Cliente: {},
    },
  });
  expect(avisos).toEqual([
    {
      id: 1,
      tipo: 'LIBERACION',
      titulo: 'Intento de entrega liberado',
      mensaje: 'Call Center liberó el intento de entrega',
      leido: false,
      created_at: '2026-11-04T13:36:00.000Z',
      pedido: { id: 55, numero_pedido: '1042', cliente: { nombre_completo: 'Selma Embila' } },
    },
  ]);
});

test('noEntregar acepta la ayuda de tercero cuando ya pasaron 15 minutos', async () => {
  const pedido = { id: 5, estado: 'en_camino', productos: [], update: async (data) => Object.assign(pedido, data) };
  const rutaPedido = { pedido, update: async (data) => Object.assign(rutaPedido, data) };
  await noEntregar({
    jornada: { estado: 'validada' },
    pedidoId: 5,
    repartidorId: 1,
    rutaPedido,
    models: {
      Notificacion: {
        findAll: async () => [{
          datos: {
            tipo: 'soporte',
            ayuda: 'tercero',
            pedido_id: 5,
            espera_desde: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
          },
        }],
      },
    },
  });
  expect(pedido.estado).toBe('no_entregado');
  expect(rutaPedido.estado_entrega).toBe('fallido');
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

function pedidoConCodigo(extra = {}) {
  return {
    id: 7,
    codigo_entrega: '482193',
    telefono_referencia: '6181112233',
    cliente: { id: 1, nombre_completo: 'Ana', telefono: '6180000000' },
    ...extra,
  };
}

test('llegada marca la llegada sin enviar el código', async () => {
  let sent = false;
  const rutaPedido = {
    llego_en: null,
    pedido: pedidoConCodigo(),
    update: async (data) => Object.assign(rutaPedido, data),
  };
  await llegada({
    jornada: { estado: 'validada' },
    repartidorId: 1,
    rutaPedido,
    models: {},
    sendWhatsAppTemplate: async () => { sent = true; return { success: false }; },
  });
  expect(sent).toBe(false);
  expect(rutaPedido.estado_entrega).toBe('en_camino');
  expect(rutaPedido.llego_en).toBeInstanceOf(Date);
});

test('llegada marca la llegada aunque el pedido no tenga teléfono', async () => {
  let sent = false;
  const rutaPedido = {
    llego_en: null,
    pedido: pedidoConCodigo({ telefono_referencia: '   ', cliente: { id: 1, telefono: '' } }),
    update: async (data) => Object.assign(rutaPedido, data),
  };
  await llegada({
    jornada: { estado: 'validada' },
    repartidorId: 1,
    rutaPedido,
    models: {},
    sendWhatsAppTemplate: async () => { sent = true; return { success: true }; },
  });
  expect(sent).toBe(false);
  expect(rutaPedido.estado_entrega).toBe('en_camino');
});

test('llegada envía codigo_paquete y solo entonces marca la llegada', async () => {
  const sends = [];
  const pedido = pedidoConCodigo();
  const rutaPedido = {
    llego_en: null,
    pedido,
    update: async (data) => Object.assign(rutaPedido, data),
  };
  let pedidoQuery;
  const dto = await llegada({
    jornada: { estado: 'validada' },
    pedidoId: 7,
    repartidorId: 1,
    models: {
      RutaPedido: {
        findOne: async (query) => {
          pedidoQuery = query.include.find((item) => item.as === 'pedido');
          return rutaPedido;
        },
      },
      Conversacion: {
        findOne: async () => ({ whatsapp_phone_number_id: '111' }),
      },
    },
    sendWhatsAppTemplate: async (...args) => {
      sends.push(args);
      return { success: true };
    },
  });
  expect(pedidoQuery.attributes).toBeUndefined();
  expect(pedidoQuery.include[0].attributes).toEqual(['id', 'nombre_completo', 'lat', 'lng', 'direccion_geo', 'direccion_entrega', 'telefono']);
  expect(sends).toEqual([]);
  expect(rutaPedido.estado_entrega).toBe('en_camino');
  expect(rutaPedido.llego_en).toBeInstanceOf(Date);
  expect(dto).not.toHaveProperty('codigo_entrega');
  expect(dto).not.toHaveProperty('telefono_referencia');
  expect(dto.cliente).not.toHaveProperty('telefono');
});

test('llegada usa el teléfono del cliente y la línea por defecto', async () => {
  const sends = [];
  const rutaPedido = {
    llego_en: null,
    pedido: pedidoConCodigo({
      telefono_referencia: '',
      fkid_cliente: 4,
      cliente: { id: 4, nombre_completo: 'Ana', telefono: '6180000000' },
    }),
    update: async (data) => Object.assign(rutaPedido, data),
  };
  await llegada({
    jornada: { estado: 'validada' },
    repartidorId: 1,
    rutaPedido,
    models: {
      Conversacion: { findOne: async () => null },
    },
    sendWhatsAppTemplate: async (...args) => {
      sends.push(args);
      return { success: true };
    },
  });
  expect(sends).toEqual([]);
  expect(rutaPedido.estado_entrega).toBe('en_camino');
});

test('llegada no reenvía el código si ya llegó', async () => {
  let sent = false;
  const rutaPedido = {
    llego_en: new Date('2026-10-01T00:00:00Z'),
    pedido: pedidoConCodigo(),
    update: async () => { throw new Error('no debe actualizar'); },
  };
  const dto = await llegada({
    jornada: { estado: 'validada' },
    repartidorId: 1,
    rutaPedido,
    models: {},
    sendWhatsAppTemplate: async () => { sent = true; return { success: true }; },
  });
  expect(sent).toBe(false);
  expect(dto).not.toHaveProperty('codigo_entrega');
});

test('llegada genera el código antes de enviarlo', async () => {
  const pedido = pedidoConCodigo({ codigo_entrega: null, save: async () => {} });
  const rutaPedido = {
    llego_en: null,
    pedido,
    update: async (data) => Object.assign(rutaPedido, data),
  };
  let sentCode;
  await llegada({
    jornada: { estado: 'validada' },
    repartidorId: 1,
    rutaPedido,
    models: {},
    sendWhatsAppTemplate: async (_phone, _line, _name, options) => {
      sentCode = options.components[0].parameters[0].text;
      return { success: true };
    },
  });
  expect(pedido.codigo_entrega).toMatch(/^\d{6}$/);
  expect(sentCode).toBeUndefined();
});

test('avisarCodigoAlCrear manda codigo_paquete', async () => {
  const sends = [];
  await avisarCodigoAlCrear({
    models: {
      Conversacion: { findOne: async () => ({ whatsapp_phone_number_id: '111' }) },
    },
    sendWhatsAppTemplate: async (...args) => {
      sends.push(args);
      return { success: true };
    },
  }, pedidoConCodigo());
  expect(sends[0][2]).toBe('codigo_paquete');
});

test('avisarCodigoAlCrear no truena si WhatsApp falla', async () => {
  await expect(avisarCodigoAlCrear({
    sendWhatsAppTemplate: async () => { throw new Error('down'); },
  }, pedidoConCodigo())).resolves.toBeUndefined();
});

test('ubicacionPedido no navega a 0,0 y usa el cache del cliente', async () => {
  const update = jest.fn();
  const data = await ubicacionPedido({
    repartidorId: 3,
    rutaPedido: {
      lat: 0,
      lng: 0,
      link_ubicacion: 'https://maps.google.com/?q=0,0',
      update,
      ruta: { fkid_repartidor: 3, polyline_encoded: null },
      pedido: {
        direccion_entrega: 'Calle 1',
        cliente: { lat: 24.02, lng: -104.66, direccion_geo: 'calle 1', direccion_entrega: 'Calle 1' },
      },
    },
  });
  expect(data.lat).toBe(24.02);
  expect(data.lng).toBe(-104.66);
  expect(data.link_navegacion).toContain('24.02');
  expect(data.link_navegacion).not.toContain('destination=0,0');
  expect(update).toHaveBeenCalled();
});

test('ubicacionPedido usa el cache del cliente y no pega Geocoding ni Directions', async () => {
  const resolverDireccion = jest.fn();
  const httpGet = jest.fn();
  const data = await ubicacionPedido({
    repartidorId: 3,
    lat: 24.01,
    lng: -104.65,
    mapsApagada: false,
    apiKey: 'k',
    httpGet,
    resolver: { resolverDireccion },
    rutaPedido: {
      lat: 24.02,
      lng: -104.66,
      ruta: { fkid_repartidor: 3 },
      pedido: {
        direccion_entrega: 'Calle 1',
        cliente: { lat: 24.02, lng: -104.66, direccion_geo: 'calle 1' },
      },
    },
  });
  expect(data.lat).toBe(24.02);
  expect(data.polyline).toEqual([]);
  expect(resolverDireccion).not.toHaveBeenCalled();
  expect(httpGet).not.toHaveBeenCalled();
});

test('ubicacionPedido geocodifica la dirección si las coords son el GPS', async () => {
  const update = jest.fn();
  const data = await ubicacionPedido({
    repartidorId: 3,
    lat: 24.0277,
    lng: -104.6532,
    mapsApagada: false,
    apiKey: 'k',
    httpGet: async () => ({ data: { status: 'ZERO_RESULTS' } }),
    resolver: { resolverDireccion: async () => ({ lat: 24.05, lng: -104.70, formatted_address: 'Río, Durango' }) },
    rutaPedido: {
      lat: 24.0277,
      lng: -104.6532,
      update,
      ruta: { fkid_repartidor: 3 },
      pedido: {
        direccion_entrega: 'Río de Janeiro 200 Durango',
        cliente: { update: jest.fn() },
      },
    },
  });
  expect(data.lat).toBe(24.05);
  expect(data.lng).toBe(-104.70);
  expect(update).toHaveBeenCalled();
});

test('ubicacionPedido no usa el GPS como domicilio', async () => {
  const update = jest.fn();
  const data = await ubicacionPedido({
    repartidorId: 3,
    lat: 24.0277,
    lng: -104.6532,
    mapsApagada: true,
    rutaPedido: {
      lat: 24.0277,
      lng: -104.6532,
      update,
      ruta: { fkid_repartidor: 3 },
      pedido: { direccion_entrega: 'Río de Janeiro 200 Durango' },
    },
  });
  expect(data.lat).toBe(null);
  expect(data.link_waze).toContain('waze.com');
  expect(update).not.toHaveBeenCalled();
});

test('ubicacionPedido arma Waze con la dirección si no hay coords', async () => {
  const data = await ubicacionPedido({
    repartidorId: 3,
    mapsApagada: true,
    rutaPedido: {
      lat: null,
      lng: null,
      ruta: { fkid_repartidor: 3 },
      pedido: { direccion_entrega: 'Río de Janeiro 200 Durango' },
    },
  });
  expect(data.lat).toBe(null);
  expect(data.link_waze).toContain('waze.com');
  expect(data.link_waze).toContain('navigate=yes');
  expect(decodeURIComponent(data.link_waze)).toContain('Río de Janeiro');
});

test('registrarUbicacion persiste lat_actual del repartidor', async () => {
  const updates = [];
  const data = await registrarUbicacion({
    repartidorId: 3,
    lat: 24.0277,
    lng: -104.6532,
    models: {
      Repartidor: {
        update: async (fields, opts) => updates.push({ fields, opts }),
      },
    },
  });
  expect(data.lat).toBe(24.0277);
  expect(updates[0].fields.lat_actual).toBe(24.0277);
  expect(updates[0].opts.where).toEqual({ id: 3 });
});

test('registrarVelocidad guarda GPS y lectura', async () => {
  const created = [];
  const updates = [];
  await registrarVelocidad({
    repartidorId: 3,
    fecha: '2026-11-05',
    velocidad_kmh: 32,
    lat: 24.1,
    lng: -104.6,
    models: {
      Repartidor: { update: async (fields) => updates.push(fields) },
      LecturaVelocidad: {
        create: async (row) => created.push(row),
        findAll: async () => [{ fkid_repartidor: 3, velocidad_kmh: 32, repartidor: { nombre_completo: 'Ana', lat_actual: 24.1, lng_actual: -104.6 } }],
      },
      JornadaRepartidor: { findOne: async () => ({ id: 9 }) },
    },
  });
  expect(updates[0].lat_actual).toBe(24.1);
  expect(created[0].lat).toBe(24.1);
});

test('resumenVelocidad expone lat/lng de la lectura', async () => {
  const data = await resumenVelocidad({
    fecha: '2026-11-05',
    models: {
      LecturaVelocidad: {
        findAll: async () => [{
          fkid_repartidor: 3,
          velocidad_kmh: 12,
          lat: 24.02,
          lng: -104.66,
          ubicacion_at: '2026-11-05T18:00:00Z',
          repartidor: { nombre_completo: 'Ana' },
        }],
      },
    },
  });
  expect(data[0].lat).toBe(24.02);
  expect(data[0].lng).toBe(-104.66);
  expect(data[0].lecturas).toBe(1);
});
