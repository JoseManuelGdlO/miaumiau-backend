'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existe un usuario administrador
    const existingAdmin = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM users WHERE correo_electronico = ?',
      { 
        replacements: ['admin@miaumiau.com'],
        type: queryInterface.sequelize.QueryTypes.SELECT 
      }
    );
    
    // Solo insertar si no existe el administrador
    if (existingAdmin[0].count > 0) {
      console.log('Usuario administrador ya existe, saltando inserción');
      return;
    }
    
    // Obtener el rol de super_admin
    const superAdminRole = await queryInterface.sequelize.query(
      'SELECT id FROM roles WHERE nombre = ? AND baja_logica = false',
      { 
        replacements: ['super_admin'],
        type: queryInterface.sequelize.QueryTypes.SELECT 
      }
    );
    
    if (superAdminRole.length === 0) {
      throw new Error('Rol super_admin no encontrado. Ejecuta primero el seeder de roles.');
    }
    
    // Obtener la primera ciudad disponible (Bogotá por defecto)
    const city = await queryInterface.sequelize.query(
      'SELECT id FROM cities WHERE nombre = ? AND baja_logica = false LIMIT 1',
      { 
        replacements: ['Bogotá'],
        type: queryInterface.sequelize.QueryTypes.SELECT 
      }
    );
    
    if (city.length === 0) {
      // Si no existe Bogotá, tomar la primera ciudad disponible
      const firstCity = await queryInterface.sequelize.query(
        'SELECT id FROM cities WHERE baja_logica = false LIMIT 1',
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      
      if (firstCity.length === 0) {
        throw new Error('No se encontraron ciudades disponibles. Ejecuta primero el seeder de ciudades.');
      }
      
      city[0] = firstCity[0];
    }
    
    // Crear el usuario administrador
    const adminUser = {
      nombre_completo: 'Administrador del Sistema',
      correo_electronico: 'admin@miaumiau.com',
      rol_id: superAdminRole[0].id,
      ciudad_id: city[0].id,
      contrasena: 'Admin123!', // La contraseña se encriptará automáticamente por el hook del modelo
      isActive: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    // Insertar el usuario administrador
    await queryInterface.bulkInsert('users', [adminUser]);
    
    console.log('✅ Usuario administrador creado exitosamente:');
    console.log('   Email: admin@miaumiau.com');
    console.log('   Contraseña: Admin123!');
    console.log('   Rol: super_admin');
  },

  async down(queryInterface, Sequelize) {
    // Eliminar solo el usuario administrador
    await queryInterface.bulkDelete('users', {
      correo_electronico: 'admin@miaumiau.com'
    });
    
    console.log('✅ Usuario administrador eliminado');
  }
};
