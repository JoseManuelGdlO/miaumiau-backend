'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('cities', 'horario_por_dia', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Horario de entregas por día de la semana: claves "0"-"6", valores { inicio, fin } (0-23)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('cities', 'horario_por_dia');
  }
};
