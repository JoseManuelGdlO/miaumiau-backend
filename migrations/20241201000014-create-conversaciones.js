'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('conversaciones', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      from: {
        type: Sequelize.STRING(100),
        allowNull: false,
        validate: {
          len: [2, 100],
          notEmpty: true
        }
      },
      status: {
        type: Sequelize.ENUM('activa', 'pausada', 'cerrada', 'en_espera'),
        allowNull: false,
        defaultValue: 'activa'
      },
      id_cliente: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'clientes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      id_pedido: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'pedidos',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      tipo_usuario: {
        type: Sequelize.ENUM('cliente', 'agente', 'bot', 'sistema'),
        allowNull: false,
        defaultValue: 'cliente'
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
    await queryInterface.addIndex('conversaciones', ['status'], { name: 'idx_conversaciones_status' });
    await queryInterface.addIndex('conversaciones', ['id_cliente'], { name: 'idx_conversaciones_cliente' });
    await queryInterface.addIndex('conversaciones', ['id_pedido'], { name: 'idx_conversaciones_pedido' });
    await queryInterface.addIndex('conversaciones', ['baja_logica'], { name: 'idx_conversaciones_baja_logica' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('conversaciones');
  }
};
