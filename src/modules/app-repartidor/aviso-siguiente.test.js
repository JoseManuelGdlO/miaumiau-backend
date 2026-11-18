const {
  minutosEntre,
  quiereReagendar,
  componentes,
  TEMPLATE,
  ETA_PLANTILLA,
  menuDeSiguiente,
  avisarSiguiente,
} = require('./aviso-siguiente');

test('pedido_siguiente lleva nombre y unos, no el código ni un ETA', () => {
  const body = componentes('TEST Axell');
  expect(TEMPLATE).toBe('pedido_siguiente');
  expect(ETA_PLANTILLA).toBe('unos');
  expect(body[0].parameters.map((item) => item.text)).toEqual(['TEST Axell', 'unos']);
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

test('el menú ofrece Ok listo y No puedo, en camino y código, sin minutos', () => {
  const conMinutos = menuDeSiguiente('Ana', 8);
  expect(conMinutos.body.text).toMatch(/en camino/);
  expect(conMinutos.body.text).toMatch(/código de entrega/);
  expect(conMinutos.body.text).not.toMatch(/\d+ min/);
  expect(conMinutos.action.buttons.map((item) => item.reply.id)).toEqual(['ok_listo', 'no_puedo']);
  expect(menuDeSiguiente('Ana', null).body.text).not.toMatch(/\d+ min/);
});

test('quiereReagendar reconoce que el cliente no puede recibir', () => {
  expect(quiereReagendar('No puedo recibir hoy')).toBe(true);
  expect(quiereReagendar('quiero reagendar')).toBe(true);
  expect(quiereReagendar('ya llegué')).toBe(false);
});

function paradaAbierta(overrides = {}) {
  const parada = {
    id: 11,
    orden_entrega: 1,
    liberado_en: new Date(),
    aviso_siguiente_en: null,
    pedido: {
      id: 9,
      estado: 'en_camino',
      telefono_referencia: '6180000000',
      cliente: { id: 4, nombre_completo: 'Ana', telefono: '6180000000' },
    },
    update: async (data) => Object.assign(parada, data),
    ...overrides,
  };
  return parada;
}

test('si el interactivo falla sin ETA igual manda pedido_siguiente con unos', async () => {
  const templates = [];
  const parada = paradaAbierta();
  const result = await avisarSiguiente({
    avisarSiguiente: true,
    repartidorId: 1,
    fecha: '2026-11-17',
    paradaId: parada.id,
    getModels: () => ({
      Ruta: { findAll: async () => [{ pedidos: [parada] }] },
    }),
    sendWhatsAppInteractive: async () => ({ success: false }),
    sendWhatsAppTemplate: async (...args) => {
      templates.push(args);
      return { success: true };
    },
  }, null);
  expect(result).toEqual({ enviado: true, minutos: null });
  expect(templates[0][2]).toBe('pedido_siguiente');
  expect(templates[0][3].components[0].parameters.map((item) => item.text)).toEqual(['Ana', 'unos']);
  expect(parada.aviso_siguiente_en).toBeInstanceOf(Date);
});
