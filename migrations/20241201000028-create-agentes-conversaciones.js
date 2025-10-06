'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('agentes_conversaciones', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fkid_agente: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'agentes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'ID del agente asignado'
      },
      fkid_conversacion: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'conversaciones',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'ID de la conversación'
      },
      fecha_asignacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'Fecha y hora de asignación del agente'
      },
      rendimiento: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 0.00,
        validate: {
          min: 0,
          max: 5
        },
        comment: 'Calificación de rendimiento (0-5)'
      },
      feedback: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Feedback sobre el rendimiento del agente'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Agregar índices
    await queryInterface.addIndex('agentes_conversaciones', ['fkid_agente']);
    await queryInterface.addIndex('agentes_conversaciones', ['fkid_conversacion']);
    await queryInterface.addIndex('agentes_conversaciones', ['fecha_asignacion']);
    await queryInterface.addIndex('agentes_conversaciones', ['rendimiento']);

    // Agregar constraint único para evitar duplicados
    await queryInterface.addConstraint('agentes_conversaciones', {
      fields: ['fkid_agente', 'fkid_conversacion'],
      type: 'unique',
      name: 'unique_agente_conversacion'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('agentes_conversaciones');
  }
};
