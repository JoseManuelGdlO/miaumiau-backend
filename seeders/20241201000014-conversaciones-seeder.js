'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existen conversaciones para evitar duplicados
    const existingConversaciones = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM conversaciones',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Solo insertar si no hay conversaciones existentes
    if (existingConversaciones[0].count > 0) {
      console.log('Conversaciones ya existen, saltando inserción');
      return;
    }
    
    const conversaciones = [
      {
        from: 'Juan Pérez',
        status: 'activa',
        id_cliente: 1, // Usuario existente
        tipo_usuario: 'cliente',
        baja_logica: false
      },
      {
        from: 'María González',
        status: 'activa',
        id_cliente: 2, // Usuario existente
        tipo_usuario: 'cliente',
        baja_logica: false
      },
      {
        from: 'Carlos Rodríguez',
        status: 'pausada',
        id_cliente: 3, // Usuario existente
        tipo_usuario: 'cliente',
        baja_logica: false
      },
      {
        from: 'Ana Martínez',
        status: 'cerrada',
        id_cliente: 4, // Usuario existente
        tipo_usuario: 'cliente',
        baja_logica: false
      },
      {
        from: 'Usuario Demo',
        status: 'en_espera',
        id_cliente: 5, // Usuario existente
        tipo_usuario: 'cliente',
        baja_logica: false
      },
      {
        from: 'Bot de Soporte',
        status: 'activa',
        id_cliente: null,
        tipo_usuario: 'bot',
        baja_logica: false
      },
      {
        from: 'Agente Virtual',
        status: 'activa',
        id_cliente: null,
        tipo_usuario: 'bot',
        baja_logica: false
      },
      {
        from: 'Sistema de Notificaciones',
        status: 'activa',
        id_cliente: null,
        tipo_usuario: 'sistema',
        baja_logica: false
      },
      {
        from: 'Pedro López',
        status: 'activa',
        id_cliente: 1, // Usuario existente
        tipo_usuario: 'cliente',
        baja_logica: false
      },
      {
        from: 'Laura Sánchez',
        status: 'cerrada',
        id_cliente: 2, // Usuario existente
        tipo_usuario: 'cliente',
        baja_logica: false
      },
      {
        from: 'Miguel Torres',
        status: 'pausada',
        id_cliente: 3, // Usuario existente
        tipo_usuario: 'cliente',
        baja_logica: false
      },
      {
        from: 'Sofía Ramírez',
        status: 'activa',
        id_cliente: 4, // Usuario existente
        tipo_usuario: 'cliente',
        baja_logica: false
      },
      {
        from: 'Bot de Ventas',
        status: 'activa',
        id_cliente: null,
        tipo_usuario: 'bot',
        baja_logica: false
      },
      {
        from: 'Sistema de Alertas',
        status: 'activa',
        id_cliente: null,
        tipo_usuario: 'sistema',
        baja_logica: false
      },
      {
        from: 'Diego Morales',
        status: 'en_espera',
        id_cliente: 5, // Usuario existente
        tipo_usuario: 'cliente',
        baja_logica: false
      }
    ];

    await queryInterface.bulkInsert('conversaciones', conversaciones.map(conversacion => ({
      ...conversacion,
      created_at: new Date(),
      updated_at: new Date()
    })));
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('conversaciones', null, {});
  }
};
