'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existen proveedores para evitar duplicados
    const existingProveedores = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM proveedores',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Solo insertar si no hay proveedores existentes
    if (existingProveedores[0].count > 0) {
      console.log('Proveedores ya existen, saltando inserción');
      return;
    }
    
    const proveedores = [
      {
        nombre: 'Distribuidora Central S.A.',
        descripcion: 'Distribuidora mayorista de alimentos y productos de consumo masivo con más de 20 años en el mercado.',
        correo: 'ventas@distribuidoracentral.com',
        telefono: '+57-1-234-5678',
        baja_logica: false
      },
      {
        nombre: 'Frutas y Verduras del Campo',
        descripcion: 'Proveedor especializado en frutas y verduras frescas directamente del campo.',
        correo: 'contacto@frutasdelcampo.com',
        telefono: '+57-1-345-6789',
        baja_logica: false
      },
      {
        nombre: 'Carnes Premium Ltda.',
        descripcion: 'Proveedor de carnes de alta calidad, especializado en cortes premium.',
        correo: 'pedidos@carnespremium.com',
        telefono: '+57-1-456-7890',
        baja_logica: false
      },
      {
        nombre: 'Lácteos del Valle',
        descripcion: 'Productor y distribuidor de productos lácteos frescos de la región.',
        correo: 'info@lacteosdelvalle.com',
        telefono: '+57-1-567-8901',
        baja_logica: false
      },
      {
        nombre: 'Electrodomésticos Modernos',
        descripcion: 'Distribuidor autorizado de electrodomésticos de las mejores marcas.',
        correo: 'ventas@electromodernos.com',
        telefono: '+57-1-678-9012',
        baja_logica: false
      },
      {
        nombre: 'Farmacia Central',
        descripcion: 'Distribuidora farmacéutica con amplio catálogo de medicamentos y productos de salud.',
        correo: 'pedidos@farmaciacentral.com',
        telefono: '+57-1-789-0123',
        baja_logica: false
      },
      {
        nombre: 'Textiles del Norte',
        descripcion: 'Proveedor de ropa y textiles para toda la familia, con precios competitivos.',
        correo: 'ventas@textilesdelnorte.com',
        telefono: '+57-1-890-1234',
        baja_logica: false
      },
      {
        nombre: 'Tecnología Avanzada',
        descripcion: 'Distribuidor de equipos electrónicos y de computación de última generación.',
        correo: 'info@tecnoavanzada.com',
        telefono: '+57-1-901-2345',
        baja_logica: false
      },
      {
        nombre: 'Productos de Limpieza Pro',
        descripcion: 'Especialistas en productos de limpieza industrial y doméstica.',
        correo: 'contacto@limpiezapro.com',
        telefono: '+57-1-012-3456',
        baja_logica: false
      },
      {
        nombre: 'Bebidas Refrescantes',
        descripcion: 'Distribuidora de bebidas gaseosas, jugos y bebidas alcohólicas.',
        correo: 'pedidos@bebidasrefrescantes.com',
        telefono: '+57-1-123-4567',
        baja_logica: false
      },
      {
        nombre: 'Panadería Artesanal',
        descripcion: 'Proveedor de productos de panadería y pastelería artesanal frescos.',
        correo: 'ventas@panaderiaartesanal.com',
        telefono: '+57-1-234-5679',
        baja_logica: false
      },
      {
        nombre: 'Congelados del Mar',
        descripcion: 'Especialistas en productos del mar congelados y mariscos.',
        correo: 'info@congeladosdelmar.com',
        telefono: '+57-1-345-6780',
        baja_logica: false
      },
      {
        nombre: 'Conservas Naturales',
        descripcion: 'Productor de conservas y enlatados con ingredientes naturales.',
        correo: 'contacto@conservasnaturales.com',
        telefono: '+57-1-456-7891',
        baja_logica: false
      },
      {
        nombre: 'Especias del Mundo',
        descripcion: 'Importador y distribuidor de especias y condimentos de todo el mundo.',
        correo: 'ventas@especiasdelmundo.com',
        telefono: '+57-1-567-8902',
        baja_logica: false
      },
      {
        nombre: 'Hogar y Jardín Plus',
        descripcion: 'Proveedor de artículos para el hogar, jardín y decoración.',
        correo: 'pedidos@hogaryjardinplus.com',
        telefono: '+57-1-678-9013',
        baja_logica: false
      },
      {
        nombre: 'Deportes y Aventura',
        descripcion: 'Distribuidor de equipos deportivos y artículos de aventura.',
        correo: 'info@deportesaventura.com',
        telefono: '+57-1-789-0124',
        baja_logica: false
      },
      {
        nombre: 'Libros y Más',
        descripcion: 'Distribuidora de libros, material educativo y papelería.',
        correo: 'ventas@librosymas.com',
        telefono: '+57-1-890-1235',
        baja_logica: false
      },
      {
        nombre: 'Juguetes Creativos',
        descripcion: 'Proveedor de juguetes educativos y de entretenimiento para todas las edades.',
        correo: 'contacto@juguetescreativos.com',
        telefono: '+57-1-901-2346',
        baja_logica: false
      },
      {
        nombre: 'Productos Orgánicos',
        descripcion: 'Distribuidor especializado en productos orgánicos y naturales.',
        correo: 'info@productosorganicos.com',
        telefono: '+57-1-012-3457',
        baja_logica: false
      },
      {
        nombre: 'Suministros Industriales',
        descripcion: 'Proveedor de suministros y equipos para la industria.',
        correo: 'ventas@suministrosindustriales.com',
        telefono: '+57-1-123-4568',
        baja_logica: false
      }
    ];

    await queryInterface.bulkInsert('proveedores', proveedores.map(proveedor => ({
      ...proveedor,
      created_at: new Date(),
      updated_at: new Date()
    })));
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('proveedores', null, {});
  }
};
