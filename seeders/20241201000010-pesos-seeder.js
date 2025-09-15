'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existen pesos para evitar duplicados
    const existingPesos = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM pesos',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Solo insertar si no hay pesos existentes
    if (existingPesos[0].count > 0) {
      console.log('Pesos ya existen, saltando inserción');
      return;
    }
    
    const pesos = [
      // Kilogramos
      { cantidad: 0.5, unidad_medida: 'kg', baja_logica: false },
      { cantidad: 1, unidad_medida: 'kg', baja_logica: false },
      { cantidad: 1.5, unidad_medida: 'kg', baja_logica: false },
      { cantidad: 2, unidad_medida: 'kg', baja_logica: false },
      { cantidad: 2.5, unidad_medida: 'kg', baja_logica: false },
      { cantidad: 3, unidad_medida: 'kg', baja_logica: false },
      { cantidad: 5, unidad_medida: 'kg', baja_logica: false },
      { cantidad: 10, unidad_medida: 'kg', baja_logica: false },
      { cantidad: 15, unidad_medida: 'kg', baja_logica: false },
      { cantidad: 20, unidad_medida: 'kg', baja_logica: false },
      { cantidad: 25, unidad_medida: 'kg', baja_logica: false },
      { cantidad: 50, unidad_medida: 'kg', baja_logica: false },
      
      // Gramos
      { cantidad: 100, unidad_medida: 'g', baja_logica: false },
      { cantidad: 250, unidad_medida: 'g', baja_logica: false },
      { cantidad: 500, unidad_medida: 'g', baja_logica: false },
      { cantidad: 750, unidad_medida: 'g', baja_logica: false },
      { cantidad: 1000, unidad_medida: 'g', baja_logica: false },
      
      // Libras
      { cantidad: 1, unidad_medida: 'lb', baja_logica: false },
      { cantidad: 2, unidad_medida: 'lb', baja_logica: false },
      { cantidad: 3, unidad_medida: 'lb', baja_logica: false },
      { cantidad: 5, unidad_medida: 'lb', baja_logica: false },
      { cantidad: 10, unidad_medida: 'lb', baja_logica: false },
      { cantidad: 20, unidad_medida: 'lb', baja_logica: false },
      { cantidad: 50, unidad_medida: 'lb', baja_logica: false },
      
      // Onzas
      { cantidad: 4, unidad_medida: 'oz', baja_logica: false },
      { cantidad: 8, unidad_medida: 'oz', baja_logica: false },
      { cantidad: 12, unidad_medida: 'oz', baja_logica: false },
      { cantidad: 16, unidad_medida: 'oz', baja_logica: false },
      { cantidad: 32, unidad_medida: 'oz', baja_logica: false },
      
      // Toneladas
      { cantidad: 0.5, unidad_medida: 'ton', baja_logica: false },
      { cantidad: 1, unidad_medida: 'ton', baja_logica: false },
      { cantidad: 2, unidad_medida: 'ton', baja_logica: false },
      { cantidad: 5, unidad_medida: 'ton', baja_logica: false },
      { cantidad: 10, unidad_medida: 'ton', baja_logica: false }
    ];

    await queryInterface.bulkInsert('pesos', pesos.map(peso => ({
      ...peso,
      created_at: new Date(),
      updated_at: new Date()
    })));
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('pesos', null, {});
  }
};
