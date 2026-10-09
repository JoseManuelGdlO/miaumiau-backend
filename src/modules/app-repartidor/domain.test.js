const {
  buildDeliveryCode,
  codesMatch,
  applyLoadChange,
  checkInOpens,
  canListOrders,
  validatePayment,
  validateStock,
  nextPoints,
  evaluateLogros,
  stripPhone,
  dayKey,
  agruparCarga,
  META_DIARIA,
  PUNTOS_POR_ENTREGA,
} = require('./domain');

describe('domain app-repartidor', () => {
  test('el código tiene 6 dígitos', () => {
    expect(buildDeliveryCode()).toMatch(/^\d{6}$/);
  });

  test('codesMatch no filtra el código guardado', () => {
    expect(codesMatch('482193', '482193')).toBe(true);
    expect(codesMatch('482193', '000000')).toBe(false);
    expect(codesMatch('482193', '48219')).toBe(false);
  });

  test('cambiar la carga en espera cancela y vuelve a borrador', () => {
    expect(applyLoadChange({ estado: 'esperando_call_center', changed: true })).toEqual({
      statusCode: 409,
      estado: 'borrador',
      cancelarSolicitud: true,
    });
    expect(applyLoadChange({ estado: 'validada', changed: true }).estado).toBe('borrador');
    expect(applyLoadChange({ estado: 'borrador', changed: true }).statusCode).toBe(200);
  });

  test('el check-in solo abre con la notificación vigente leída', () => {
    expect(checkInOpens({ leida: true, vigente: true, estadoSolicitud: 'abierta' })).toBe(true);
    expect(checkInOpens({ leida: true, vigente: true, estadoSolicitud: 'cancelada' })).toBe(false);
    expect(checkInOpens({ leida: false, vigente: true, estadoSolicitud: 'abierta' })).toBe(false);
  });

  test('la lista exige jornada validada o cerrada', () => {
    expect(canListOrders('validada')).toBe(true);
    expect(canListOrders('cerrada')).toBe(true);
    expect(canListOrders('borrador')).toBe(false);
  });

  test('el pago mixto y la foto', () => {
    expect(validatePayment({ metodo: 'efectivo', total: 100, efectivo: 100, transferencia: 0, hasPhoto: false }).ok).toBe(true);
    expect(validatePayment({ metodo: 'transferencia', total: 100, efectivo: 0, transferencia: 100, hasPhoto: false }).ok).toBe(false);
    expect(validatePayment({ metodo: 'mixto', total: 100, efectivo: 40, transferencia: 50, hasPhoto: true }).ok).toBe(false);
    expect(validatePayment({ metodo: 'mixto', total: 100, efectivo: 40, transferencia: 60, hasPhoto: true }).ok).toBe(true);
  });

  test('el pago mixto compara en centavos enteros', () => {
    expect(validatePayment({
      metodo: 'mixto',
      total: 30.3,
      efectivo: 10.1,
      transferencia: 20.2,
      hasPhoto: true,
    }).ok).toBe(true);
  });

  test('el stock no pasa de la carga validada', () => {
    const result = validateStock({
      carga: [{ nombre: 'Arena 20 kg', cantidad: 2 }],
      entregado: [{ nombre: 'Arena 20 kg', cantidad: 1 }],
      items: [{ nombre: 'Arena 20 kg', cantidad: 2 }],
    });
    expect(result.ok).toBe(false);
  });

  test('puntos y logros', () => {
    expect(META_DIARIA).toBe(8);
    expect(PUNTOS_POR_ENTREGA).toBe(10);
    expect(nextPoints(320)).toEqual({ puntos: 10, saldo: 330 });
    const logros = evaluateLogros({ totalEntregas: 1, entregasHoy: 1, saldo: 10, rachaDias: 1 });
    expect(logros).toContain('primera_entrega');
    expect(logros).not.toContain('ruta_rapida');
  });

  test('stripPhone quita el teléfono', () => {
    expect(stripPhone({ nombre_completo: 'María', telefono: '618' })).toEqual({ nombre_completo: 'María' });
  });

  test('dayKey usa la zona horaria', () => {
    expect(dayKey(new Date('2026-10-07T05:30:00.000Z'), 'America/Mexico_City')).toBe('2026-10-06');
  });

  test('agruparCarga suma el mismo producto de dos pedidos y de un paquete', () => {
    expect(agruparCarga([
      { fkid_producto: 4, nombre: 'Arena', cantidad: 2, precio_unitario: 10 },
      { fkid_producto: 4, nombre: 'Arena', cantidad: 1, precio_unitario: 12 },
      { fkid_producto: 4, nombre: 'Arena', cantidad: 3, precio_unitario: 15 },
      { fkid_producto: 8, nombre: 'Snack', cantidad: 1, precio_unitario: 20 },
    ])).toEqual([
      { fkid_producto: 4, nombre: 'Arena', cantidad: 6, precio_unitario: 10, es_extra: false },
      { fkid_producto: 8, nombre: 'Snack', cantidad: 1, precio_unitario: 20, es_extra: false },
    ]);
  });

  test('agruparCarga agrupa por nombre si no hay producto', () => {
    expect(agruparCarga([
      { fkid_producto: null, nombre: 'Regalo', cantidad: 1, precio_unitario: 0 },
      { nombre: 'Regalo', cantidad: 2, precio_unitario: null },
    ])).toEqual([
      { fkid_producto: null, nombre: 'Regalo', cantidad: 3, precio_unitario: 0, es_extra: false },
    ]);
  });
});
