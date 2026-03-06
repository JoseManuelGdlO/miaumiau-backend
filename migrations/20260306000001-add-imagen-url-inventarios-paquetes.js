'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('inventarios', 'imagen_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'URL pública de la imagen del producto (para catálogo Meta y UI)'
    });
    await queryInterface.addColumn('paquetes', 'imagen_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'URL pública de la imagen del combo/paquete (para catálogo Meta y UI)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('inventarios', 'imagen_url');
    await queryInterface.removeColumn('paquetes', 'imagen_url');
  }
};
