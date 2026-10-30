const { avisarNoEncontrado } = require('./reagendar-whatsapp');

test('nadie avisa por WhatsApp que el pedido quedó para el día siguiente', async () => {
  const calls = [];
  const ok = await avisarNoEncontrado({
    telefono: '5216180000000',
    linea: '1',
    send: async (...args) => {
      calls.push(args);
      return { success: true };
    },
  });
  expect(ok).toBe(true);
  expect(calls[0][1]).toMatch(/no contestaron/);
  expect(calls[0][1]).toMatch(/reagendado/);
  expect(await avisarNoEncontrado({ telefono: '', linea: '1', send: async () => ({ success: true }) })).toBe(false);
});
