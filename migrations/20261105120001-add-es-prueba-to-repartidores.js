'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('repartidores', 'es_prueba', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.sequelize.query(
      "UPDATE repartidores SET es_prueba = true WHERE nombre_completo LIKE 'TEST%'"
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('repartidores', 'es_prueba');
  },
};
