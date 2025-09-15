'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existen roles para evitar duplicados
    const existingRoles = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM roles',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Solo insertar si no hay roles existentes
    if (existingRoles[0].count > 0) {
      console.log('Roles ya existen, saltando inserción');
      return;
    }
    
    const roles = [
      {
        nombre: 'super_admin',
        descripcion: 'Administrador del sistema con acceso completo a todas las funcionalidades',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'admin',
        descripcion: 'Administrador con permisos de gestión de usuarios y configuración del sistema',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'moderator',
        descripcion: 'Moderador con permisos de lectura y edición limitada',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'user',
        descripcion: 'Usuario estándar con permisos básicos de lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'guest',
        descripcion: 'Usuario invitado con permisos muy limitados',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'auditor',
        descripcion: 'Auditor con permisos de solo lectura para revisar el sistema',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    // Insertar roles usando queryInterface
    await queryInterface.bulkInsert('roles', roles);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('roles', null, {});
  }
};
