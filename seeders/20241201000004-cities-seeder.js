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
        nombre: 'Bogotá',
        departamento: 'Cundinamarca',
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
      {
        nombre: 'Medellín',
        departamento: 'Antioquia',
        direccion_operaciones: 'Calle 50 #46-42, El Poblado, Medellín',
        estado_inicial: 'activa',
        numero_zonas_entrega: 5,
        area_cobertura: 380.64,
        tiempo_promedio_entrega: 35,
        horario_atencion: 'Lunes a Viernes: 8:00 AM - 6:00 PM, Sábados: 9:00 AM - 1:00 PM',
        manager: 'Carlos Rodríguez',
        telefono: '+57 4 567-8901',
        email_contacto: 'medellin@miaumiau.com',
        notas_adicionales: 'Segunda ciudad más importante, excelente conectividad',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'Cali',
        departamento: 'Valle del Cauca',
        direccion_operaciones: 'Avenida 6N #28-09, Granada, Cali',
        estado_inicial: 'activa',
        numero_zonas_entrega: 4,
        area_cobertura: 564.00,
        tiempo_promedio_entrega: 40,
        horario_atencion: 'Lunes a Viernes: 8:00 AM - 5:30 PM, Sábados: 9:00 AM - 12:00 PM',
        manager: 'Ana Martínez',
        telefono: '+57 2 345-6789',
        email_contacto: 'cali@miaumiau.com',
        notas_adicionales: 'Ciudad en crecimiento, potencial de expansión',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'Barranquilla',
        departamento: 'Atlántico',
        direccion_operaciones: 'Calle 84 #46-38, El Prado, Barranquilla',
        estado_inicial: 'activa',
        numero_zonas_entrega: 3,
        area_cobertura: 166.00,
        tiempo_promedio_entrega: 30,
        horario_atencion: 'Lunes a Viernes: 8:00 AM - 5:00 PM, Sábados: 9:00 AM - 12:00 PM',
        manager: 'Luis Herrera',
        telefono: '+57 5 456-7890',
        email_contacto: 'barranquilla@miaumiau.com',
        notas_adicionales: 'Puerto importante, acceso a zona costera',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'Cartagena',
        departamento: 'Bolívar',
        direccion_operaciones: 'Calle 30 #8-269, Bocagrande, Cartagena',
        estado_inicial: 'activa',
        numero_zonas_entrega: 2,
        area_cobertura: 609.10,
        tiempo_promedio_entrega: 50,
        horario_atencion: 'Lunes a Viernes: 8:00 AM - 5:00 PM, Sábados: 9:00 AM - 1:00 PM',
        manager: 'Isabel Torres',
        telefono: '+57 5 567-8901',
        email_contacto: 'cartagena@miaumiau.com',
        notas_adicionales: 'Ciudad turística, alta demanda en temporadas',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'Bucaramanga',
        departamento: 'Santander',
        direccion_operaciones: 'Calle 35 #19-07, Centro, Bucaramanga',
        estado_inicial: 'en_construccion',
        numero_zonas_entrega: 2,
        area_cobertura: 165.00,
        tiempo_promedio_entrega: 35,
        horario_atencion: 'Lunes a Viernes: 8:00 AM - 5:00 PM',
        manager: 'Roberto Silva',
        telefono: '+57 7 678-9012',
        email_contacto: 'bucaramanga@miaumiau.com',
        notas_adicionales: 'Nueva sucursal en construcción, apertura prevista en 3 meses',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'Pereira',
        departamento: 'Risaralda',
        direccion_operaciones: 'Carrera 8 #23-09, Centro, Pereira',
        estado_inicial: 'mantenimiento',
        numero_zonas_entrega: 1,
        area_cobertura: 702.00,
        tiempo_promedio_entrega: 40,
        horario_atencion: 'Lunes a Viernes: 8:00 AM - 4:00 PM',
        manager: 'Patricia Vargas',
        telefono: '+57 6 789-0123',
        email_contacto: 'pereira@miaumiau.com',
        notas_adicionales: 'Sucursal en mantenimiento programado, reapertura en 2 semanas',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'Santa Marta',
        departamento: 'Magdalena',
        direccion_operaciones: 'Calle 22 #3-07, Centro Histórico, Santa Marta',
        estado_inicial: 'inactiva',
        numero_zonas_entrega: 1,
        area_cobertura: 2391.65,
        tiempo_promedio_entrega: 60,
        horario_atencion: 'Lunes a Viernes: 9:00 AM - 4:00 PM',
        manager: 'Diego Morales',
        telefono: '+57 5 890-1234',
        email_contacto: 'santamarta@miaumiau.com',
        notas_adicionales: 'Sucursal temporalmente inactiva por reestructuración',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    // Insertar ciudades usando queryInterface
    await queryInterface.bulkInsert('cities', cities);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('cities', null, {});
  }
};
