'use strict';

module.exports = {
  async up(queryInterface) {
    const existing = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE nombre = 'configurar_qr' LIMIT 1",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    let permissionId = existing[0]?.id;
    if (!permissionId) {
      await queryInterface.bulkInsert('permissions', [
        {
          nombre: 'configurar_qr',
          categoria: 'configuracion_qr',
          descripcion: 'Permite usar la configuración del código QR',
          tipo: 'administracion',
          baja_logica: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
      const inserted = await queryInterface.sequelize.query(
        "SELECT id FROM permissions WHERE nombre = 'configurar_qr' LIMIT 1",
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      permissionId = inserted[0].id;
    }

    const roles = await queryInterface.sequelize.query(
      `SELECT DISTINCT r.id
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       WHERE r.baja_logica = false
         AND (r.nombre = 'super_admin' OR p.nombre = 'configurar_sistema')`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    for (const role of roles) {
      const already = await queryInterface.sequelize.query(
        'SELECT id FROM role_permissions WHERE role_id = :roleId AND permission_id = :permissionId LIMIT 1',
        {
          replacements: { roleId: role.id, permissionId },
          type: queryInterface.sequelize.QueryTypes.SELECT,
        }
      );
      if (already.length === 0) {
        await queryInterface.bulkInsert('role_permissions', [
          {
            role_id: role.id,
            permission_id: permissionId,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]);
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE rp FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE p.nombre = 'configurar_qr'
    `);
    await queryInterface.bulkDelete('permissions', { nombre: 'configurar_qr' });
  },
};
