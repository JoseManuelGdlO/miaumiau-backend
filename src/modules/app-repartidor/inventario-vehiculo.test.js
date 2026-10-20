const { agregarLineas, reemplazarSaldo, descontarEntrega } = require('./inventario-vehiculo');

function memoryDb() {
  const saldos = [];
  const movimientos = [];
  let seq = 1;
  return {
    saldos,
    movimientos,
    InventarioVehiculo: {
      async destroy({ where }) {
        for (let i = saldos.length - 1; i >= 0; i -= 1) {
          if (saldos[i].fkid_repartidor === where.fkid_repartidor) saldos.splice(i, 1);
        }
      },
      async create(row) {
        const saved = { id: seq, ...row };
        seq += 1;
        saldos.push(saved);
        return saved;
      },
      async findOne({ where }) {
        const found = saldos.find((row) => row.fkid_repartidor === where.fkid_repartidor && row.nombre === where.nombre);
        if (!found) return null;
        return {
          ...found,
          async update(patch) {
            Object.assign(found, patch);
          },
          get fkid_producto() { return found.fkid_producto; },
          get cantidad() { return found.cantidad; },
        };
      },
    },
    MovimientoInventarioVehiculo: {
      async create(row) {
        movimientos.push(row);
        return row;
      },
    },
  };
}

test('agregarLineas junta el mismo producto y no toca cantidades vacías', () => {
  expect(agregarLineas([
    { nombre: 'Arena', cantidad: 2, fkid_producto: 4 },
    { nombre: 'Arena', cantidad: 1 },
    { nombre: '', cantidad: 3 },
  ])).toEqual([{ nombre: 'Arena', fkid_producto: 4, cantidad: 3 }]);
});

test('reemplazarSaldo deja el saldo de la carga y un movimiento, sin bodega', async () => {
  const db = memoryDb();
  const bodega = { stock: 10 };
  await reemplazarSaldo(db, {
    repartidorId: 7,
    jornadaId: 3,
    lineas: [{ nombre: 'Arena', cantidad: 4, fkid_producto: 4 }],
  });
  expect(db.saldos).toEqual([
    expect.objectContaining({ fkid_repartidor: 7, nombre: 'Arena', cantidad: 4 }),
  ]);
  expect(db.movimientos).toEqual([
    expect.objectContaining({ tipo: 'carga', cantidad: 4, fkid_jornada: 3 }),
  ]);
  expect(bodega.stock).toBe(10);
});

test('descontarEntrega baja el saldo y no lo deja negativo', async () => {
  const db = memoryDb();
  await reemplazarSaldo(db, {
    repartidorId: 7,
    jornadaId: 3,
    lineas: [{ nombre: 'Arena', cantidad: 2, fkid_producto: 4 }],
  });
  await descontarEntrega(db, {
    repartidorId: 7,
    jornadaId: 3,
    pedidoId: 9,
    items: [{ nombre: 'Arena', cantidad: 5, fkid_producto: 4 }],
  });
  expect(db.saldos[0].cantidad).toBe(0);
  expect(db.movimientos.at(-1)).toEqual(expect.objectContaining({
    tipo: 'entrega',
    cantidad: -2,
    fkid_pedido: 9,
  }));
});
