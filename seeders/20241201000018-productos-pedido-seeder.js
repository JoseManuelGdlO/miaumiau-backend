'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existen productos de pedido para evitar duplicados
    const existingProductosPedido = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM productos_pedido',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Solo insertar si no hay productos de pedido existentes
    if (existingProductosPedido[0].count > 0) {
      console.log('Productos de pedido ya existen, saltando inserción');
      return;
    }
    
    const productosPedido = [
      // Pedido 1 - Administrador Principal (PED-20241201-001)
      {
        fkid_pedido: 1,
        fkid_producto: 1, // Arroz Blanco Premium
        cantidad: 2,
        precio_unidad: 4500.00,
        precio_total: 9000.00,
        descuento_producto: 0.00,
        notas_producto: 'Producto en buen estado',
        baja_logica: false
      },
      {
        fkid_pedido: 1,
        fkid_producto: 2, // Frijoles Rojos
        cantidad: 1,
        precio_unidad: 3800.00,
        precio_total: 3800.00,
        descuento_producto: 0.00,
        notas_producto: null,
        baja_logica: false
      },
      
      // Pedido 2 - María González (PED-20241201-002)
      {
        fkid_pedido: 2,
        fkid_producto: 3, // Lentejas Verdes
        cantidad: 3,
        precio_unidad: 5500.00,
        precio_total: 16500.00,
        descuento_producto: 0.00,
        notas_producto: 'Producto fresco',
        baja_logica: false
      },
      {
        fkid_pedido: 2,
        fkid_producto: 4, // Leche Entera 1L
        cantidad: 1,
        precio_unidad: 4200.00,
        precio_total: 4200.00,
        descuento_producto: 0.00,
        notas_producto: null,
        baja_logica: false
      },
      
      // Pedido 3 - Carlos Rodríguez (PED-20241201-003)
      {
        fkid_pedido: 3,
        fkid_producto: 5, // Queso Fresco 250g
        cantidad: 4,
        precio_unidad: 6200.00,
        precio_total: 24800.00,
        descuento_producto: 5.00,
        notas_producto: 'Descuento por cantidad',
        baja_logica: false
      },
      {
        fkid_pedido: 3,
        fkid_producto: 6, // Pechuga de Pollo
        cantidad: 2,
        precio_unidad: 12000.00,
        precio_total: 24000.00,
        descuento_producto: 0.00,
        notas_producto: 'Producto premium',
        baja_logica: false
      },
      
      // Pedido 4 - Ana Martínez (PED-20241201-004)
      {
        fkid_pedido: 4,
        fkid_producto: 7, // Carne Molida de Res
        cantidad: 1,
        precio_unidad: 9800.00,
        precio_total: 9800.00,
        descuento_producto: 0.00,
        notas_producto: 'Producto especial',
        baja_logica: false
      },
      {
        fkid_pedido: 4,
        fkid_producto: 8, // Tomates Frescos
        cantidad: 2,
        precio_unidad: 3800.00,
        precio_total: 7600.00,
        descuento_producto: 0.00,
        notas_producto: null,
        baja_logica: false
      },
      
      // Pedido 5 - Usuario Demo (PED-20241201-005)
      {
        fkid_pedido: 5,
        fkid_producto: 9, // Lechuga Fresca
        cantidad: 3,
        precio_unidad: 1800.00,
        precio_total: 5400.00,
        descuento_producto: 10.00,
        notas_producto: 'Descuento por cliente nuevo',
        baja_logica: false
      },
      {
        fkid_pedido: 5,
        fkid_producto: 10, // Agua Natural 600ml
        cantidad: 1,
        precio_unidad: 1200.00,
        precio_total: 1200.00,
        descuento_producto: 0.00,
        notas_producto: 'Producto de calidad',
        baja_logica: false
      }
    ];

    await queryInterface.bulkInsert('productos_pedido', productosPedido, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('productos_pedido', null, {});
  }
};