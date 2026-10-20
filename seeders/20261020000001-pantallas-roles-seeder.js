'use strict';

const NEW_PERMISSIONS = [
  { nombre: 'ver_paquetes', categoria: 'paquetes', descripcion: 'Permite ver los paquetes', tipo: 'lectura' },
  { nombre: 'crear_paquetes', categoria: 'paquetes', descripcion: 'Permite crear paquetes', tipo: 'escritura' },
  { nombre: 'editar_paquetes', categoria: 'paquetes', descripcion: 'Permite editar paquetes', tipo: 'escritura' },
  { nombre: 'eliminar_paquetes', categoria: 'paquetes', descripcion: 'Permite eliminar paquetes', tipo: 'eliminacion' },
  { nombre: 'ver_notificaciones', categoria: 'notificaciones', descripcion: 'Permite ver las notificaciones', tipo: 'lectura' },
  { nombre: 'crear_notificaciones', categoria: 'notificaciones', descripcion: 'Permite crear notificaciones', tipo: 'escritura' },
  { nombre: 'editar_notificaciones', categoria: 'notificaciones', descripcion: 'Permite editar notificaciones', tipo: 'escritura' },
  { nombre: 'eliminar_notificaciones', categoria: 'notificaciones', descripcion: 'Permite eliminar notificaciones', tipo: 'eliminacion' },
];

const ROLE_GRANTS = {
  admin: [
    'operar_call_center',
    'ver_paquetes', 'crear_paquetes', 'editar_paquetes', 'eliminar_paquetes',
    'ver_notificaciones',
    'configurar_qr',
  ],
  moderator: [
    'operar_call_center',
    'ver_paquetes', 'editar_paquetes',
    'ver_notificaciones',
  ],
  agente: [
    'operar_call_center',
    'ver_paquetes',
    'ver_notificaciones',
  ],
  auditor: [
    'ver_paquetes',
    'ver_notificaciones',
  ],
};

const CREATED_NAMES = NEW_PERMISSIONS.map((permission) => permission.nombre);

function select(queryInterface, sql, replacements) {
  return queryInterface.sequelize.query(sql, {
    replacements,
    type: queryInterface.sequelize.QueryTypes.SELECT,
  });
}

async function ensurePermission(queryInterface, permission) {
  const existing = await select(
    queryInterface,
    'SELECT id FROM permissions WHERE nombre = :nombre LIMIT 1',
    { nombre: permission.nombre }
  );
  if (existing.length) return existing[0].id;

  await queryInterface.bulkInsert('permissions', [{
    ...permission,
    baja_logica: false,
    created_at: new Date(),
    updated_at: new Date(),
  }]);

  const inserted = await select(
    queryInterface,
    'SELECT id FROM permissions WHERE nombre = :nombre LIMIT 1',
    { nombre: permission.nombre }
  );
  return inserted[0].id;
}

async function grantMissing(queryInterface, roleId, permissionIds) {
  if (!permissionIds.length) return;
  await queryInterface.sequelize.query(
    `INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
     SELECT :roleId, p.id, NOW(), NOW()
     FROM permissions p
     WHERE p.id IN (:permissionIds)
       AND NOT EXISTS (
         SELECT 1 FROM role_permissions rp
         WHERE rp.role_id = :roleId AND rp.permission_id = p.id
       )`,
    { replacements: { roleId, permissionIds } }
  );
}

module.exports = {
  async up(queryInterface) {
    for (const permission of NEW_PERMISSIONS) {
      await ensurePermission(queryInterface, permission);
    }

    const superAdmin = await select(
      queryInterface,
      "SELECT id FROM roles WHERE nombre = 'super_admin' AND baja_logica = false LIMIT 1"
    );
    if (superAdmin.length) {
      await queryInterface.sequelize.query(
        `INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
         SELECT :roleId, p.id, NOW(), NOW()
         FROM permissions p
         WHERE p.baja_logica = false
           AND NOT EXISTS (
             SELECT 1 FROM role_permissions rp
             WHERE rp.role_id = :roleId AND rp.permission_id = p.id
           )`,
        { replacements: { roleId: superAdmin[0].id } }
      );
    }

    for (const [roleName, names] of Object.entries(ROLE_GRANTS)) {
      const roles = await select(
        queryInterface,
        'SELECT id FROM roles WHERE nombre = :nombre AND baja_logica = false LIMIT 1',
        { nombre: roleName }
      );
      if (!roles.length) continue;

      const permissions = await select(
        queryInterface,
        'SELECT id FROM permissions WHERE nombre IN (:names) AND baja_logica = false',
        { names }
      );
      await grantMissing(queryInterface, roles[0].id, permissions.map((permission) => permission.id));
    }
  },

  async down(queryInterface) {
    const granted = [...new Set(Object.values(ROLE_GRANTS).flat())];
    await queryInterface.sequelize.query(
      `DELETE rp FROM role_permissions rp
       INNER JOIN roles r ON r.id = rp.role_id
       INNER JOIN permissions p ON p.id = rp.permission_id
       WHERE r.nombre IN (:roles) AND p.nombre IN (:names)`,
      {
        replacements: {
          roles: Object.keys(ROLE_GRANTS),
          names: granted.filter((name) => name !== 'configurar_qr'),
        },
      }
    );

    await queryInterface.sequelize.query(
      `DELETE rp FROM role_permissions rp
       INNER JOIN permissions p ON p.id = rp.permission_id
       WHERE p.nombre IN (:names)`,
      { replacements: { names: CREATED_NAMES } }
    );
    await queryInterface.bulkDelete('permissions', { nombre: CREATED_NAMES });
  },
};
