'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const clientes = await queryInterface.describeTable('clientes');
    if (!clientes.es_distribuidor) {
      await queryInterface.addColumn('clientes', 'es_distribuidor', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    const promotions = await queryInterface.describeTable('promotions');
    if (!promotions.aplica_a) {
      await queryInterface.addColumn('promotions', 'aplica_a', {
        type: Sequelize.ENUM('todos', 'retail', 'distribuidor'),
        allowNull: false,
        defaultValue: 'todos',
      });
    }
  },

  async down(queryInterface) {
    const clientes = await queryInterface.describeTable('clientes');
    if (clientes.es_distribuidor) await queryInterface.removeColumn('clientes', 'es_distribuidor');
    const promotions = await queryInterface.describeTable('promotions');
    if (promotions.aplica_a) await queryInterface.removeColumn('promotions', 'aplica_a');
  },
};
