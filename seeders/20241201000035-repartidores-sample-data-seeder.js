'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const repartidores = [
      {
        codigo_repartidor: 'REP-001',
        nombre_completo: 'Juan Carlos Pérez',
        telefono: '555-1234',
        email: 'juan.perez@miaumiau.com',
        fkid_ciudad: 1,
        fkid_usuario: null,
        tipo_vehiculo: 'moto',
        capacidad_carga: 25.00,
        estado: 'disponible',
        zona_cobertura: JSON.stringify({
          centro: { lat: 19.4326, lng: -99.1332 },
          radio: 5.0
        }),
        horario_trabajo: JSON.stringify({
          lunes: { inicio: '08:00', fin: '18:00' },
          martes: { inicio: '08:00', fin: '18:00' },
          miercoles: { inicio: '08:00', fin: '18:00' },
          jueves: { inicio: '08:00', fin: '18:00' },
          viernes: { inicio: '08:00', fin: '18:00' },
          sabado: { inicio: '09:00', fin: '15:00' },
          domingo: null
        }),
        tarifa_base: 15.00,
        comision_porcentaje: 10.00,
        fecha_ingreso: '2024-01-15',
        fecha_nacimiento: '1990-05-20',
        direccion: 'Calle Principal 123, Col. Centro',
        documento_identidad: '12345678',
        licencia_conducir: 'LIC-123456',
        seguro_vehiculo: 'SEGURO-789',
        notas: 'Repartidor experimentado, conoce bien la zona centro',
        calificacion_promedio: 4.5,
        total_entregas: 150,
        total_km_recorridos: 2500.50,
        fecha_ultima_entrega: '2024-12-05 14:30:00',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        codigo_repartidor: 'REP-002',
        nombre_completo: 'María González',
        telefono: '555-5678',
        email: 'maria.gonzalez@miaumiau.com',
        fkid_ciudad: 1,
        fkid_usuario: null,
        tipo_vehiculo: 'bicicleta',
        capacidad_carga: 15.00,
        estado: 'disponible',
        zona_cobertura: JSON.stringify({
          centro: { lat: 19.4326, lng: -99.1332 },
          radio: 3.0
        }),
        horario_trabajo: JSON.stringify({
          lunes: { inicio: '09:00', fin: '17:00' },
          martes: { inicio: '09:00', fin: '17:00' },
          miercoles: { inicio: '09:00', fin: '17:00' },
          jueves: { inicio: '09:00', fin: '17:00' },
          viernes: { inicio: '09:00', fin: '17:00' },
          sabado: null,
          domingo: null
        }),
        tarifa_base: 12.00,
        comision_porcentaje: 8.00,
        fecha_ingreso: '2024-02-01',
        fecha_nacimiento: '1995-08-15',
        direccion: 'Av. Secundaria 456, Col. Norte',
        documento_identidad: '87654321',
        licencia_conducir: null,
        seguro_vehiculo: null,
        notas: 'Especializada en entregas rápidas en bicicleta',
        calificacion_promedio: 4.2,
        total_entregas: 89,
        total_km_recorridos: 1200.75,
        fecha_ultima_entrega: '2024-12-04 16:45:00',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        codigo_repartidor: 'REP-003',
        nombre_completo: 'Carlos Rodríguez',
        telefono: '555-9012',
        email: 'carlos.rodriguez@miaumiau.com',
        fkid_ciudad: 1,
        fkid_usuario: null,
        tipo_vehiculo: 'auto',
        capacidad_carga: 50.00,
        estado: 'disponible',
        zona_cobertura: JSON.stringify({
          centro: { lat: 19.4326, lng: -99.1332 },
          radio: 10.0
        }),
        horario_trabajo: JSON.stringify({
          lunes: { inicio: '07:00', fin: '19:00' },
          martes: { inicio: '07:00', fin: '19:00' },
          miercoles: { inicio: '07:00', fin: '19:00' },
          jueves: { inicio: '07:00', fin: '19:00' },
          viernes: { inicio: '07:00', fin: '19:00' },
          sabado: { inicio: '08:00', fin: '16:00' },
          domingo: { inicio: '09:00', fin: '15:00' }
        }),
        tarifa_base: 25.00,
        comision_porcentaje: 12.00,
        fecha_ingreso: '2023-11-10',
        fecha_nacimiento: '1988-12-03',
        direccion: 'Calle Tercera 789, Col. Sur',
        documento_identidad: '11223344',
        licencia_conducir: 'LIC-789012',
        seguro_vehiculo: 'SEGURO-456',
        notas: 'Experto en entregas de productos pesados y voluminosos',
        calificacion_promedio: 4.8,
        total_entregas: 234,
        total_km_recorridos: 4500.25,
        fecha_ultima_entrega: '2024-12-06 11:20:00',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        codigo_repartidor: 'REP-004',
        nombre_completo: 'Ana Martínez',
        telefono: '555-3456',
        email: 'ana.martinez@miaumiau.com',
        fkid_ciudad: 1,
        fkid_usuario: null,
        tipo_vehiculo: 'moto',
        capacidad_carga: 20.00,
        estado: 'en_ruta',
        zona_cobertura: JSON.stringify({
          centro: { lat: 19.4326, lng: -99.1332 },
          radio: 4.0
        }),
        horario_trabajo: JSON.stringify({
          lunes: { inicio: '10:00', fin: '20:00' },
          martes: { inicio: '10:00', fin: '20:00' },
          miercoles: { inicio: '10:00', fin: '20:00' },
          jueves: { inicio: '10:00', fin: '20:00' },
          viernes: { inicio: '10:00', fin: '20:00' },
          sabado: { inicio: '11:00', fin: '17:00' },
          domingo: null
        }),
        tarifa_base: 18.00,
        comision_porcentaje: 9.00,
        fecha_ingreso: '2024-03-20',
        fecha_nacimiento: '1992-07-10',
        direccion: 'Calle Cuarta 321, Col. Este',
        documento_identidad: '55667788',
        licencia_conducir: 'LIC-345678',
        seguro_vehiculo: 'SEGURO-123',
        notas: 'Especializada en entregas nocturnas',
        calificacion_promedio: 4.3,
        total_entregas: 112,
        total_km_recorridos: 1800.00,
        fecha_ultima_entrega: '2024-12-06 09:15:00',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        codigo_repartidor: 'REP-005',
        nombre_completo: 'Luis Hernández',
        telefono: '555-7890',
        email: 'luis.hernandez@miaumiau.com',
        fkid_ciudad: 1,
        fkid_usuario: null,
        tipo_vehiculo: 'camioneta',
        capacidad_carga: 75.00,
        estado: 'ocupado',
        zona_cobertura: JSON.stringify({
          centro: { lat: 19.4326, lng: -99.1332 },
          radio: 15.0
        }),
        horario_trabajo: JSON.stringify({
          lunes: { inicio: '06:00', fin: '18:00' },
          martes: { inicio: '06:00', fin: '18:00' },
          miercoles: { inicio: '06:00', fin: '18:00' },
          jueves: { inicio: '06:00', fin: '18:00' },
          viernes: { inicio: '06:00', fin: '18:00' },
          sabado: { inicio: '07:00', fin: '15:00' },
          domingo: null
        }),
        tarifa_base: 35.00,
        comision_porcentaje: 15.00,
        fecha_ingreso: '2023-08-15',
        fecha_nacimiento: '1985-03-25',
        direccion: 'Av. Principal 654, Col. Oeste',
        documento_identidad: '99887766',
        licencia_conducir: 'LIC-901234',
        seguro_vehiculo: 'SEGURO-567',
        notas: 'Especializado en entregas comerciales y productos pesados',
        calificacion_promedio: 4.6,
        total_entregas: 198,
        total_km_recorridos: 3200.80,
        fecha_ultima_entrega: '2024-12-05 13:45:00',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('repartidores', repartidores, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('repartidores', {
      codigo_repartidor: [
        'REP-001',
        'REP-002',
        'REP-003',
        'REP-004',
        'REP-005'
      ]
    }, {});
  }
};
