'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Obtener IDs de roles
    const [roles] = await queryInterface.sequelize.query(
      'SELECT id, nombre FROM roles WHERE baja_logica = false'
    );

    // Obtener IDs de permisos de repartidores
    const [permissions] = await queryInterface.sequelize.query(
      'SELECT id, nombre FROM permissions WHERE categoria = "repartidores" AND baja_logica = false'
    );

    const rolePermissions = [];

    // Mapear permisos por rol
    const rolePermissionMap = {
      'super_admin': permissions.map(p => p.id), // Todos los permisos
      'admin': [
        'ver_repartidores', 'crear_repartidores', 'editar_repartidores', 'eliminar_repartidores',
        'activar_desactivar_repartidores', 'asignar_rutas_repartidores', 'ver_estadisticas_repartidores',
        'administrar_repartidores'
      ],
      'moderator': [
        'ver_repartidores', 'crear_repartidores', 'editar_repartidores', 'ver_estadisticas_repartidores'
      ],
      'agente': [
        'ver_repartidores', 'ver_estadisticas_repartidores'
      ],
      'repartidor': [
        'ver_repartidores'
      ],
      'user': [
        'ver_repartidores'
      ],
      'auditor': [
        'ver_repartidores', 'ver_estadisticas_repartidores'
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
    // Eliminar permisos de repartidores de todos los roles
    await queryInterface.sequelize.query(`
      DELETE rp FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE p.categoria = 'repartidores'
    `);
  }
};
