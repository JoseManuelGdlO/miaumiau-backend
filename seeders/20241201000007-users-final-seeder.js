'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existen usuarios para evitar duplicados
    const existingUsers = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM users',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Solo insertar si no hay usuarios existentes
    if (existingUsers[0].count > 0) {
      console.log('Usuarios ya existen, saltando inserción');
      return;
    }
    
    // Hash de las contraseñas
    const hashedPassword = await bcrypt.hash('Password123!', 12);
    
    const users = [
      {
        nombre_completo: 'Administrador Principal',
        correo_electronico: 'admin@miaumiau.com',
        rol_id: 1, // super_admin
        ciudad_id: 1, // Bogotá
        contrasena: hashedPassword,
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_completo: 'María González',
        correo_electronico: 'maria.gonzalez@miaumiau.com',
        rol_id: 2, // admin
        ciudad_id: 1, // Bogotá
        contrasena: hashedPassword,
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_completo: 'Carlos Rodríguez',
        correo_electronico: 'carlos.rodriguez@miaumiau.com',
        rol_id: 2, // admin
        ciudad_id: 2, // Medellín
        contrasena: hashedPassword,
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_completo: 'Ana Martínez',
        correo_electronico: 'ana.martinez@miaumiau.com',
        rol_id: 3, // moderator
        ciudad_id: 3, // Cali
        contrasena: hashedPassword,
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_completo: 'Usuario Demo',
        correo_electronico: 'demo@miaumiau.com',
        rol_id: 4, // user
        ciudad_id: 1, // Bogotá
        contrasena: hashedPassword,
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('users', users);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', null, {});
  }
};
