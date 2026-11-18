'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const inventarios = await queryInterface.describeTable('inventarios');
    if (!inventarios.precio_distribuidor) {
      await queryInterface.addColumn('inventarios', 'precio_distribuidor', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      });
    }
    if (!inventarios.umbral_mayoreo) {
      await queryInterface.addColumn('inventarios', 'umbral_mayoreo', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
    if (!inventarios.descuento_proveedor_pct) {
      await queryInterface.addColumn('inventarios', 'descuento_proveedor_pct', {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      });
    }

    const clientes = await queryInterface.describeTable('clientes');
    if (!clientes.tipo_cuenta) {
      await queryInterface.addColumn('clientes', 'tipo_cuenta', {
        type: Sequelize.ENUM('general', 'veterinaria', 'distribuidor'),
        allowNull: false,
        defaultValue: 'general',
      });
      if (clientes.es_distribuidor) {
        await queryInterface.sequelize.query(
          "UPDATE clientes SET tipo_cuenta = 'distribuidor' WHERE es_distribuidor = 1"
        );
      }
    }
  },

  async down(queryInterface) {
    const inventarios = await queryInterface.describeTable('inventarios');
    if (inventarios.precio_distribuidor) await queryInterface.removeColumn('inventarios', 'precio_distribuidor');
    if (inventarios.umbral_mayoreo) await queryInterface.removeColumn('inventarios', 'umbral_mayoreo');
    if (inventarios.descuento_proveedor_pct) await queryInterface.removeColumn('inventarios', 'descuento_proveedor_pct');

    const clientes = await queryInterface.describeTable('clientes');
    if (clientes.tipo_cuenta) await queryInterface.removeColumn('clientes', 'tipo_cuenta');
  },
};
