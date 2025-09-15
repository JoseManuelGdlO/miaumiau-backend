'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existen pedidos para evitar duplicados
    const existingPedidos = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM pedidos',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Solo insertar si no hay pedidos existentes
    if (existingPedidos[0].count > 0) {
      console.log('Pedidos ya existen, saltando inserción');
      return;
    }
    
    const pedidos = [
      {
        fkid_cliente: 1, // Administrador Principal
        telefono_referencia: '+57 300 123 4567',
        email_referencia: 'admin@miaumiau.com',
        direccion_entrega: 'Calle 123 #45-67, Barrio Centro, Bogotá',
        fkid_ciudad: 1, // Bogotá // Bogotá
        numero_pedido: 'PED-20241201-001',
        estado: 'entregado',
        fecha_pedido: '2024-11-25 10:30:00',
        fecha_entrega_estimada: '2024-11-26 14:00:00',
        fecha_entrega_real: '2024-11-26 13:45:00',
        subtotal: 150000.00,
        impuestos: 28500.00,
        descuento: 0.00,
        total: 178500.00,
        metodo_pago: 'tarjeta',
        notas: 'Entregar en horario de oficina',
        baja_logica: false
      },
      {
        fkid_cliente: 2, // María González
        telefono_referencia: '+57 310 987 6543',
        email_referencia: 'maria.gonzalez@email.com',
        direccion_entrega: 'Carrera 45 #78-90, Barrio Norte, Medellín',
        fkid_ciudad: 2, // Medellín // Medellín
        numero_pedido: 'PED-20241201-002',
        estado: 'en_camino',
        fecha_pedido: '2024-12-01 09:15:00',
        fecha_entrega_estimada: '2024-12-02 16:00:00',
        fecha_entrega_real: null,
        subtotal: 75000.00,
        impuestos: 14250.00,
        descuento: 5000.00,
        total: 84250.00,
        metodo_pago: 'efectivo',
        notas: 'Llamar antes de entregar',
        baja_logica: false
      },
      {
        fkid_cliente: 3, // Carlos Rodríguez
        telefono_referencia: '+57 315 555 1234',
        email_referencia: 'carlos.rodriguez@email.com',
        direccion_entrega: 'Avenida 80 #12-34, Barrio Sur, Cali',
        fkid_ciudad: 3, // Cali // Cali
        numero_pedido: 'PED-20241201-003',
        estado: 'en_preparacion',
        fecha_pedido: '2024-12-01 14:20:00',
        fecha_entrega_estimada: '2024-12-03 10:00:00',
        fecha_entrega_real: null,
        subtotal: 200000.00,
        impuestos: 38000.00,
        descuento: 15000.00,
        total: 223000.00,
        metodo_pago: 'transferencia',
        notas: 'Productos frágiles, manejar con cuidado',
        baja_logica: false
      },
      {
        fkid_cliente: 4, // Ana Martínez
        telefono_referencia: '+57 320 777 8888',
        email_referencia: 'ana.martinez@email.com',
        direccion_entrega: 'Calle 50 #23-45, Barrio Este, Barranquilla',
        fkid_ciudad: 4, // Barranquilla // Barranquilla
        numero_pedido: 'PED-20241201-004',
        estado: 'confirmado',
        fecha_pedido: '2024-12-01 16:45:00',
        fecha_entrega_estimada: '2024-12-04 12:00:00',
        fecha_entrega_real: null,
        subtotal: 95000.00,
        impuestos: 18050.00,
        descuento: 0.00,
        total: 113050.00,
        metodo_pago: 'pago_movil',
        notas: 'Entregar en la tarde',
        baja_logica: false
      },
      {
        fkid_cliente: 5, // Usuario Demo
        telefono_referencia: '+57 300 999 0000',
        email_referencia: 'demo@email.com',
        direccion_entrega: 'Carrera 30 #15-67, Barrio Oeste, Bucaramanga',
        fkid_ciudad: 5, // Cartagena // Bucaramanga
        numero_pedido: 'PED-20241201-005',
        estado: 'pendiente',
        fecha_pedido: '2024-12-01 18:30:00',
        fecha_entrega_estimada: '2024-12-05 15:00:00',
        fecha_entrega_real: null,
        subtotal: 120000.00,
        impuestos: 22800.00,
        descuento: 8000.00,
        total: 134800.00,
        metodo_pago: 'efectivo',
        notas: 'Cliente nuevo, verificar datos',
        baja_logica: false
      },
      {
        fkid_cliente: 1, // Administrador Principal
        telefono_referencia: '+57 300 123 4567',
        email_referencia: 'admin@miaumiau.com',
        direccion_entrega: 'Calle 100 #25-30, Barrio Norte, Bogotá',
        fkid_ciudad: 1, // Bogotá // Bogotá
        numero_pedido: 'PED-20241130-001',
        estado: 'cancelado',
        fecha_pedido: '2024-11-30 11:00:00',
        fecha_entrega_estimada: '2024-12-01 14:00:00',
        fecha_entrega_real: null,
        subtotal: 80000.00,
        impuestos: 15200.00,
        descuento: 0.00,
        total: 95200.00,
        metodo_pago: 'tarjeta',
        notas: 'Cancelado por solicitud del cliente',
        baja_logica: false
      },
      {
        fkid_cliente: 2, // María González
        telefono_referencia: '+57 310 987 6543',
        email_referencia: 'maria.gonzalez@email.com',
        direccion_entrega: 'Carrera 50 #90-12, Barrio Sur, Medellín',
        fkid_ciudad: 2, // Medellín // Medellín
        numero_pedido: 'PED-20241129-001',
        estado: 'entregado',
        fecha_pedido: '2024-11-29 08:45:00',
        fecha_entrega_estimada: '2024-11-30 16:00:00',
        fecha_entrega_real: '2024-11-30 15:30:00',
        subtotal: 180000.00,
        impuestos: 34200.00,
        descuento: 20000.00,
        total: 194200.00,
        metodo_pago: 'transferencia',
        notas: 'Entrega exitosa',
        baja_logica: false
      },
      {
        fkid_cliente: 3, // Carlos Rodríguez
        telefono_referencia: '+57 315 555 1234',
        email_referencia: 'carlos.rodriguez@email.com',
        direccion_entrega: 'Avenida 6N #28-15, Barrio Centro, Cali',
        fkid_ciudad: 3, // Cali // Cali
        numero_pedido: 'PED-20241128-001',
        estado: 'entregado',
        fecha_pedido: '2024-11-28 13:20:00',
        fecha_entrega_estimada: '2024-11-29 11:00:00',
        fecha_entrega_real: '2024-11-29 10:45:00',
        subtotal: 65000.00,
        impuestos: 12350.00,
        descuento: 3000.00,
        total: 74350.00,
        metodo_pago: 'efectivo',
        notas: 'Cliente satisfecho',
        baja_logica: false
      },
      {
        fkid_cliente: 4, // Ana Martínez
        telefono_referencia: '+57 320 777 8888',
        email_referencia: 'ana.martinez@email.com',
        direccion_entrega: 'Calle 72 #45-67, Barrio Norte, Barranquilla',
        fkid_ciudad: 4, // Barranquilla // Barranquilla
        numero_pedido: 'PED-20241127-001',
        estado: 'en_camino',
        fecha_pedido: '2024-11-27 15:10:00',
        fecha_entrega_estimada: '2024-11-28 14:00:00',
        fecha_entrega_real: null,
        subtotal: 110000.00,
        impuestos: 20900.00,
        descuento: 10000.00,
        total: 120900.00,
        metodo_pago: 'pago_movil',
        notas: 'En tránsito',
        baja_logica: false
      },
      {
        fkid_cliente: 5, // Usuario Demo
        telefono_referencia: '+57 300 999 0000',
        email_referencia: 'demo@email.com',
        direccion_entrega: 'Carrera 15 #25-40, Barrio Centro, Bucaramanga',
        fkid_ciudad: 5, // Cartagena // Bucaramanga
        numero_pedido: 'PED-20241126-001',
        estado: 'confirmado',
        fecha_pedido: '2024-11-26 10:30:00',
        fecha_entrega_estimada: '2024-11-27 16:00:00',
        fecha_entrega_real: null,
        subtotal: 85000.00,
        impuestos: 16150.00,
        descuento: 5000.00,
        total: 96150.00,
        metodo_pago: 'tarjeta',
        notas: 'Preparando pedido',
        baja_logica: false
      }
    ];

    await queryInterface.bulkInsert('pedidos', pedidos.map(pedido => ({
      ...pedido,
      created_at: new Date(),
      updated_at: new Date()
    })));
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('pedidos', null, {});
  }
};
