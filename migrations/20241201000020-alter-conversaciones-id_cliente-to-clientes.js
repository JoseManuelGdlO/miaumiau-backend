'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Eliminar FK existente hacia users si existe
    try {
      await queryInterface.removeConstraint('conversaciones', 'conversaciones_id_cliente_users_fk');
    } catch (e) {
      // ignorar si no existe
    }

    // También intentar por nombre generado por Sequelize en MySQL
    try {
      await queryInterface.removeConstraint('conversaciones', 'conversaciones_ibfk_1');
    } catch (e) {
      // ignorar si no existe
    }

    // Agregar nueva FK hacia clientes
    await queryInterface.addConstraint('conversaciones', {
      fields: ['id_cliente'],
      type: 'foreign key',
      name: 'conversaciones_id_cliente_clientes_fk',
      references: {
        table: 'clientes',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  async down(queryInterface, Sequelize) {
    // Revertir a FK hacia users
    try {
      await queryInterface.removeConstraint('conversaciones', 'conversaciones_id_cliente_clientes_fk');
    } catch (e) {}

    await queryInterface.addConstraint('conversaciones', {
      fields: ['id_cliente'],
      type: 'foreign key',
      name: 'conversaciones_id_cliente_users_fk',
      references: {
        table: 'users',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  }
};


