'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('rutas_pedidos', 'aviso_siguiente_en', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.createTable('campana_envios', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      fkid_cliente: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'clientes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      plantilla: { type: Sequelize.STRING(80), allowNull: false },
      enviado_en: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('campana_envios', ['fkid_cliente', 'plantilla'], {
      name: 'campana_envios_cliente_plantilla',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('campana_envios');
    await queryInterface.removeColumn('rutas_pedidos', 'aviso_siguiente_en');
  },
};
