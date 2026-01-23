'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar campo max_pedidos_por_horario
    await queryInterface.addColumn('cities', 'max_pedidos_por_horario', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 5,
      comment: 'Máximo número de pedidos por horario de entrega (mañana o tarde)'
    });

    // Agregar campo dias_trabajo (JSON para almacenar array de días)
    await queryInterface.addColumn('cities', 'dias_trabajo', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: JSON.stringify([0, 1, 2, 3, 4, 5, 6]), // Todos los días por defecto
      comment: 'Array de días de la semana que trabajan entregas (0=domingo, 6=sábado)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('cities', 'max_pedidos_por_horario');
    await queryInterface.removeColumn('cities', 'dias_trabajo');
  }
};
