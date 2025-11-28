'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('paquetes_pedido', {
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
      fkid_paquete: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'paquetes',
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
      descuento_paquete: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.00,
        validate: {
          min: 0,
          max: 100
        }
      },
      notas_paquete: {
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
    await queryInterface.addIndex('paquetes_pedido', ['fkid_pedido'], { name: 'idx_paquetes_pedido_pedido' });
    await queryInterface.addIndex('paquetes_pedido', ['fkid_paquete'], { name: 'idx_paquetes_pedido_paquete' });
    await queryInterface.addIndex('paquetes_pedido', ['cantidad'], { name: 'idx_paquetes_pedido_cantidad' });
    await queryInterface.addIndex('paquetes_pedido', ['precio_total'], { name: 'idx_paquetes_pedido_precio_total' });
    await queryInterface.addIndex('paquetes_pedido', ['baja_logica'], { name: 'idx_paquetes_pedido_baja_logica' });
    
    // Índice único compuesto para evitar duplicados
    await queryInterface.addIndex('paquetes_pedido', ['fkid_pedido', 'fkid_paquete'], {
      unique: true,
      name: 'idx_paquetes_pedido_unique'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('paquetes_pedido');
  }
};

