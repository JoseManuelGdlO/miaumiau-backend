'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existen logs para evitar duplicados
    const existingLogs = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM conversaciones_logs',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Solo insertar si no hay logs existentes
    if (existingLogs[0].count > 0) {
      console.log('Logs ya existen, saltando inserción');
      return;
    }
    
    const logs = [
      // Logs para Conversación 1 - Juan Pérez
      {
        fkid_conversacion: 1,
        fecha: '2024-12-01',
        hora: '09:00:00',
        data: JSON.stringify({
          from: 'Juan Pérez',
          tipo_usuario: 'cliente',
          status_inicial: 'activa',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ip_address: '192.168.1.100'
        }),
        tipo_log: 'inicio',
        nivel: 'info',
        descripcion: 'Conversación iniciada por Juan Pérez',
        baja_logica: false
      },
      {
        fkid_conversacion: 1,
        fecha: '2024-12-01',
        hora: '09:01:00',
        data: JSON.stringify({
          mensaje_id: 1,
          from: 'bot',
          tipo_mensaje: 'texto',
          mensaje_length: 65,
          response_time: 1.2
        }),
        tipo_log: 'mensaje',
        nivel: 'info',
        descripcion: 'Bot respondió a consulta de pedido',
        baja_logica: false
      },
      
      // Logs para Conversación 2 - María González
      {
        fkid_conversacion: 2,
        fecha: '2024-12-01',
        hora: '10:15:00',
        data: JSON.stringify({
          from: 'María González',
          tipo_usuario: 'cliente',
          status_inicial: 'activa',
          user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          ip_address: '192.168.1.101'
        }),
        tipo_log: 'inicio',
        nivel: 'info',
        descripcion: 'Conversación iniciada por María González',
        baja_logica: false
      },
      {
        fkid_conversacion: 2,
        fecha: '2024-12-01',
        hora: '10:16:00',
        data: JSON.stringify({
          mensaje_id: 2,
          from: 'agente',
          tipo_mensaje: 'texto',
          mensaje_length: 95,
          agent_id: 1,
          response_time: 0.8
        }),
        tipo_log: 'mensaje',
        nivel: 'info',
        descripcion: 'Agente respondió a solicitud de cancelación',
        baja_logica: false
      },
      
      // Logs para Conversación 3 - Carlos Rodríguez
      {
        fkid_conversacion: 3,
        fecha: '2024-12-01',
        hora: '11:30:00',
        data: JSON.stringify({
          from: 'Carlos Rodríguez',
          tipo_usuario: 'cliente',
          status_inicial: 'pausada',
          user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
          ip_address: '192.168.1.102'
        }),
        tipo_log: 'inicio',
        nivel: 'info',
        descripcion: 'Conversación iniciada por Carlos Rodríguez',
        baja_logica: false
      },
      {
        fkid_conversacion: 3,
        fecha: '2024-12-01',
        hora: '11:32:00',
        data: JSON.stringify({
          mensaje_id: 3,
          from: 'usuario',
          tipo_mensaje: 'texto',
          mensaje_length: 45,
          error_reported: 'app_crash_on_login'
        }),
        tipo_log: 'error',
        nivel: 'error',
        descripcion: 'Usuario reportó error de aplicación',
        baja_logica: false
      },
      
      // Logs para Conversación 4 - Ana Martínez
      {
        fkid_conversacion: 4,
        fecha: '2024-11-30',
        hora: '14:20:00',
        data: JSON.stringify({
          from: 'Ana Martínez',
          tipo_usuario: 'cliente',
          status_inicial: 'cerrada',
          user_agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          ip_address: '192.168.1.103'
        }),
        tipo_log: 'inicio',
        nivel: 'info',
        descripcion: 'Conversación iniciada por Ana Martínez',
        baja_logica: false
      },
      {
        fkid_conversacion: 4,
        fecha: '2024-11-30',
        hora: '14:22:00',
        data: JSON.stringify({
          status_anterior: 'activa',
          status_nuevo: 'cerrada',
          closed_by: 'user',
          duration_minutes: 2
        }),
        tipo_log: 'cierre',
        nivel: 'info',
        descripcion: 'Conversación cerrada por el usuario',
        baja_logica: false
      },
      
      // Logs para Conversación 5 - Usuario Demo
      {
        fkid_conversacion: 5,
        fecha: '2024-12-01',
        hora: '15:45:00',
        data: JSON.stringify({
          from: 'Usuario Demo',
          tipo_usuario: 'cliente',
          status_inicial: 'en_espera',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ip_address: '192.168.1.104'
        }),
        tipo_log: 'inicio',
        nivel: 'info',
        descripcion: 'Conversación iniciada por Usuario Demo',
        baja_logica: false
      },
      
      // Logs para Conversación 6 - Bot de Soporte
      {
        fkid_conversacion: 6,
        fecha: '2024-12-01',
        hora: '16:00:00',
        data: JSON.stringify({
          from: 'Bot de Soporte',
          tipo_usuario: 'bot',
          status_inicial: 'activa',
          bot_version: '2.1.0',
          capabilities: ['faq', 'order_tracking', 'basic_support']
        }),
        tipo_log: 'inicio',
        nivel: 'info',
        descripcion: 'Bot de soporte activado',
        baja_logica: false
      },
      
      // Logs para Conversación 7 - Agente Virtual
      {
        fkid_conversacion: 7,
        fecha: '2024-12-01',
        hora: '16:10:00',
        data: JSON.stringify({
          from: 'Agente Virtual',
          tipo_usuario: 'bot',
          status_inicial: 'activa',
          bot_version: '1.8.5',
          capabilities: ['general_chat', 'product_info', 'scheduling']
        }),
        tipo_log: 'inicio',
        nivel: 'info',
        descripcion: 'Agente virtual activado',
        baja_logica: false
      },
      
      // Logs para Conversación 8 - Sistema de Notificaciones
      {
        fkid_conversacion: 8,
        fecha: '2024-12-01',
        hora: '16:20:00',
        data: JSON.stringify({
          from: 'Sistema de Notificaciones',
          tipo_usuario: 'sistema',
          status_inicial: 'activa',
          system_version: '3.2.1',
          notification_type: 'system_startup',
          components: ['database', 'api', 'websocket']
        }),
        tipo_log: 'sistema',
        nivel: 'info',
        descripcion: 'Sistema iniciado correctamente',
        baja_logica: false
      },
      
      // Logs para Conversación 9 - Pedro López
      {
        fkid_conversacion: 9,
        fecha: '2024-12-01',
        hora: '17:00:00',
        data: JSON.stringify({
          from: 'Pedro López',
          tipo_usuario: 'cliente',
          status_inicial: 'activa',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ip_address: '192.168.1.105'
        }),
        tipo_log: 'inicio',
        nivel: 'info',
        descripcion: 'Conversación iniciada por Pedro López',
        baja_logica: false
      },
      {
        fkid_conversacion: 9,
        fecha: '2024-12-01',
        hora: '17:01:00',
        data: JSON.stringify({
          mensaje_id: 4,
          from: 'bot',
          tipo_mensaje: 'archivo',
          filename: 'catalogo.pdf',
          file_size: '2.5MB',
          download_count: 1
        }),
        tipo_log: 'mensaje',
        nivel: 'info',
        descripcion: 'Bot envió archivo de catálogo',
        baja_logica: false
      },
      
      // Logs para Conversación 10 - Laura Sánchez
      {
        fkid_conversacion: 10,
        fecha: '2024-11-30',
        hora: '18:30:00',
        data: JSON.stringify({
          from: 'Laura Sánchez',
          tipo_usuario: 'cliente',
          status_inicial: 'cerrada',
          user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          ip_address: '192.168.1.106'
        }),
        tipo_log: 'inicio',
        nivel: 'info',
        descripcion: 'Conversación iniciada por Laura Sánchez',
        baja_logica: false
      },
      {
        fkid_conversacion: 10,
        fecha: '2024-11-30',
        hora: '18:32:00',
        data: JSON.stringify({
          mensaje_id: 5,
          from: 'usuario',
          tipo_mensaje: 'ubicacion',
          address: 'Calle 123 #45-67, Bogotá',
          coordinates: { lat: 4.6097, lng: -74.0817 },
          location_accuracy: 'high'
        }),
        tipo_log: 'mensaje',
        nivel: 'info',
        descripcion: 'Usuario envió nueva dirección de entrega',
        baja_logica: false
      },
      {
        fkid_conversacion: 10,
        fecha: '2024-11-30',
        hora: '18:33:00',
        data: JSON.stringify({
          order_id: 'ORD-789',
          old_address: 'Calle 456 #78-90, Medellín',
          new_address: 'Calle 123 #45-67, Bogotá',
          updated_by: 'agente',
          estimated_delivery_change: '+2 hours'
        }),
        tipo_log: 'transferencia',
        nivel: 'info',
        descripcion: 'Dirección de entrega actualizada',
        baja_logica: false
      },
      
      // Logs de sistema adicionales
      {
        fkid_conversacion: 1,
        fecha: '2024-12-01',
        hora: '09:05:00',
        data: JSON.stringify({
          system_load: 0.45,
          memory_usage: '512MB',
          active_connections: 25,
          response_time_avg: 1.2
        }),
        tipo_log: 'sistema',
        nivel: 'debug',
        descripcion: 'Métricas del sistema',
        baja_logica: false
      },
      {
        fkid_conversacion: 2,
        fecha: '2024-12-01',
        hora: '10:20:00',
        data: JSON.stringify({
          error_code: 'DB_CONNECTION_TIMEOUT',
          error_message: 'Database connection timeout after 30 seconds',
          retry_count: 3,
          resolved: true
        }),
        tipo_log: 'error',
        nivel: 'warning',
        descripcion: 'Timeout de conexión a base de datos resuelto',
        baja_logica: false
      }
    ];

    await queryInterface.bulkInsert('conversaciones_logs', logs.map(log => ({
      ...log,
      created_at: new Date(),
      updated_at: new Date()
    })));
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('conversaciones_logs', null, {});
  }
};
