jest.mock('../../models', () => ({
  Role: { findByPk: jest.fn(), findOne: jest.fn() },
  Permission: { findAll: jest.fn() },
  RolePermission: { syncRolePermissions: jest.fn() },
}));

const { Role, Permission, RolePermission } = require('../../models');
const controller = require('./controller');

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

beforeEach(() => jest.clearAllMocks());

test('updateRole bloquea renombrar super_admin', async () => {
  Role.findByPk.mockResolvedValue({ id: 1, nombre: 'super_admin', descripcion: '' });
  const res = mockRes();
  await controller.updateRole({
    params: { id: '1' },
    body: { nombre: 'otro_admin' },
    user: { rol: { nombre: 'super_admin' } },
    userPermissions: ['*'],
  }, res, jest.fn());
  expect(res.statusCode).toBe(400);
});

test('updateRole exige asignar_permisos_roles si vienen permissions', async () => {
  Role.findByPk.mockResolvedValue({ id: 2, nombre: 'admin', descripcion: '' });
  const res = mockRes();
  await controller.updateRole({
    params: { id: '2' },
    body: { nombre: 'admin', permissions: [1, 2] },
    user: { rol: { nombre: 'admin' } },
    userPermissions: ['editar_roles'],
  }, res, jest.fn());
  expect(res.statusCode).toBe(403);
  expect(RolePermission.syncRolePermissions).not.toHaveBeenCalled();
});

test('updateRole deduplica permisos y sincroniza el rol', async () => {
  const role = { id: 2, nombre: 'admin', descripcion: '', update: jest.fn().mockResolvedValue(true) };
  Role.findByPk.mockResolvedValueOnce(role).mockResolvedValueOnce({ ...role, permissions: [{ id: 1 }, { id: 2 }] });
  Permission.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  const res = mockRes();
  await controller.updateRole({
    params: { id: '2' },
    body: { nombre: 'admin', descripcion: 'Actualizado', permissions: [1, 2, 1] },
    user: { rol: { nombre: 'super_admin' } },
    userPermissions: ['*'],
  }, res, jest.fn());
  expect(res.statusCode).toBe(200);
  expect(RolePermission.syncRolePermissions).toHaveBeenCalledWith(2, [1, 2]);
});
