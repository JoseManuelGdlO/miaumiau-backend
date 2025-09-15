'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existen inventarios para evitar duplicados
    const existingInventarios = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM inventarios',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Solo insertar si no hay inventarios existentes
    if (existingInventarios[0].count > 0) {
      console.log('Inventarios ya existen, saltando inserción');
      return;
    }
    
    const inventarios = [
      // Alimentos Secos
      {
        nombre: 'Arroz Blanco Premium',
        sku: 'ARZ-001-1KG',
        fkid_peso: 2, // 1 kg
        fkid_categoria: 1, // Alimentos Secos
        fkid_ciudad: 1, // Bogotá // Bogotá
        descripcion: 'Arroz blanco de alta calidad, grano largo y suave',
        stock_inicial: 150,
        stock_minimo: 20,
        stock_maximo: 500,
        costo_unitario: 3500.00,
        precio_venta: 4500.00,
        fkid_proveedor: 1, // Distribuidora Central S.A.
        baja_logica: false
      },
      {
        nombre: 'Frijoles Rojos',
        sku: 'FRJ-002-500G',
        fkid_peso: 16, // 500g
        fkid_categoria: 1, // Alimentos Secos
        fkid_ciudad: 1, // Bogotá // Bogotá
        descripcion: 'Frijoles rojos secos, ricos en proteína',
        stock_inicial: 80,
        stock_minimo: 15,
        stock_maximo: 200,
        costo_unitario: 2800.00,
        precio_venta: 3800.00,
        fkid_proveedor: 1, // Distribuidora Central S.A.
        baja_logica: false
      },
      {
        nombre: 'Lentejas Verdes',
        sku: 'LNT-003-1KG',
        fkid_peso: 2, // 1 kg
        fkid_categoria: 1, // Alimentos Secos
        fkid_ciudad: 2, // Medellín // Medellín
        descripcion: 'Lentejas verdes secas, excelente fuente de hierro',
        stock_inicial: 60,
        stock_minimo: 10,
        stock_maximo: 150,
        costo_unitario: 4200.00,
        precio_venta: 5500.00,
        fkid_proveedor: 1, // Distribuidora Central S.A.
        baja_logica: false
      },
      
      // Lácteos
      {
        nombre: 'Leche Entera 1L',
        sku: 'LCH-004-1L',
        fkid_peso: 2, // 1 kg (1L)
        fkid_categoria: 2, // Lácteos
        fkid_ciudad: 1, // Bogotá // Bogotá
        descripcion: 'Leche entera fresca, rica en calcio y vitaminas',
        stock_inicial: 200,
        stock_minimo: 30,
        stock_maximo: 400,
        costo_unitario: 3200.00,
        precio_venta: 4200.00,
        fkid_proveedor: 4, // Lácteos del Valle
        baja_logica: false
      },
      {
        nombre: 'Queso Fresco 250g',
        sku: 'QSF-005-250G',
        fkid_peso: 15, // 250g
        fkid_categoria: 2, // Lácteos
        fkid_ciudad: 1, // Bogotá // Bogotá
        descripcion: 'Queso fresco artesanal, ideal para ensaladas',
        stock_inicial: 45,
        stock_minimo: 8,
        stock_maximo: 100,
        costo_unitario: 4500.00,
        precio_venta: 6200.00,
        fkid_proveedor: 4, // Lácteos del Valle
        baja_logica: false
      },
      
      // Carnes y Aves
      {
        nombre: 'Pechuga de Pollo',
        sku: 'PCH-006-1KG',
        fkid_peso: 2, // 1 kg
        fkid_categoria: 3, // Carnes y Aves
        fkid_ciudad: 1, // Bogotá // Bogotá
        descripcion: 'Pechuga de pollo fresca, sin hueso',
        stock_inicial: 25,
        stock_minimo: 5,
        stock_maximo: 50,
        costo_unitario: 8500.00,
        precio_venta: 12000.00,
        fkid_proveedor: 3, // Carnes Premium Ltda.
        baja_logica: false
      },
      {
        nombre: 'Carne Molida de Res',
        sku: 'CMR-007-500G',
        fkid_peso: 16, // 500g
        fkid_categoria: 3, // Carnes y Aves
        fkid_ciudad: 2, // Medellín // Medellín
        descripcion: 'Carne molida de res fresca, ideal para hamburguesas',
        stock_inicial: 30,
        stock_minimo: 6,
        stock_maximo: 60,
        costo_unitario: 7200.00,
        precio_venta: 9800.00,
        fkid_proveedor: 3, // Carnes Premium Ltda.
        baja_logica: false
      },
      
      // Frutas y Verduras
      {
        nombre: 'Tomates Frescos',
        sku: 'TMT-008-1KG',
        fkid_peso: 2, // 1 kg
        fkid_categoria: 5, // Frutas y Verduras
        fkid_ciudad: 1, // Bogotá // Bogotá
        descripcion: 'Tomates frescos, perfectos para ensaladas y salsas',
        stock_inicial: 40,
        stock_minimo: 8,
        stock_maximo: 80,
        costo_unitario: 2800.00,
        precio_venta: 3800.00,
        fkid_proveedor: 2, // Frutas y Verduras del Campo
        baja_logica: false
      },
      {
        nombre: 'Lechuga Fresca',
        sku: 'LCH-009-UNI',
        fkid_peso: 1, // 0.5 kg
        fkid_categoria: 5, // Frutas y Verduras
        fkid_ciudad: 1, // Bogotá // Bogotá
        descripcion: 'Lechuga fresca, crujiente y verde',
        stock_inicial: 35,
        stock_minimo: 7,
        stock_maximo: 70,
        costo_unitario: 1200.00,
        precio_venta: 1800.00,
        fkid_proveedor: 2, // Frutas y Verduras del Campo
        baja_logica: false
      },
      
      // Bebidas
      {
        nombre: 'Agua Natural 600ml',
        sku: 'AGU-010-600ML',
        fkid_peso: 1, // 0.5 kg (600ml)
        fkid_categoria: 6, // Bebidas
        fkid_ciudad: 1, // Bogotá // Bogotá
        descripcion: 'Agua natural purificada, botella de 600ml',
        stock_inicial: 300,
        stock_minimo: 50,
        stock_maximo: 600,
        costo_unitario: 800.00,
        precio_venta: 1200.00,
        fkid_proveedor: 10, // Bebidas Refrescantes
        baja_logica: false
      },
      {
        nombre: 'Jugo de Naranja 1L',
        sku: 'JGO-011-1L',
        fkid_peso: 2, // 1 kg (1L)
        fkid_categoria: 6, // Bebidas
        fkid_ciudad: 2, // Medellín // Medellín
        descripcion: 'Jugo de naranja natural, sin conservantes',
        stock_inicial: 80,
        stock_minimo: 15,
        stock_maximo: 150,
        costo_unitario: 4500.00,
        precio_venta: 6200.00,
        fkid_proveedor: 10, // Bebidas Refrescantes
        baja_logica: false
      },
      
      // Panadería y Pastelería
      {
        nombre: 'Pan Blanco',
        sku: 'PAN-012-UNI',
        fkid_peso: 1, // 0.5 kg
        fkid_categoria: 7, // Panadería y Pastelería
        fkid_ciudad: 1, // Bogotá // Bogotá
        descripcion: 'Pan blanco fresco, recién horneado',
        stock_inicial: 50,
        stock_minimo: 10,
        stock_maximo: 100,
        costo_unitario: 1500.00,
        precio_venta: 2200.00,
        fkid_proveedor: 11, // Panadería Artesanal
        baja_logica: false
      },
      {
        nombre: 'Croissants',
        sku: 'CRS-013-6UNI',
        fkid_peso: 1, // 0.5 kg
        fkid_categoria: 7, // Panadería y Pastelería
        fkid_ciudad: 1, // Bogotá // Bogotá
        descripcion: 'Croissants de mantequilla, paquete de 6 unidades',
        stock_inicial: 25,
        stock_minimo: 5,
        stock_maximo: 50,
        costo_unitario: 3200.00,
        precio_venta: 4500.00,
        fkid_proveedor: 11, // Panadería Artesanal
        baja_logica: false
      },
      
      // Productos de Limpieza
      {
        nombre: 'Detergente Líquido',
        sku: 'DET-014-1L',
        fkid_peso: 2, // 1 kg (1L)
        fkid_categoria: 11, // Productos de Limpieza
        fkid_ciudad: 1, // Bogotá // Bogotá
        descripcion: 'Detergente líquido para ropa, concentrado',
        stock_inicial: 60,
        stock_minimo: 12,
        stock_maximo: 120,
        costo_unitario: 8500.00,
        precio_venta: 12000.00,
        fkid_proveedor: 9, // Productos de Limpieza Pro
        baja_logica: false
      },
      {
        nombre: 'Jabón de Manos',
        sku: 'JAB-015-500ML',
        fkid_peso: 16, // 500g (500ml)
        fkid_categoria: 11, // Productos de Limpieza
        fkid_ciudad: 2, // Medellín // Medellín
        descripcion: 'Jabón líquido para manos, antibacterial',
        stock_inicial: 40,
        stock_minimo: 8,
        stock_maximo: 80,
        costo_unitario: 3200.00,
        precio_venta: 4500.00,
        fkid_proveedor: 9, // Productos de Limpieza Pro
        baja_logica: false
      },
      
      // Cuidado Personal
      {
        nombre: 'Shampoo 400ml',
        sku: 'SHP-016-400ML',
        fkid_peso: 1, // 0.5 kg (400ml)
        fkid_categoria: 12, // Cuidado Personal
        fkid_ciudad: 1, // Bogotá // Bogotá
        descripcion: 'Shampoo para cabello normal, 400ml',
        stock_inicial: 35,
        stock_minimo: 7,
        stock_maximo: 70,
        costo_unitario: 12000.00,
        precio_venta: 16500.00,
        fkid_proveedor: 1, // Distribuidora Central S.A.
        baja_logica: false
      },
      {
        nombre: 'Crema Dental',
        sku: 'CRD-017-100G',
        fkid_peso: 1, // 0.5 kg
        fkid_categoria: 12, // Cuidado Personal
        fkid_ciudad: 1, // Bogotá // Bogotá
        descripcion: 'Crema dental con flúor, tubo de 100g',
        stock_inicial: 80,
        stock_minimo: 15,
        stock_maximo: 150,
        costo_unitario: 4500.00,
        precio_venta: 6200.00,
        fkid_proveedor: 1, // Distribuidora Central S.A.
        baja_logica: false
      },
      
      // Electrónicos
      {
        nombre: 'Cargador USB-C',
        sku: 'CGR-018-UNI',
        fkid_peso: 1, // 0.5 kg
        fkid_categoria: 16, // Electrónicos
        fkid_ciudad: 1, // Bogotá // Bogotá
        descripcion: 'Cargador USB-C rápido, 20W',
        stock_inicial: 25,
        stock_minimo: 5,
        stock_maximo: 50,
        costo_unitario: 25000.00,
        precio_venta: 35000.00,
        fkid_proveedor: 8, // Tecnología Avanzada
        baja_logica: false
      },
      {
        nombre: 'Cable HDMI 2m',
        sku: 'CBL-019-2M',
        fkid_peso: 1, // 0.5 kg
        fkid_categoria: 16, // Electrónicos
        fkid_ciudad: 2, // Medellín // Medellín
        descripcion: 'Cable HDMI de alta velocidad, 2 metros',
        stock_inicial: 30,
        stock_minimo: 6,
        stock_maximo: 60,
        costo_unitario: 15000.00,
        precio_venta: 22000.00,
        fkid_proveedor: 8, // Tecnología Avanzada
        baja_logica: false
      },
      
      // Ropa y Accesorios
      {
        nombre: 'Camiseta Básica',
        sku: 'CMS-020-M',
        fkid_peso: 1, // 0.5 kg
        fkid_categoria: 15, // Ropa y Accesorios
        fkid_ciudad: 1, // Bogotá // Bogotá
        descripcion: 'Camiseta básica de algodón, talla M',
        stock_inicial: 45,
        stock_minimo: 9,
        stock_maximo: 90,
        costo_unitario: 18000.00,
        precio_venta: 25000.00,
        fkid_proveedor: 7, // Textiles del Norte
        baja_logica: false
      },
      {
        nombre: 'Jeans Clásicos',
        sku: 'JNS-021-32',
        fkid_peso: 1, // 0.5 kg
        fkid_categoria: 15, // Ropa y Accesorios
        fkid_ciudad: 2, // Medellín // Medellín
        descripcion: 'Jeans clásicos de mezclilla, cintura 32',
        stock_inicial: 20,
        stock_minimo: 4,
        stock_maximo: 40,
        costo_unitario: 45000.00,
        precio_venta: 65000.00,
        fkid_proveedor: 7, // Textiles del Norte
        baja_logica: false
      }
    ];

    await queryInterface.bulkInsert('inventarios', inventarios.map(inventario => ({
      ...inventario,
      created_at: new Date(),
      updated_at: new Date()
    })));
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('inventarios', null, {});
  }
};
