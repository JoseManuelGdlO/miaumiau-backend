'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pedidos', 'stripe_link_url', {
      type: Sequelize.STRING(2048),
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pedidos', 'stripe_link_url');
  }
};
