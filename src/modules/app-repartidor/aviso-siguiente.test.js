const { minutosEntre, quiereReagendar, componentes, TEMPLATE } = require('./aviso-siguiente');

test('pedido_siguiente lleva nombre y minutos, no el código', () => {
  const body = componentes('TEST Axell', 12);
  expect(TEMPLATE).toBe('pedido_siguiente');
  expect(body[0].parameters.map((item) => item.text)).toEqual(['TEST Axell', '12']);
  expect(JSON.stringify(body)).not.toMatch(/\d{6}/);
});

test('minutosEntre lee la duración y no inventa si falta', async () => {
  const httpGet = async () => ({
    data: { rows: [{ elements: [{ status: 'OK', duration: { value: 540 } }] }] },
  });
  const minutos = await minutosEntre(
    { lat: 24.02, lng: -104.65 },
    { lat: 24.04, lng: -104.66 },
    'key',
    httpGet
  );
  expect(minutos).toBe(9);
  expect(await minutosEntre(null, { lat: 1, lng: 1 }, 'key', httpGet)).toBeNull();
  expect(await minutosEntre({ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, '', httpGet)).toBeNull();
});

test('el menú ofrece Ok listo y No puedo, con minutos solo si existen', () => {
  const { menuDeSiguiente } = require('./aviso-siguiente');
  const conMinutos = menuDeSiguiente('Ana', 8);
  expect(conMinutos.body.text).toMatch(/8 min/);
  expect(conMinutos.action.buttons.map((item) => item.reply.id)).toEqual(['ok_listo', 'no_puedo']);
  expect(menuDeSiguiente('Ana', null).body.text).not.toMatch(/\d+ min/);
});

test('quiereReagendar reconoce que el cliente no puede recibir', () => {
  expect(quiereReagendar('No puedo recibir hoy')).toBe(true);
  expect(quiereReagendar('quiero reagendar')).toBe(true);
  expect(quiereReagendar('ya llegué')).toBe(false);
});
