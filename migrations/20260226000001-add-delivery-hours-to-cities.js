'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar campo hora_inicio_entrega (hora del día en formato 0-23)
    await queryInterface.addColumn('cities', 'hora_inicio_entrega', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Hora de inicio del turno de entregas (0-23)'
    });

    // Agregar campo hora_fin_entrega (hora del día en formato 0-23)
    await queryInterface.addColumn('cities', 'hora_fin_entrega', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Hora de fin del turno de entregas (0-23)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('cities', 'hora_inicio_entrega');
    await queryInterface.removeColumn('cities', 'hora_fin_entrega');
  }
};

