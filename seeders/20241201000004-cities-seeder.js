'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existen ciudades para evitar duplicados
    const existingCities = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM cities',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Solo insertar si no hay ciudades existentes
    if (existingCities[0].count > 0) {
      console.log('Ciudades ya existen, saltando inserción');
      return;
    }
    
    const cities = [
      {
        nombre: 'Durango',
        departamento: 'Centro',
        direccion_operaciones: 'Carrera 7 #32-16, Centro, Bogotá',
        estado_inicial: 'activa',
        numero_zonas_entrega: 8,
        area_cobertura: 1775.00,
        tiempo_promedio_entrega: 45,
        horario_atencion: 'Lunes a Viernes: 8:00 AM - 6:00 PM, Sábados: 9:00 AM - 2:00 PM',
        manager: 'María González',
        telefono: '+57 1 234-5678',
        email_contacto: 'bogota@miaumiau.com',
        notas_adicionales: 'Ciudad principal con mayor volumen de entregas',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
    ];

    // Insertar ciudades usando queryInterface
    await queryInterface.bulkInsert('cities', cities);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('cities', null, {});
  }
};
