'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inventarios', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombre: {
        type: Sequelize.STRING(200),
        allowNull: false,
        validate: {
          len: [2, 200],
          notEmpty: true
        }
      },
      sku: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
          len: [3, 50],
          notEmpty: true
        }
      },
      fkid_peso: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'pesos',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      fkid_categoria: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'categorias_producto',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
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
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true,
        validate: {
          len: [0, 1000]
        }
      },
      stock_inicial: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0
        }
      },
      stock_minimo: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0
        }
      },
      stock_maximo: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1000,
        validate: {
          min: 1
        }
      },
      costo_unitario: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        validate: {
          min: 0
        }
      },
      precio_venta: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        validate: {
          min: 0
        }
      },
      fkid_proveedor: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'proveedores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
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
    await queryInterface.addIndex('inventarios', ['fkid_ciudad'], { name: 'idx_inventarios_ciudad' });
    await queryInterface.addIndex('inventarios', ['baja_logica'], { name: 'idx_inventarios_baja_logica' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('inventarios');
  }
};
