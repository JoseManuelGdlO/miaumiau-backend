'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('promotion_usages', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      promotion_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'promotions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      telefono: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Teléfono del usuario que usa el código'
      },
      fkid_cliente: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'clientes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'ID del cliente si existe (opcional)'
      },
      fkid_pedido: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'pedidos',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'ID del pedido donde se aplicó el código'
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
    await queryInterface.addIndex('promotion_usages', ['promotion_id'], { 
      name: 'idx_promotion_usages_promotion_id' 
    });
    
    await queryInterface.addIndex('promotion_usages', ['telefono'], { 
      name: 'idx_promotion_usages_telefono' 
    });
    
    // Índice compuesto para consultas rápidas de uso por código y teléfono
    await queryInterface.addIndex('promotion_usages', ['promotion_id', 'telefono'], {
      name: 'idx_promotion_usages_promotion_telefono'
    });
    
    await queryInterface.addIndex('promotion_usages', ['fkid_pedido'], { 
      name: 'idx_promotion_usages_pedido' 
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('promotion_usages');
  }
};
