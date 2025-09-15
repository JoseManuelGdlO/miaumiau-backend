'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existen promociones para evitar duplicados
    const existingPromotions = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM promotions',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Solo insertar si no hay promociones existentes
    if (existingPromotions[0].count > 0) {
      console.log('Promociones ya existen, saltando inserción');
      return;
    }
    
    const promotions = [
      {
        nombre: 'Descuento de Bienvenida',
        codigo: 'BIENVENIDA20',
        descripcion: 'Descuento especial para nuevos usuarios',
        tipo_promocion: 'porcentaje',
        valor_descuento: 20.00,
        fecha_inicio: new Date('2024-01-01'),
        fecha_fin: new Date('2024-12-31'),
        limite_uso: 1000,
        compra_minima: 50000.00,
        descuento_maximo: 20000.00,
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'Envío Gratis',
        codigo: 'ENVIOGRATIS',
        descripcion: 'Envío gratuito en compras superiores a $100,000',
        tipo_promocion: 'envio_gratis',
        valor_descuento: 0.00,
        fecha_inicio: new Date('2024-01-01'),
        fecha_fin: new Date('2024-12-31'),
        limite_uso: 0,
        compra_minima: 100000.00,
        descuento_maximo: null,
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'Black Friday',
        codigo: 'BLACKFRIDAY50',
        descripcion: 'Descuento especial por Black Friday',
        tipo_promocion: 'porcentaje',
        valor_descuento: 50.00,
        fecha_inicio: new Date('2024-11-29'),
        fecha_fin: new Date('2024-11-30'),
        limite_uso: 500,
        compra_minima: 100000.00,
        descuento_maximo: 50000.00,
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'Descuento Fijo Navidad',
        codigo: 'NAVIDAD15K',
        descripcion: 'Descuento fijo de $15,000 en compras navideñas',
        tipo_promocion: 'monto_fijo',
        valor_descuento: 15000.00,
        fecha_inicio: new Date('2024-12-15'),
        fecha_fin: new Date('2024-12-25'),
        limite_uso: 200,
        compra_minima: 80000.00,
        descuento_maximo: 15000.00,
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'Promoción de Verano',
        codigo: 'VERANO2024',
        descripcion: 'Promoción especial de verano con descuentos increíbles',
        tipo_promocion: 'descuento_especial',
        valor_descuento: 30.00,
        fecha_inicio: new Date('2024-06-01'),
        fecha_fin: new Date('2024-08-31'),
        limite_uso: 0,
        compra_minima: 60000.00,
        descuento_maximo: 25000.00,
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'Descuento de Cumpleaños',
        codigo: 'CUMPLEANOS25',
        descripcion: 'Descuento especial para cumpleaños',
        tipo_promocion: 'porcentaje',
        valor_descuento: 25.00,
        fecha_inicio: new Date('2024-01-01'),
        fecha_fin: new Date('2024-12-31'),
        limite_uso: 1,
        compra_minima: 30000.00,
        descuento_maximo: 10000.00,
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'Promoción Expirada',
        codigo: 'EXPIRADA10',
        descripcion: 'Promoción que ya expiró para pruebas',
        tipo_promocion: 'porcentaje',
        valor_descuento: 10.00,
        fecha_inicio: new Date('2023-01-01'),
        fecha_fin: new Date('2023-12-31'),
        limite_uso: 100,
        compra_minima: 20000.00,
        descuento_maximo: 5000.00,
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    // Insertar promociones usando queryInterface
    await queryInterface.bulkInsert('promotions', promotions);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('promotions', null, {});
  }
};
