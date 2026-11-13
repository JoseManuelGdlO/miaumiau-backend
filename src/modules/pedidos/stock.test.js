const { calcularYValidarStock, lineaPaquete } = require('./stock');

const sku = { id: 7, nombre: 'Arena', sku: 'A1', stock_inicial: 100, compra_minima: 10 };

function dbDeCombo() {
  return {
    Paquete: { findByPk: async () => ({ id: 3, is_active: true, precio_final: 80 }) },
    ProductoPaquete: { findAll: async () => [{ fkid_producto: 7, cantidad: 2 }] },
    Inventario: { findByPk: async () => sku },
  };
}

test('un combo solo no aplica la compra mínima del SKU interno', async () => {
  const { isValid, erroresStock } = await calcularYValidarStock(dbDeCombo(), {
    productos: [],
    paquetes: [{ fkid_paquete: 3, cantidad: 1 }],
  });
  expect(isValid).toBe(true);
  expect(erroresStock).toEqual([]);
});

test('el mismo SKU suelto sí exige compra mínima', async () => {
  const { isValid, erroresStock } = await calcularYValidarStock(dbDeCombo(), {
    productos: [{ fkid_producto: 7, cantidad: 1 }],
    paquetes: [],
  });
  expect(isValid).toBe(false);
  expect(erroresStock[0]).toMatch(/Compra mínima/);
});

test('el precio del combo es precio_final, no la suma de piezas', () => {
  expect(lineaPaquete({ precio_final: 80 }, 2, 0)).toEqual({ precio_unidad: 80, precio_total: 160 });
  expect(lineaPaquete({ precio_final: '80.00' }, 1, 0).precio_unidad).toBe(80);
});
