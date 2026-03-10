'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('inventarios', 'compra_minima', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('inventarios', 'compra_minima');
  }
};
