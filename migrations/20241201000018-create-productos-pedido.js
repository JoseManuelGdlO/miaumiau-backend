'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('productos_pedido', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fkid_pedido: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'pedidos',
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
      precio_unidad: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0.01
        }
      },
      precio_total: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0.01
        }
      },
      descuento_producto: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.00,
        validate: {
          min: 0,
          max: 100
        }
      },
      notas_producto: {
        type: Sequelize.TEXT,
        allowNull: true,
        validate: {
          len: [0, 500]
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
    await queryInterface.addIndex('productos_pedido', ['fkid_pedido'], { name: 'idx_productos_pedido_pedido' });
    await queryInterface.addIndex('productos_pedido', ['fkid_producto'], { name: 'idx_productos_pedido_producto' });
    await queryInterface.addIndex('productos_pedido', ['baja_logica'], { name: 'idx_productos_pedido_baja_logica' });

    // Crear índice compuesto para evitar duplicados
    await queryInterface.addIndex('productos_pedido', ['fkid_pedido', 'fkid_producto'], { 
      name: 'idx_productos_pedido_unique',
      unique: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('productos_pedido');
  }
};
