'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('agentes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombre: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Nombre del agente'
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Descripción detallada del agente'
      },
      especialidad: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Área de especialización del agente'
      },
      contexto: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Contexto específico del agente'
      },
      system_prompt: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Prompt del sistema que define el comportamiento'
      },
      personalidad: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Características de personalidad en formato JSON'
      },
      configuracion: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Configuraciones específicas en formato JSON'
      },
      estado: {
        type: Sequelize.ENUM('activo', 'inactivo', 'mantenimiento'),
        allowNull: false,
        defaultValue: 'activo',
        comment: 'Estado del agente'
      },
      orden_prioridad: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Orden de prioridad para selección automática'
      },
      fecha_creacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'Fecha de creación del agente'
      },
      fecha_actualizacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'Última actualización del contexto'
      },
      baja_logica: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Indica si el agente está eliminado lógicamente'
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
    await queryInterface.addIndex('agentes', ['estado']);
    await queryInterface.addIndex('agentes', ['orden_prioridad']);
    await queryInterface.addIndex('agentes', ['baja_logica']);
    await queryInterface.addIndex('agentes', ['estado', 'orden_prioridad']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('agentes');
  }
};
