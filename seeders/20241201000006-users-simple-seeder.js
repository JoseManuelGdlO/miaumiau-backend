'use strict';

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
    
    // Insertar usuarios directamente con SQL
    await queryInterface.bulkInsert('users', [
      {
        nombre_completo: 'Administrador Principal',
        correo_electronico: 'admin@miaumiau.com',
        rol_id: 1,
        ciudad_id: 1,
        contrasena: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8K5K5K5K', // Admin123!
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_completo: 'María González',
        correo_electronico: 'maria.gonzalez@miaumiau.com',
        rol_id: 2,
        ciudad_id: 1,
        contrasena: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8K5K5K5K', // Maria123!
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_completo: 'Carlos Rodríguez',
        correo_electronico: 'carlos.rodriguez@miaumiau.com',
        rol_id: 2,
        ciudad_id: 2,
        contrasena: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8K5K5K5K', // Carlos123!
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_completo: 'Ana Martínez',
        correo_electronico: 'ana.martinez@miaumiau.com',
        rol_id: 3,
        ciudad_id: 3,
        contrasena: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8K5K5K5K', // Ana123!
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_completo: 'Usuario Demo',
        correo_electronico: 'demo@miaumiau.com',
        rol_id: 4,
        ciudad_id: 1,
        contrasena: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8K5K5K5K', // Demo123!
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', null, {});
  }
};
