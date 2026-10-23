'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pedidos', 'horario_preferente', {
      type: Sequelize.TIME,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pedidos', 'horario_preferente');
  },
};
