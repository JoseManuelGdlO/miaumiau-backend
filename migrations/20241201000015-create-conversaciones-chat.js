'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('conversaciones_chat', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fkid_conversacion: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'conversaciones',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      fecha: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      hora: {
        type: Sequelize.TIME,
        allowNull: false
      },
      from: {
        type: Sequelize.ENUM('usuario', 'bot', 'agente', 'sistema'),
        allowNull: false,
        defaultValue: 'usuario'
      },
      mensaje: {
        type: Sequelize.TEXT,
        allowNull: false,
        validate: {
          len: [1, 5000],
          notEmpty: true
        }
      },
      tipo_mensaje: {
        type: Sequelize.ENUM('texto', 'imagen', 'archivo', 'audio', 'video', 'ubicacion', 'contacto'),
        allowNull: false,
        defaultValue: 'texto'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Información adicional del mensaje (URLs, tamaños, etc.)'
      },
      leido: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      baja_logica: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Crear índices esenciales
    await queryInterface.addIndex('conversaciones_chat', ['fkid_conversacion'], { name: 'idx_conversaciones_chat_conversacion' });
    await queryInterface.addIndex('conversaciones_chat', ['leido'], { name: 'idx_conversaciones_chat_leido' });
    await queryInterface.addIndex('conversaciones_chat', ['baja_logica'], { name: 'idx_conversaciones_chat_baja_logica' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('conversaciones_chat');
  }
};
