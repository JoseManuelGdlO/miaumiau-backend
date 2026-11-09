'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('clientes', 'lat', {
      type: Sequelize.DECIMAL(10, 8),
      allowNull: true,
    });
    await queryInterface.addColumn('clientes', 'lng', {
      type: Sequelize.DECIMAL(11, 8),
      allowNull: true,
    });
    await queryInterface.addColumn('clientes', 'direccion_geo', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.bulkInsert('site_settings', [{
      clave: 'maps_api_apagada',
      valor: 'false',
      created_at: new Date(),
      updated_at: new Date(),
    }]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('site_settings', { clave: 'maps_api_apagada' });
    await queryInterface.removeColumn('clientes', 'direccion_geo');
    await queryInterface.removeColumn('clientes', 'lng');
    await queryInterface.removeColumn('clientes', 'lat');
  },
};
