'use strict';

const PERM = {
  nombre: 'ver_flotilla',
  categoria: 'flotilla',
  descripcion: 'Permite ver el módulo de flotilla y combustible',
  tipo: 'lectura',
};

const ROLES_INICIALES = ['super_admin', 'admin'];

function select(queryInterface, sql, replacements) {
  return queryInterface.sequelize.query(sql, {
    replacements,
    type: queryInterface.sequelize.QueryTypes.SELECT,
  });
}

module.exports = {
  async up(queryInterface) {
    let rows = await select(
      queryInterface,
      'SELECT id FROM permissions WHERE nombre = :nombre LIMIT 1',
      { nombre: PERM.nombre },
    );

    if (!rows.length) {
      await queryInterface.bulkInsert('permissions', [{
        ...PERM,
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date(),
      }]);
      rows = await select(
        queryInterface,
        'SELECT id FROM permissions WHERE nombre = :nombre LIMIT 1',
        { nombre: PERM.nombre },
      );
    }

    const permissionId = rows[0].id;
    const roles = await select(
      queryInterface,
      'SELECT id FROM roles WHERE nombre IN (:roles) AND baja_logica = false',
      { roles: ROLES_INICIALES },
    );

    for (const role of roles) {
      await queryInterface.sequelize.query(
        `INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
         SELECT :roleId, :permissionId, NOW(), NOW()
         WHERE NOT EXISTS (
           SELECT 1 FROM role_permissions
           WHERE role_id = :roleId AND permission_id = :permissionId
         )`,
        { replacements: { roleId: role.id, permissionId } },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE rp FROM role_permissions rp
       INNER JOIN permissions p ON p.id = rp.permission_id
       WHERE p.nombre = :nombre`,
      { replacements: { nombre: PERM.nombre } },
    );
    await queryInterface.bulkDelete('permissions', { nombre: PERM.nombre });
  },
};
