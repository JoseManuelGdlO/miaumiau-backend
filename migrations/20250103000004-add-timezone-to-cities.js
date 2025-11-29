'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('cities', 'timezone', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: 'America/Mexico_City',
      comment: 'Zona horaria de la ciudad (formato IANA, ej: America/Mexico_City, America/Bogota)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('cities', 'timezone');
  }
};

