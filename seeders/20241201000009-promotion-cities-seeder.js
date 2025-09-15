'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existen asignaciones para evitar duplicados
    const existingAssignments = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM promotion_cities',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Solo insertar si no hay asignaciones existentes
    if (existingAssignments[0].count > 0) {
      console.log('Asignaciones de promociones-ciudades ya existen, saltando inserción');
      return;
    }
    
    // Usar los modelos para obtener datos
    const { Promotion, City, PromotionCity } = require('../src/models');
    
    // Obtener promociones y ciudades existentes
    const promotions = await Promotion.findAll({
      where: { baja_logica: false },
      attributes: ['id', 'nombre', 'codigo']
    });

    const cities = await City.findAll({
      where: { baja_logica: false },
      attributes: ['id', 'nombre']
    });

    // Crear mapeo de promociones por código
    const promotionMap = {};
    promotions.forEach(promotion => {
      promotionMap[promotion.codigo] = promotion.id;
    });

    // Crear mapeo de ciudades por nombre
    const cityMap = {};
    cities.forEach(city => {
      cityMap[city.nombre] = city.id;
    });

    const promotionCities = [];

    // BIENVENIDA20 - Todas las ciudades
    if (promotionMap.BIENVENIDA20) {
      cities.forEach(city => {
        promotionCities.push({
          promotion_id: promotionMap.BIENVENIDA20,
          city_id: city.id,
          created_at: new Date(),
          updated_at: new Date()
        });
      });
    }

    // ENVIOGRATIS - Bogotá, Medellín, Cali
    if (promotionMap.ENVIOGRATIS) {
      const envioGratisCities = ['Bogotá', 'Medellín', 'Cali'];
      envioGratisCities.forEach(cityName => {
        if (cityMap[cityName]) {
          promotionCities.push({
            promotion_id: promotionMap.ENVIOGRATIS,
            city_id: cityMap[cityName],
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      });
    }

    // BLACKFRIDAY50 - Bogotá, Medellín
    if (promotionMap.BLACKFRIDAY50) {
      const blackFridayCities = ['Bogotá', 'Medellín'];
      blackFridayCities.forEach(cityName => {
        if (cityMap[cityName]) {
          promotionCities.push({
            promotion_id: promotionMap.BLACKFRIDAY50,
            city_id: cityMap[cityName],
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      });
    }

    // NAVIDAD15K - Todas las ciudades activas
    if (promotionMap.NAVIDAD15K) {
      const navidadCities = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena'];
      navidadCities.forEach(cityName => {
        if (cityMap[cityName]) {
          promotionCities.push({
            promotion_id: promotionMap.NAVIDAD15K,
            city_id: cityMap[cityName],
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      });
    }

    // VERANO2024 - Ciudades costeras
    if (promotionMap.VERANO2024) {
      const veranoCities = ['Barranquilla', 'Cartagena', 'Santa Marta'];
      veranoCities.forEach(cityName => {
        if (cityMap[cityName]) {
          promotionCities.push({
            promotion_id: promotionMap.VERANO2024,
            city_id: cityMap[cityName],
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      });
    }

    // CUMPLEANOS25 - Solo Bogotá
    if (promotionMap.CUMPLEANOS25) {
      if (cityMap['Bogotá']) {
        promotionCities.push({
          promotion_id: promotionMap.CUMPLEANOS25,
          city_id: cityMap['Bogotá'],
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    }

    // EXPIRADA10 - Bogotá (para pruebas)
    if (promotionMap.EXPIRADA10) {
      if (cityMap['Bogotá']) {
        promotionCities.push({
          promotion_id: promotionMap.EXPIRADA10,
          city_id: cityMap['Bogotá'],
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    }

    // Insertar todas las asignaciones usando queryInterface
    if (promotionCities.length > 0) {
      await queryInterface.bulkInsert('promotion_cities', promotionCities);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('promotion_cities', null, {});
  }
};
