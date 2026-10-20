'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('jornadas_repartidor', 'cerrado_por_usuario_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('jornadas_repartidor', 'cerrado_por_nombre', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('jornadas_repartidor', 'cerrado_por_nombre');
    await queryInterface.removeColumn('jornadas_repartidor', 'cerrado_por_usuario_id');
  },
};
