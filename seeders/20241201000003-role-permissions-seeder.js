'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existen asignaciones para evitar duplicados
    const existingAssignments = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM role_permissions',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Solo insertar si no hay asignaciones existentes
    if (existingAssignments[0].count > 0) {
      console.log('Asignaciones de roles-permisos ya existen, saltando inserción');
      return;
    }
    
    // Usar los modelos para obtener datos
    const { Role, Permission, RolePermission } = require('../src/models');
    
    // Obtener todos los roles y permisos
    const roles = await Role.findAll({
      where: { baja_logica: false },
      attributes: ['id', 'nombre']
    });

    const permissions = await Permission.findAll({
      where: { baja_logica: false },
      attributes: ['id', 'nombre', 'categoria']
    });

    // Crear mapeo de roles por nombre
    const roleMap = {};
    roles.forEach(role => {
      roleMap[role.nombre] = role.id;
    });

    // Crear mapeo de permisos por nombre
    const permissionMap = {};
    permissions.forEach(permission => {
      permissionMap[permission.nombre] = permission.id;
    });

    const rolePermissions = [];

    // SUPER ADMIN - Todos los permisos
    if (roleMap.super_admin) {
      permissions.forEach(permission => {
        rolePermissions.push({
          role_id: roleMap.super_admin,
          permission_id: permission.id,
          created_at: new Date(),
          updated_at: new Date()
        });
      });
    }

    // ADMIN - Permisos de administración (sin permisos especiales del sistema)
    if (roleMap.admin) {
      const adminPermissions = [
        'ver_usuarios', 'crear_usuarios', 'editar_usuarios', 'eliminar_usuarios', 'administrar_usuarios',
        'ver_permisos', 'crear_permisos', 'editar_permisos', 'eliminar_permisos',
        'ver_logs', 'configurar_sistema',
        'ver_reportes', 'generar_reportes', 'exportar_reportes'
      ];

      adminPermissions.forEach(permissionName => {
        if (permissionMap[permissionName]) {
          rolePermissions.push({
            role_id: roleMap.admin,
            permission_id: permissionMap[permissionName],
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      });
    }

    // MODERATOR - Permisos de lectura y edición limitada
    if (roleMap.moderator) {
      const moderatorPermissions = [
        'ver_usuarios', 'editar_usuarios',
        'ver_permisos',
        'ver_logs',
        'ver_reportes', 'generar_reportes'
      ];

      moderatorPermissions.forEach(permissionName => {
        if (permissionMap[permissionName]) {
          rolePermissions.push({
            role_id: roleMap.moderator,
            permission_id: permissionMap[permissionName],
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      });
    }

    // USER - Permisos básicos de lectura
    if (roleMap.user) {
      const userPermissions = [
        'ver_usuarios',
        'ver_reportes'
      ];

      userPermissions.forEach(permissionName => {
        if (permissionMap[permissionName]) {
          rolePermissions.push({
            role_id: roleMap.user,
            permission_id: permissionMap[permissionName],
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      });
    }

    // GUEST - Permisos muy limitados
    if (roleMap.guest) {
      const guestPermissions = [
        'ver_reportes'
      ];

      guestPermissions.forEach(permissionName => {
        if (permissionMap[permissionName]) {
          rolePermissions.push({
            role_id: roleMap.guest,
            permission_id: permissionMap[permissionName],
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      });
    }

    // AUDITOR - Solo permisos de lectura
    if (roleMap.auditor) {
      const auditorPermissions = [
        'ver_usuarios',
        'ver_permisos',
        'ver_logs',
        'ver_reportes'
      ];

      auditorPermissions.forEach(permissionName => {
        if (permissionMap[permissionName]) {
          rolePermissions.push({
            role_id: roleMap.auditor,
            permission_id: permissionMap[permissionName],
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      });
    }

    // Insertar todas las asignaciones usando queryInterface
    if (rolePermissions.length > 0) {
      await queryInterface.bulkInsert('role_permissions', rolePermissions);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('role_permissions', null, {});
  }
};
