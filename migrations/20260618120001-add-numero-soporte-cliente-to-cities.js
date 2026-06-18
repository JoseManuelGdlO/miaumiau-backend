'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('cities', 'numero_soporte_cliente', {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: '6181892035',
      comment: 'Número de teléfono de soporte al cliente para la ciudad'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('cities', 'numero_soporte_cliente');
  }
};
