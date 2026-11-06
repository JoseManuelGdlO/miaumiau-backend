'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('repartidores', 'lat_actual', {
      type: Sequelize.DECIMAL(10, 8),
      allowNull: true,
    });
    await queryInterface.addColumn('repartidores', 'lng_actual', {
      type: Sequelize.DECIMAL(11, 8),
      allowNull: true,
    });
    await queryInterface.addColumn('repartidores', 'ubicacion_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('rutas', 'polyline_encoded', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('rutas', 'polyline_hash', {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('rutas', 'polyline_hash');
    await queryInterface.removeColumn('rutas', 'polyline_encoded');
    await queryInterface.removeColumn('repartidores', 'ubicacion_at');
    await queryInterface.removeColumn('repartidores', 'lng_actual');
    await queryInterface.removeColumn('repartidores', 'lat_actual');
  },
};
