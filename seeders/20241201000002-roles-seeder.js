'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Deshabilitar validaciones temporalmente para el seeder
    const { Role } = require('../src/models');
    
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

    // Usar el modelo para crear los roles (evita problemas de validación)
    for (const roleData of roles) {
      await Role.create(roleData, {
        validate: false // Deshabilitar validaciones para el seeder
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('roles', null, {});
  }
};
