'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pesos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      cantidad: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0.01
        }
      },
      unidad_medida: {
        type: Sequelize.STRING(20),
        allowNull: false,
        validate: {
          isIn: [['kg', 'g', 'lb', 'oz', 'ton']]
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
    await queryInterface.addIndex('pesos', ['baja_logica'], { name: 'idx_pesos_baja_logica' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('pesos');
  }
};
