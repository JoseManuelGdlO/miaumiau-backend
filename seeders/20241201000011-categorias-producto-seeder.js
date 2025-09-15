'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existen categorías para evitar duplicados
    const existingCategorias = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM categorias_producto',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Solo insertar si no hay categorías existentes
    if (existingCategorias[0].count > 0) {
      console.log('Categorías de producto ya existen, saltando inserción');
      return;
    }
    
    const categorias = [
      {
        nombre: 'Alimentos Secos',
        descripcion: 'Productos alimenticios que no requieren refrigeración como cereales, legumbres, frutos secos, etc.',
        baja_logica: false
      },
      {
        nombre: 'Lácteos',
        descripcion: 'Productos derivados de la leche como quesos, yogures, mantequilla, etc.',
        baja_logica: false
      },
      {
        nombre: 'Carnes y Aves',
        descripcion: 'Productos cárnicos frescos y procesados de res, cerdo, pollo, etc.',
        baja_logica: false
      },
      {
        nombre: 'Pescados y Mariscos',
        descripcion: 'Productos del mar frescos y congelados como pescados, camarones, langostas, etc.',
        baja_logica: false
      },
      {
        nombre: 'Frutas y Verduras',
        descripcion: 'Productos frescos de origen vegetal como manzanas, lechugas, tomates, etc.',
        baja_logica: false
      },
      {
        nombre: 'Bebidas',
        descripcion: 'Líquidos para consumo como agua, jugos, refrescos, cervezas, vinos, etc.',
        baja_logica: false
      },
      {
        nombre: 'Panadería y Pastelería',
        descripcion: 'Productos horneados como panes, pasteles, galletas, tortas, etc.',
        baja_logica: false
      },
      {
        nombre: 'Congelados',
        descripcion: 'Productos que requieren congelación como helados, vegetales congelados, etc.',
        baja_logica: false
      },
      {
        nombre: 'Conservas',
        descripcion: 'Productos enlatados y en conserva como atún, vegetales en lata, etc.',
        baja_logica: false
      },
      {
        nombre: 'Especias y Condimentos',
        descripcion: 'Ingredientes para sazonar como sal, pimienta, orégano, salsa de tomate, etc.',
        baja_logica: false
      },
      {
        nombre: 'Productos de Limpieza',
        descripcion: 'Artículos para limpieza del hogar como detergentes, desinfectantes, etc.',
        baja_logica: false
      },
      {
        nombre: 'Cuidado Personal',
        descripcion: 'Productos de higiene personal como jabones, champús, cremas, etc.',
        baja_logica: false
      },
      {
        nombre: 'Medicamentos',
        descripcion: 'Productos farmacéuticos y medicamentos de venta libre.',
        baja_logica: false
      },
      {
        nombre: 'Electrodomésticos',
        descripcion: 'Aparatos eléctricos para el hogar como refrigeradores, microondas, etc.',
        baja_logica: false
      },
      {
        nombre: 'Ropa y Accesorios',
        descripcion: 'Vestimenta y complementos como camisas, zapatos, bolsos, etc.',
        baja_logica: false
      },
      {
        nombre: 'Electrónicos',
        descripcion: 'Dispositivos electrónicos como teléfonos, computadoras, tablets, etc.',
        baja_logica: false
      },
      {
        nombre: 'Hogar y Jardín',
        descripcion: 'Artículos para el hogar y jardín como muebles, herramientas, plantas, etc.',
        baja_logica: false
      },
      {
        nombre: 'Deportes y Recreación',
        descripcion: 'Artículos deportivos y de entretenimiento como pelotas, bicicletas, etc.',
        baja_logica: false
      },
      {
        nombre: 'Libros y Papelería',
        descripcion: 'Material educativo y de oficina como libros, cuadernos, bolígrafos, etc.',
        baja_logica: false
      },
      {
        nombre: 'Juguetes',
        descripcion: 'Productos de entretenimiento para niños como muñecas, carros, juegos, etc.',
        baja_logica: false
      }
    ];

    await queryInterface.bulkInsert('categorias_producto', categorias.map(categoria => ({
      ...categoria,
      created_at: new Date(),
      updated_at: new Date()
    })));
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('categorias_producto', null, {});
  }
};
