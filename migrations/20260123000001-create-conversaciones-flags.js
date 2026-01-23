'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('conversaciones_flags', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombre: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      color: {
        type: Sequelize.STRING(7),
        allowNull: false,
        defaultValue: '#3B82F6'
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      activo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
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
    await queryInterface.addIndex('conversaciones_flags', ['nombre'], { name: 'idx_conversaciones_flags_nombre' });
    await queryInterface.addIndex('conversaciones_flags', ['activo'], { name: 'idx_conversaciones_flags_activo' });
    await queryInterface.addIndex('conversaciones_flags', ['baja_logica'], { name: 'idx_conversaciones_flags_baja_logica' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('conversaciones_flags');
  }
};
