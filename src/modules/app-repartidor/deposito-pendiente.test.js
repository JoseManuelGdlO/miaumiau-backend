const { repartoBloqueado } = require('./deposito-pendiente');

test('repartoBloqueado exige el comprobante cuando el día ya está cerrado', async () => {
  const db = {
    JornadaRepartidor: {
      findOne: async () => ({ comprobante_deposito_path: null }),
    },
    Ruta: {
      findAll: async () => [{
        pedidos: [
          { estado_entrega: 'entregado', pedido: { estado: 'entregado' } },
          { estado_entrega: 'fallido', pedido: { estado: 'no_entregado' } },
        ],
      }],
    },
    RutaPedido: {},
    Pedido: {},
  };
  await expect(repartoBloqueado(db, 4, '2026-10-19')).resolves.toBe(true);
});

test('repartoBloqueado se libera al subir el comprobante', async () => {
  const db = {
    JornadaRepartidor: {
      findOne: async () => ({ comprobante_deposito_path: 'depositos/cierre.jpg' }),
    },
    Ruta: { findAll: async () => { throw new Error('no debe consultar rutas'); } },
  };
  await expect(repartoBloqueado(db, 4, '2026-10-19')).resolves.toBe(false);
});

test('repartoBloqueado deja pasar si todavía hay una parada abierta', async () => {
  const db = {
    JornadaRepartidor: {
      findOne: async () => ({ comprobante_deposito_path: null }),
    },
    Ruta: {
      findAll: async () => [{
        pedidos: [{ estado_entrega: 'pendiente', pedido: { estado: 'confirmado' } }],
      }],
    },
    RutaPedido: {},
    Pedido: {},
  };
  await expect(repartoBloqueado(db, 4, '2026-10-19')).resolves.toBe(false);
});
