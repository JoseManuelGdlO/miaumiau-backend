'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Obtener IDs de roles
    const [roles] = await queryInterface.sequelize.query(
      'SELECT id, nombre FROM roles WHERE baja_logica = false'
    );

    // Obtener IDs de permisos de agentes
    const [permissions] = await queryInterface.sequelize.query(
      'SELECT id, nombre FROM permissions WHERE categoria = "agentes" AND baja_logica = false'
    );

    const rolePermissions = [];

    // Mapear permisos por rol
    const rolePermissionMap = {
      'super_admin': permissions.map(p => p.id), // Todos los permisos
      'admin': [
        'ver_agentes', 'crear_agentes', 'editar_agentes', 'eliminar_agentes',
        'configurar_agentes', 'activar_desactivar_agentes', 'ver_estadisticas_agentes',
        'administrar_agentes'
      ],
      'moderator': [
        'ver_agentes', 'crear_agentes', 'editar_agentes', 'configurar_agentes',
        'ver_estadisticas_agentes'
      ],
      'agente': [
        'ver_agentes', 'ver_estadisticas_agentes'
      ],
      'user': [
        'ver_agentes'
      ],
      'auditor': [
        'ver_agentes', 'ver_estadisticas_agentes'
      ]
    };

    // Crear asignaciones de permisos
    for (const role of roles) {
      const roleName = role.nombre;
      const permissionNames = rolePermissionMap[roleName] || [];

      for (const permissionName of permissionNames) {
        const permission = permissions.find(p => p.nombre === permissionName);
        if (permission) {
          rolePermissions.push({
            role_id: role.id,
            permission_id: permission.id,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      }
    }

    // Insertar asignaciones
    if (rolePermissions.length > 0) {
      await queryInterface.bulkInsert('role_permissions', rolePermissions, {});
    }
  },

  async down(queryInterface, Sequelize) {
    // Eliminar permisos de agentes de todos los roles
    await queryInterface.sequelize.query(`
      DELETE rp FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE p.categoria = 'agentes'
    `);
  }
};
