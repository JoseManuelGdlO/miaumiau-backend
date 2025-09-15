'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('proveedores', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombre: {
        type: Sequelize.STRING(150),
        allowNull: false,
        validate: {
          len: [2, 150],
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
      correo: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
          notEmpty: true
        }
      },
      telefono: {
        type: Sequelize.STRING(20),
        allowNull: false,
        validate: {
          len: [7, 20],
          notEmpty: true
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
    await queryInterface.addIndex('proveedores', ['baja_logica'], { name: 'idx_proveedores_baja_logica' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('proveedores');
  }
};
