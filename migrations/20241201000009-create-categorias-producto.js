'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('categorias_producto', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombre: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
          len: [2, 100],
          notEmpty: true
        }
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
    await queryInterface.addIndex('categorias_producto', ['baja_logica'], { name: 'idx_categorias_producto_baja_logica' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('categorias_producto');
  }
};
