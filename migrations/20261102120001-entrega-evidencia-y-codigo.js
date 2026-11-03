'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pedidos', 'codigo_consentido_en', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('pedidos', 'fecha_propuesta', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('rutas_pedidos', 'entrega_dejar_en', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('rutas_pedidos', 'receptor_nombre', {
      type: Sequelize.STRING(120),
      allowNull: true,
    });
    await queryInterface.addColumn('rutas_pedidos', 'dejar_lugar', {
      type: Sequelize.STRING(200),
      allowNull: true,
    });
    await queryInterface.addColumn('rutas_pedidos', 'evidencia_path', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('rutas_pedidos', 'evidencia_path');
    await queryInterface.removeColumn('rutas_pedidos', 'dejar_lugar');
    await queryInterface.removeColumn('rutas_pedidos', 'receptor_nombre');
    await queryInterface.removeColumn('rutas_pedidos', 'entrega_dejar_en');
    await queryInterface.removeColumn('pedidos', 'fecha_propuesta');
    await queryInterface.removeColumn('pedidos', 'codigo_consentido_en');
  },
};
