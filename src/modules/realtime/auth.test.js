const jwt = require('jsonwebtoken');
const { verifyRepartidorToken, verifyCallCenterToken } = require('./auth');

const secret = 'test-secret';

function repartidor(data) {
  return { id: 7, baja_logica: false, estado: 'en_ruta', ...data };
}

test('acepta el token de un repartidor activo', async () => {
  const token = jwt.sign({ tipo: 'repartidor', repartidorId: 7 }, secret);
  const result = await verifyRepartidorToken(token, {
    secret,
    Repartidor: { findByPk: async () => repartidor() },
  });
  expect(result).toEqual({ repartidorId: 7 });
});

test.each([
  ['vacío', ''],
  ['otro tipo', jwt.sign({ tipo: 'usuario', repartidorId: 7 }, secret)],
  ['sin id', jwt.sign({ tipo: 'repartidor' }, secret)],
  ['firma mala', jwt.sign({ tipo: 'repartidor', repartidorId: 7 }, 'otra')],
])('rechaza token %s', async (_label, token) => {
  const result = await verifyRepartidorToken(token, {
    secret,
    Repartidor: { findByPk: async () => repartidor() },
  });
  expect(result).toBeNull();
});

test('verifyCallCenterToken acepta operar_call_center', () => {
  const token = jwt.sign({ userId: 2, role: 'operador', permissions: ['operar_call_center'] }, secret);
  expect(verifyCallCenterToken(token, { secret })).toEqual({ userId: 2 });
});

test('verifyCallCenterToken rechaza repartidor y usuario sin permiso', () => {
  expect(verifyCallCenterToken(jwt.sign({ tipo: 'repartidor', repartidorId: 7 }, secret), { secret })).toBeNull();
  expect(verifyCallCenterToken(jwt.sign({ userId: 2, role: 'ventas', permissions: [] }, secret), { secret })).toBeNull();
});

test('rechaza repartidor inactivo o dado de baja', async () => {
  const token = jwt.sign({ tipo: 'repartidor', repartidorId: 7 }, secret);
  await expect(verifyRepartidorToken(token, {
    secret,
    Repartidor: { findByPk: async () => repartidor({ estado: 'inactivo' }) },
  })).resolves.toBeNull();
  await expect(verifyRepartidorToken(token, {
    secret,
    Repartidor: { findByPk: async () => null },
  })).resolves.toBeNull();
  await expect(verifyRepartidorToken(token, {
    secret,
    Repartidor: { findByPk: async () => repartidor({ baja_logica: true }) },
  })).resolves.toBeNull();
});
