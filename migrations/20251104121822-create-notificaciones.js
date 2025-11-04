'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notificaciones', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombre: {
        type: Sequelize.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 255]
        }
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      prioridad: {
        type: Sequelize.ENUM('baja', 'media', 'alta', 'urgente'),
        allowNull: false,
        defaultValue: 'media'
      },
      leida: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      fecha_creacion: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      hora_creacion: {
        type: Sequelize.TIME,
        allowNull: false
      },
      datos: {
        type: Sequelize.JSON,
        allowNull: true
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
    await queryInterface.addIndex('notificaciones', ['prioridad'], { name: 'idx_notificaciones_prioridad' });
    await queryInterface.addIndex('notificaciones', ['leida'], { name: 'idx_notificaciones_leida' });
    await queryInterface.addIndex('notificaciones', ['fecha_creacion'], { name: 'idx_notificaciones_fecha_creacion' });
    await queryInterface.addIndex('notificaciones', ['created_at'], { name: 'idx_notificaciones_created_at' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('notificaciones');
  }
};

