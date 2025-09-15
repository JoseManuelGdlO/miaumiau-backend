'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pedidos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fkid_cliente: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      telefono_referencia: {
        type: Sequelize.STRING(20),
        allowNull: true,
        validate: {
          len: [7, 20],
          is: /^[\+]?[0-9\s\-\(\)]+$/
        }
      },
      email_referencia: {
        type: Sequelize.STRING(255),
        allowNull: true,
        validate: {
          isEmail: true,
          len: [5, 255]
        }
      },
      direccion_entrega: {
        type: Sequelize.TEXT,
        allowNull: false,
        validate: {
          len: [10, 500],
          notEmpty: true
        }
      },
      fkid_ciudad: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'cities',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      numero_pedido: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
          len: [5, 50],
          notEmpty: true
        }
      },
      estado: {
        type: Sequelize.ENUM('pendiente', 'confirmado', 'en_preparacion', 'en_camino', 'entregado', 'cancelado'),
        allowNull: false,
        defaultValue: 'pendiente'
      },
      fecha_pedido: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      fecha_entrega_estimada: {
        type: Sequelize.DATE,
        allowNull: true
      },
      fecha_entrega_real: {
        type: Sequelize.DATE,
        allowNull: true
      },
      subtotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        validate: {
          min: 0
        }
      },
      impuestos: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        validate: {
          min: 0
        }
      },
      descuento: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        validate: {
          min: 0
        }
      },
      total: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        validate: {
          min: 0
        }
      },
      metodo_pago: {
        type: Sequelize.ENUM('efectivo', 'tarjeta', 'transferencia', 'pago_movil'),
        allowNull: true
      },
      notas: {
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
    await queryInterface.addIndex('pedidos', ['fkid_cliente'], { name: 'idx_pedidos_cliente' });
    await queryInterface.addIndex('pedidos', ['fkid_ciudad'], { name: 'idx_pedidos_ciudad' });
    await queryInterface.addIndex('pedidos', ['estado'], { name: 'idx_pedidos_estado' });
    await queryInterface.addIndex('pedidos', ['fecha_pedido'], { name: 'idx_pedidos_fecha_pedido' });
    await queryInterface.addIndex('pedidos', ['baja_logica'], { name: 'idx_pedidos_baja_logica' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('pedidos');
  }
};
