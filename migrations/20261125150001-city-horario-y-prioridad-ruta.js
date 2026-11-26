'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('cities', 'entregas_por_horario', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.addColumn('cities', 'prioridad_ruta', {
      type: Sequelize.STRING(12),
      allowNull: false,
      defaultValue: 'hora',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('cities', 'prioridad_ruta');
    await queryInterface.removeColumn('cities', 'entregas_por_horario');
  },
};
