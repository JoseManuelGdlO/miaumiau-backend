'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('conversaciones_logs', {
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
      data: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'Datos del log en formato JSON'
      },
      tipo_log: {
        type: Sequelize.ENUM('inicio', 'mensaje', 'transferencia', 'escalacion', 'cierre', 'error', 'sistema'),
        allowNull: false,
        defaultValue: 'sistema'
      },
      nivel: {
        type: Sequelize.ENUM('info', 'warning', 'error', 'debug'),
        allowNull: false,
        defaultValue: 'info'
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true,
        validate: {
          len: [0, 1000]
        }
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
    await queryInterface.addIndex('conversaciones_logs', ['fkid_conversacion'], { name: 'idx_conversaciones_logs_conversacion' });
    await queryInterface.addIndex('conversaciones_logs', ['tipo_log'], { name: 'idx_conversaciones_logs_tipo_log' });
    await queryInterface.addIndex('conversaciones_logs', ['baja_logica'], { name: 'idx_conversaciones_logs_baja_logica' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('conversaciones_logs');
  }
};
