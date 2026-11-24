const { avisar, enviar, guardarToken, borrarToken } = require('./index');

test('enviar manda notification y borra tokens muertos', async () => {
  const sent = [];
  const vivo = { token: 'token-vivo', destroy: jest.fn() };
  const muerto = { token: 'token-muerto', destroy: jest.fn() };
  const messaging = {
    send: async (payload) => {
      sent.push(payload);
      if (payload.token === 'token-muerto') {
        const err = new Error('gone');
        err.code = 'messaging/registration-token-not-registered';
        throw err;
      }
    },
  };
  const result = await enviar(4, {
    titulo: 'Te asignaron un pedido',
    mensaje: 'Revisa tu ruta.',
    data: { pedidoId: 9 },
  }, {
    messaging,
    models: { RepartidorPushToken: { findAll: async () => [vivo, muerto] } },
  });
  expect(result).toEqual({ sent: 1 });
  expect(sent[0].notification).toEqual({ title: 'Te asignaron un pedido', body: 'Revisa tu ruta.' });
  expect(sent[0].data).toEqual({ pedidoId: '9' });
  expect(muerto.destroy).toHaveBeenCalled();
  expect(vivo.destroy).not.toHaveBeenCalled();
});

test('avisar manda socket y FCM solo si hay aviso', async () => {
  const notify = jest.fn(() => 1);
  const enviarFn = jest.fn(async () => ({ sent: 1 }));
  const event = { type: 'ruta.actualizada', pedidoId: 9 };
  expect(avisar(4, event, { titulo: 'Hola', mensaje: 'Mundo' }, { notify, enviar: enviarFn })).toBe(1);
  expect(notify).toHaveBeenCalledWith(4, event);
  await Promise.resolve();
  expect(enviarFn).toHaveBeenCalled();
  enviarFn.mockClear();
  avisar(4, event, null, { notify, enviar: enviarFn });
  await Promise.resolve();
  expect(enviarFn).not.toHaveBeenCalled();
});

test('guardarToken crea o mueve el token al repartidor', async () => {
  const rows = [];
  const models = {
    RepartidorPushToken: {
      findOne: async ({ where }) => rows.find((row) => row.token === where.token) || null,
      create: async (data) => {
        const row = { ...data, update: async (patch) => Object.assign(row, patch) };
        rows.push(row);
        return row;
      },
      destroy: async ({ where }) => {
        const keep = rows.filter((row) => !(row.fkid_repartidor === where.fkid_repartidor && (!where.token || row.token === where.token)));
        rows.length = 0;
        rows.push(...keep);
      },
    },
  };
  await guardarToken({ repartidorId: 4, token: 'x'.repeat(20), models });
  expect(rows).toEqual([expect.objectContaining({ fkid_repartidor: 4, plataforma: 'android' })]);
  await guardarToken({ repartidorId: 8, token: 'x'.repeat(20), models });
  expect(rows).toHaveLength(1);
  expect(rows[0].fkid_repartidor).toBe(8);
  await borrarToken({ repartidorId: 8, token: 'x'.repeat(20), models });
  expect(rows).toHaveLength(0);
});
