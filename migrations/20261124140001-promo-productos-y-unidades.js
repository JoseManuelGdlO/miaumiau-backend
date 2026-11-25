'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const promotions = await queryInterface.describeTable('promotions');
    if (!promotions.unidades_minimas) {
      await queryInterface.addColumn('promotions', 'unidades_minimas', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
    if (!promotions.productos_ids) {
      await queryInterface.addColumn('promotions', 'productos_ids', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const promotions = await queryInterface.describeTable('promotions');
    if (promotions.unidades_minimas) await queryInterface.removeColumn('promotions', 'unidades_minimas');
    if (promotions.productos_ids) await queryInterface.removeColumn('promotions', 'productos_ids');
  },
};
