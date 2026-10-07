'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pedidos', 'codigo_entrega', {
      type: Sequelize.STRING(6),
      allowNull: true
    });

    await queryInterface.addColumn('rutas_pedidos', 'llego_en', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('rutas_pedidos', 'codigo_validado_en', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.createTable('jornadas_repartidor', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fkid_repartidor: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'repartidores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      fecha: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      estado: {
        type: Sequelize.ENUM('borrador', 'esperando_call_center', 'validada', 'cerrada'),
        allowNull: false,
        defaultValue: 'borrador'
      },
      fkid_notificacion: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'notificaciones', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      efectivo_a_depositar: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      comprobante_deposito_path: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      cerrada_en: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('jornadas_repartidor', ['fkid_repartidor', 'fecha'], {
      unique: true,
      name: 'unique_jornada_repartidor_fecha'
    });

    await queryInterface.createTable('jornada_cargas', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fkid_jornada: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'jornadas_repartidor', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      nombre: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      fkid_producto: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inventarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      cantidad: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      precio_unitario: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      es_extra: {
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

    await queryInterface.createTable('cobros_entrega', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fkid_pedido: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'pedidos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      fkid_repartidor: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'repartidores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      metodo: {
        type: Sequelize.ENUM('efectivo', 'transferencia', 'mixto'),
        allowNull: false
      },
      monto_efectivo: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      monto_transferencia: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      comprobante_path: {
        type: Sequelize.STRING(255),
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

    await queryInterface.createTable('repartidor_puntos_movimientos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fkid_repartidor: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'repartidores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      puntos: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      saldo_posterior: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      fkid_pedido: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'pedidos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.createTable('repartidor_logros', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fkid_repartidor: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'repartidores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      codigo: {
        type: Sequelize.STRING(40),
        allowNull: false
      },
      desbloqueado_en: {
        type: Sequelize.DATE,
        allowNull: false
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

    await queryInterface.addIndex('repartidor_logros', ['fkid_repartidor', 'codigo'], {
      unique: true,
      name: 'unique_repartidor_logro'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('repartidor_logros');
    await queryInterface.dropTable('repartidor_puntos_movimientos');
    await queryInterface.dropTable('cobros_entrega');
    await queryInterface.dropTable('jornada_cargas');
    await queryInterface.dropTable('jornadas_repartidor');
    await queryInterface.removeColumn('rutas_pedidos', 'codigo_validado_en');
    await queryInterface.removeColumn('rutas_pedidos', 'llego_en');
    await queryInterface.removeColumn('pedidos', 'codigo_entrega');
  }
};
