const { decidirLectura, historialDesde, marcasDeTiempo, normalizarTipo } = require('./evidencia');

const confianzaLlena = {
  kilometraje: 'alta',
  odometro_tablero: 'alta',
  odometro_ticket: null,
  costo_mxn: null,
  litros: null,
  fecha_hora_ticket: null,
  precio_litro: null,
  estacion: null,
  folio: null,
};

function lectura(extra) {
  return {
    legible: true,
    motivo: '',
    kilometraje: null,
    odometro_tablero: null,
    odometro_ticket: null,
    costo_mxn: null,
    litros: null,
    fecha_hora_ticket: null,
    precio_litro: null,
    estacion: null,
    folio: null,
    confianza: confianzaLlena,
    ...extra,
  };
}

test('inicio se trata como odómetro y un tipo desconocido falla', () => {
  expect(normalizarTipo('inicio')).toBe('odometro');
  expect(() => normalizarTipo('whatsapp')).toThrow('Tipo de foto inválido');
});

test('una lectura completa del odómetro queda validada', () => {
  const decision = decidirLectura('odometro', lectura({
    kilometraje: 182249,
    odometro_tablero: 182249,
  }));
  expect(decision.estado).toBe('validada');
  expect(decision.kilometraje).toBe(182249);
  expect(decision.costo_mxn).toBeNull();
  expect(decision.alertas).toEqual([]);
});

test('si nada se lee la foto se rechaza', () => {
  const decision = decidirLectura('combustible', lectura({
    legible: false,
    motivo: 'El ticket está borroso',
    confianza: { ...confianzaLlena },
  }));
  expect(decision.estado).toBe('rechazada');
  expect(decision.costo_mxn).toBeNull();
  expect(decision.confianza).toBeNull();
});

test('una lectura ilegible con datos parciales se conserva para revisión', () => {
  const confianza = { ...confianzaLlena, costo_mxn: 'baja', litros: 'media' };
  const decision = decidirLectura('combustible', lectura({
    legible: false,
    motivo: 'El ticket está borroso',
    costo_mxn: 800,
    litros: 20,
    confianza,
  }));
  expect(decision.estado).toBe('revision');
  expect(decision.costo_mxn).toBe(800);
  expect(decision.litros).toBe(20);
  expect(decision.confianza).toEqual(confianza);
  expect(decision.alertas.map((alerta) => alerta.codigo)).toContain('UNREADABLE');
});

test('sin fecha, monto o kilometraje queda en revisión', () => {
  const decision = decidirLectura('combustible', lectura({
    kilometraje: 100,
    odometro_tablero: 100,
    costo_mxn: 800,
    litros: null,
    confianza: { ...confianzaLlena, costo_mxn: 'media' },
  }));
  expect(decision.estado).toBe('revision');
  expect(decision.costo_mxn).toBe(800);
  expect(decision.alertas.map((alerta) => alerta.codigo)).toContain('UNREADABLE');
});

test('un voucher con fecha, monto y kilometraje se valida aunque no traiga litros ni precio', () => {
  const decision = decidirLectura('combustible', lectura({
    legible: false,
    kilometraje: 1000,
    odometro_tablero: 1000,
    costo_mxn: 800,
    litros: null,
    precio_litro: null,
    fecha_hora_ticket: '2026-11-20T18:00:00.000Z',
    confianza: { ...confianzaLlena, costo_mxn: 'alta', fecha_hora_ticket: 'alta' },
  }));
  expect(decision.estado).toBe('validada');
  expect(decision.litros).toBeNull();
  expect(decision.precio_litro).toBeNull();
  expect(decision.alertas.map((alerta) => alerta.codigo)).not.toContain('UNREADABLE');
});

test('monto, odómetros, hora del ticket y la cuenta generan alertas sin rechazar', () => {
  const marcas = {
    fechaCaptura: '2026-11-20T18:00:00.000Z',
    fechaRecepcion: '2026-11-20T18:12:00.000Z',
    fechaCapturaOrigen: 'cliente',
  };
  const decision = decidirLectura('combustible', lectura({
    kilometraje: 1000,
    odometro_tablero: 1000,
    odometro_ticket: 1100,
    costo_mxn: 790,
    litros: 40,
    precio_litro: 22,
    fecha_hora_ticket: '2026-11-20T18:20:00.000Z',
    confianza: { ...confianzaLlena, odometro_ticket: 'alta', costo_mxn: 'alta', litros: 'alta', precio_litro: 'alta', fecha_hora_ticket: 'alta' },
  }), marcas);
  const codigos = decision.alertas.map((alerta) => alerta.codigo);
  expect(decision.estado).toBe('validada');
  expect(codigos).toEqual(expect.arrayContaining([
    'ODOMETER_MISMATCH', 'FUEL_BELOW_MIN', 'TICKET_TIME_MISMATCH', 'MATH_MISMATCH',
  ]));
  expect(codigos.filter((codigo) => codigo === 'TICKET_TIME_MISMATCH')).toHaveLength(1);
});

test('la política recibida reemplaza los montos por defecto', () => {
  const decision = decidirLectura('combustible', lectura({
    kilometraje: 1000,
    odometro_tablero: 1000,
    costo_mxn: 500,
    litros: 20,
    precio_litro: 25,
  }), null, { politica: { montoMin: 100, montoMax: 900 } });
  expect(decision.alertas.map((alerta) => alerta.codigo)).not.toContain('FUEL_BELOW_MIN');
});

test('el historial marca odómetro repetido, retroceso, ticket duplicado e imagen reusada', () => {
  const historial = historialDesde([{
    fecha: '2026-11-19',
    evidencias: {
      combustible: {
        kilometraje: 900,
        fechaRecepcion: '2026-11-19T18:00:00.000Z',
        folio: 'A1',
        estacion: 'Pemex',
        costo_mxn: 800,
        litros: 40,
        imagenHash: 'abc',
      },
    },
  }]);
  const decision = decidirLectura('combustible', lectura({
    kilometraje: 900,
    odometro_tablero: 900,
    costo_mxn: 800,
    litros: 40,
    precio_litro: 20,
    folio: 'A1',
    estacion: 'Pemex',
  }), null, { historial, imagenHash: 'abc' });
  expect(decision.alertas.map((alerta) => alerta.codigo)).toEqual(expect.arrayContaining([
    'REPEATED_ODOMETER', 'DUPLICATE_RECEIPT', 'REUSED_IMAGE',
  ]));

  const regresion = decidirLectura('odometro', lectura({
    kilometraje: 800,
    odometro_tablero: 800,
  }), null, { historial });
  expect(regresion.alertas.map((alerta) => alerta.codigo)).toContain('ODOMETER_REGRESSION');
});

test('sin fechaCaptura la recepción se usa como captura y queda marcado', () => {
  const marcas = marcasDeTiempo({ ahora: new Date('2026-11-20T18:00:00.000Z') });
  expect(marcas.fechaCaptura).toBe('2026-11-20T18:00:00.000Z');
  expect(marcas.fechaRecepcion).toBe(marcas.fechaCaptura);
  expect(marcas.fechaCapturaOrigen).toBe('recepcion');
});

test('combustible a partir de las 6:00 p.m. CDMX genera alerta AFTER_CUTOFF_TIME y antes no', () => {
  const antes = decidirLectura('combustible', lectura({
    kilometraje: 1000,
    odometro_tablero: 1000,
    costo_mxn: 800,
    fecha_hora_ticket: '2026-11-24T17:55:00',
  }), { fechaCaptura: '2026-11-24T17:56:00-06:00', fechaRecepcion: '2026-11-24T17:56:00-06:00', fechaCapturaOrigen: 'cliente' });
  expect(antes.alertas.map((a) => a.codigo)).not.toContain('AFTER_CUTOFF_TIME');

  const tarde = decidirLectura('combustible', lectura({
    kilometraje: 1000,
    odometro_tablero: 1000,
    costo_mxn: 800,
    fecha_hora_ticket: '2026-11-24T18:05:00',
  }), { fechaCaptura: '2026-11-24T18:06:00-06:00', fechaRecepcion: '2026-11-24T18:06:00-06:00', fechaCapturaOrigen: 'cliente' });
  expect(tarde.estado).toBe('validada');
  expect(tarde.alertas.map((a) => a.codigo)).toContain('AFTER_CUTOFF_TIME');
});

test('combustible con km igual al odómetro de inicio del mismo día no dispara repetido, pero menor sí dispara retroceso', () => {
  const historial = historialDesde([{
    fecha: '2026-11-24',
    mismaJornada: true,
    excluirTipo: 'combustible',
    evidencias: {
      odometro: { kilometraje: 1500, fechaRecepcion: '2026-11-24T14:00:00.000Z' },
    },
  }]);

  const igual = decidirLectura('combustible', lectura({
    kilometraje: 1500,
    odometro_tablero: 1500,
    costo_mxn: 800,
    fecha_hora_ticket: '2026-11-24T10:00:00-06:00',
  }), null, { historial });
  expect(igual.alertas.map((a) => a.codigo)).not.toContain('REPEATED_ODOMETER');
  expect(igual.alertas.map((a) => a.codigo)).not.toContain('ODOMETER_REGRESSION');

  const menor = decidirLectura('combustible', lectura({
    kilometraje: 1490,
    odometro_tablero: 1490,
    costo_mxn: 800,
    fecha_hora_ticket: '2026-11-24T10:00:00-06:00',
  }), null, { historial });
  expect(menor.alertas.map((a) => a.codigo)).toContain('ODOMETER_REGRESSION');
});
