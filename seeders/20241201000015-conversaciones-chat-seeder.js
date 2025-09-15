'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existen chats para evitar duplicados
    const existingChats = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM conversaciones_chat',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Solo insertar si no hay chats existentes
    if (existingChats[0].count > 0) {
      console.log('Chats ya existen, saltando inserción');
      return;
    }
    
    const chats = [
      // Conversación 1 - Juan Pérez
      {
        fkid_conversacion: 1,
        fecha: '2024-12-01',
        hora: '09:00:00',
        from: 'usuario',
        mensaje: 'Hola, necesito ayuda con mi pedido',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: true,
        baja_logica: false
      },
      {
        fkid_conversacion: 1,
        fecha: '2024-12-01',
        hora: '09:01:00',
        from: 'bot',
        mensaje: 'Hola Juan! Te ayudo con tu pedido. ¿Cuál es el número de tu pedido?',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: true,
        baja_logica: false
      },
      {
        fkid_conversacion: 1,
        fecha: '2024-12-01',
        hora: '09:02:00',
        from: 'usuario',
        mensaje: 'El número es #12345',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: true,
        baja_logica: false
      },
      {
        fkid_conversacion: 1,
        fecha: '2024-12-01',
        hora: '09:03:00',
        from: 'bot',
        mensaje: 'Perfecto, veo que tu pedido está en camino. Llegará en 30 minutos.',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: false,
        baja_logica: false
      },
      
      // Conversación 2 - María González
      {
        fkid_conversacion: 2,
        fecha: '2024-12-01',
        hora: '10:15:00',
        from: 'usuario',
        mensaje: 'Buenos días, quiero cancelar mi suscripción',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: true,
        baja_logica: false
      },
      {
        fkid_conversacion: 2,
        fecha: '2024-12-01',
        hora: '10:16:00',
        from: 'agente',
        mensaje: 'Hola María, lamento que quieras cancelar. ¿Hay algo que podamos hacer para mejorar tu experiencia?',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: true,
        baja_logica: false
      },
      {
        fkid_conversacion: 2,
        fecha: '2024-12-01',
        hora: '10:17:00',
        from: 'usuario',
        mensaje: 'No, simplemente ya no lo necesito',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: true,
        baja_logica: false
      },
      
      // Conversación 3 - Carlos Rodríguez
      {
        fkid_conversacion: 3,
        fecha: '2024-12-01',
        hora: '11:30:00',
        from: 'usuario',
        mensaje: 'Tengo un problema con la aplicación',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: true,
        baja_logica: false
      },
      {
        fkid_conversacion: 3,
        fecha: '2024-12-01',
        hora: '11:31:00',
        from: 'bot',
        mensaje: 'Hola Carlos! ¿Podrías describir el problema que estás experimentando?',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: true,
        baja_logica: false
      },
      {
        fkid_conversacion: 3,
        fecha: '2024-12-01',
        hora: '11:32:00',
        from: 'usuario',
        mensaje: 'La app se cierra cuando intento hacer login',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: false,
        baja_logica: false
      },
      
      // Conversación 4 - Ana Martínez
      {
        fkid_conversacion: 4,
        fecha: '2024-11-30',
        hora: '14:20:00',
        from: 'usuario',
        mensaje: '¿Cuáles son los horarios de atención?',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: true,
        baja_logica: false
      },
      {
        fkid_conversacion: 4,
        fecha: '2024-11-30',
        hora: '14:21:00',
        from: 'bot',
        mensaje: 'Nuestros horarios de atención son de lunes a viernes de 8:00 AM a 6:00 PM',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: true,
        baja_logica: false
      },
      {
        fkid_conversacion: 4,
        fecha: '2024-11-30',
        hora: '14:22:00',
        from: 'usuario',
        mensaje: 'Perfecto, gracias',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: true,
        baja_logica: false
      },
      
      // Conversación 5 - Usuario Demo
      {
        fkid_conversacion: 5,
        fecha: '2024-12-01',
        hora: '15:45:00',
        from: 'usuario',
        mensaje: '¿Cómo puedo cambiar mi contraseña?',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: false,
        baja_logica: false
      },
      
      // Conversación 6 - Bot de Soporte
      {
        fkid_conversacion: 6,
        fecha: '2024-12-01',
        hora: '16:00:00',
        from: 'bot',
        mensaje: 'Bienvenido al sistema de soporte. ¿En qué puedo ayudarte?',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: true,
        baja_logica: false
      },
      
      // Conversación 7 - Agente Virtual
      {
        fkid_conversacion: 7,
        fecha: '2024-12-01',
        hora: '16:10:00',
        from: 'bot',
        mensaje: 'Hola! Soy tu asistente virtual. ¿Tienes alguna pregunta?',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: true,
        baja_logica: false
      },
      
      // Conversación 8 - Sistema de Notificaciones
      {
        fkid_conversacion: 8,
        fecha: '2024-12-01',
        hora: '16:20:00',
        from: 'sistema',
        mensaje: 'Sistema iniciado correctamente',
        tipo_mensaje: 'texto',
        metadata: JSON.stringify({ system: 'notification', level: 'info' }),
        leido: true,
        baja_logica: false
      },
      
      // Conversación 9 - Pedro López
      {
        fkid_conversacion: 9,
        fecha: '2024-12-01',
        hora: '17:00:00',
        from: 'usuario',
        mensaje: 'Necesito información sobre los productos disponibles',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: true,
        baja_logica: false
      },
      {
        fkid_conversacion: 9,
        fecha: '2024-12-01',
        hora: '17:01:00',
        from: 'bot',
        mensaje: 'Te envío el catálogo de productos disponibles',
        tipo_mensaje: 'archivo',
        metadata: JSON.stringify({ filename: 'catalogo.pdf', size: '2.5MB' }),
        leido: false,
        baja_logica: false
      },
      
      // Conversación 10 - Laura Sánchez
      {
        fkid_conversacion: 10,
        fecha: '2024-11-30',
        hora: '18:30:00',
        from: 'usuario',
        mensaje: '¿Pueden enviar mi pedido a otra dirección?',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: true,
        baja_logica: false
      },
      {
        fkid_conversacion: 10,
        fecha: '2024-11-30',
        hora: '18:31:00',
        from: 'agente',
        mensaje: 'Claro Laura, ¿cuál es la nueva dirección?',
        tipo_mensaje: 'texto',
        metadata: null,
        leido: true,
        baja_logica: false
      },
      {
        fkid_conversacion: 10,
        fecha: '2024-11-30',
        hora: '18:32:00',
        from: 'usuario',
        mensaje: 'Calle 123 #45-67, Bogotá',
        tipo_mensaje: 'ubicacion',
        metadata: JSON.stringify({ address: 'Calle 123 #45-67, Bogotá', coordinates: { lat: 4.6097, lng: -74.0817 } }),
        leido: true,
        baja_logica: false
      }
    ];

    await queryInterface.bulkInsert('conversaciones_chat', chats.map(chat => ({
      ...chat,
      created_at: new Date(),
      updated_at: new Date()
    })));
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('conversaciones_chat', null, {});
  }
};
