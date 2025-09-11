'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Deshabilitar validaciones temporalmente para el seeder
    const { User, Role, City } = require('../src/models');
    
    // Obtener roles y ciudades existentes
    const roles = await Role.findAll({
      where: { baja_logica: false },
      attributes: ['id', 'nombre']
    });

    const cities = await City.findAll({
      where: { baja_logica: false },
      attributes: ['id', 'nombre']
    });

    // Crear mapeo de roles por nombre
    const roleMap = {};
    roles.forEach(role => {
      roleMap[role.nombre] = role.id;
    });

    // Crear mapeo de ciudades por nombre
    const cityMap = {};
    cities.forEach(city => {
      cityMap[city.nombre] = city.id;
    });

    const users = [
      {
        nombre_completo: 'Administrador Principal',
        correo_electronico: 'admin@miaumiau.com',
        rol_id: roleMap.super_admin || 1,
        ciudad_id: cityMap['Bogotá'] || 1,
        contrasena: 'Admin123!',
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_completo: 'María González',
        correo_electronico: 'maria.gonzalez@miaumiau.com',
        rol_id: roleMap.admin || 2,
        ciudad_id: cityMap['Bogotá'] || 1,
        contrasena: 'Maria123!',
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_completo: 'Carlos Rodríguez',
        correo_electronico: 'carlos.rodriguez@miaumiau.com',
        rol_id: roleMap.admin || 2,
        ciudad_id: cityMap['Medellín'] || 2,
        contrasena: 'Carlos123!',
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_completo: 'Ana Martínez',
        correo_electronico: 'ana.martinez@miaumiau.com',
        rol_id: roleMap.moderator || 3,
        ciudad_id: cityMap['Cali'] || 3,
        contrasena: 'Ana123!',
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_completo: 'Luis Herrera',
        correo_electronico: 'luis.herrera@miaumiau.com',
        rol_id: roleMap.moderator || 3,
        ciudad_id: cityMap['Barranquilla'] || 4,
        contrasena: 'Luis123!',
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_completo: 'Isabel Torres',
        correo_electronico: 'isabel.torres@miaumiau.com',
        rol_id: roleMap.user || 4,
        ciudad_id: cityMap['Cartagena'] || 5,
        contrasena: 'Isabel123!',
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_completo: 'Roberto Silva',
        correo_electronico: 'roberto.silva@miaumiau.com',
        rol_id: roleMap.user || 4,
        ciudad_id: cityMap['Bucaramanga'] || 6,
        contrasena: 'Roberto123!',
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_completo: 'Patricia Vargas',
        correo_electronico: 'patricia.vargas@miaumiau.com',
        rol_id: roleMap.user || 4,
        ciudad_id: cityMap['Pereira'] || 7,
        contrasena: 'Patricia123!',
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_completo: 'Diego Morales',
        correo_electronico: 'diego.morales@miaumiau.com',
        rol_id: roleMap.auditor || 6,
        ciudad_id: cityMap['Santa Marta'] || 8,
        contrasena: 'Diego123!',
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_completo: 'Usuario Demo',
        correo_electronico: 'demo@miaumiau.com',
        rol_id: roleMap.guest || 5,
        ciudad_id: cityMap['Bogotá'] || 1,
        contrasena: 'Demo123!',
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    // Usar el modelo para crear los usuarios (evita problemas de validación)
    for (const userData of users) {
      await User.create(userData, {
        validate: false // Deshabilitar validaciones para el seeder
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', null, {});
  }
};
