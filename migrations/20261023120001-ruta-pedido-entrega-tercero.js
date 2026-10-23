'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('rutas_pedidos', 'entrega_tercero_en', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('rutas_pedidos', 'entrega_tercero_en');
  },
};
