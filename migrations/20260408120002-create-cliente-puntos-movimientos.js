'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cliente_puntos_movimientos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fkid_cliente: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'clientes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      tipo: {
        type: Sequelize.ENUM('ganado', 'gastado', 'ajuste'),
        allowNull: false
      },
      puntos: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: { min: 1 }
      },
      saldo_despues: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      referencia: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('cliente_puntos_movimientos', ['fkid_cliente']);
    await queryInterface.addIndex('cliente_puntos_movimientos', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('cliente_puntos_movimientos');
  }
};
