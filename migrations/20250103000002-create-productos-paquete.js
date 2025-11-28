'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('productos_paquete', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fkid_paquete: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'paquetes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      fkid_producto: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'inventarios',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      cantidad: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 9999
        }
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
    await queryInterface.addIndex('productos_paquete', ['fkid_paquete'], { name: 'idx_productos_paquete_paquete' });
    await queryInterface.addIndex('productos_paquete', ['fkid_producto'], { name: 'idx_productos_paquete_producto' });
    await queryInterface.addIndex('productos_paquete', ['cantidad'], { name: 'idx_productos_paquete_cantidad' });
    
    // Índice único compuesto para evitar duplicados
    await queryInterface.addIndex('productos_paquete', ['fkid_paquete', 'fkid_producto'], {
      unique: true,
      name: 'idx_productos_paquete_unique'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('productos_paquete');
  }
};

