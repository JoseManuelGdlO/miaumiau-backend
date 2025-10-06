'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar columna id_pedido nullable
    await queryInterface.addColumn('conversaciones', 'id_pedido', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    // Agregar FK a pedidos
    await queryInterface.addConstraint('conversaciones', {
      fields: ['id_pedido'],
      type: 'foreign key',
      name: 'conversaciones_id_pedido_pedidos_fk',
      references: {
        table: 'pedidos',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Índice para consultas
    await queryInterface.addIndex('conversaciones', ['id_pedido'], { name: 'idx_conversaciones_pedido' });
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeConstraint('conversaciones', 'conversaciones_id_pedido_pedidos_fk');
    } catch (e) {}
    try {
      await queryInterface.removeIndex('conversaciones', 'idx_conversaciones_pedido');
    } catch (e) {}
    await queryInterface.removeColumn('conversaciones', 'id_pedido');
  }
};


