'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('clientes', 'es_distribuidor', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('promotions', 'aplica_a', {
      type: Sequelize.ENUM('todos', 'retail', 'distribuidor'),
      allowNull: false,
      defaultValue: 'todos',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('clientes', 'es_distribuidor');
    await queryInterface.removeColumn('promotions', 'aplica_a');
  },
};
