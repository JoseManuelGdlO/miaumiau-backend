'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('repartidores', 'contrasena', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Contraseña del repartidor para acceso desde su teléfono'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('repartidores', 'contrasena');
  }
};

