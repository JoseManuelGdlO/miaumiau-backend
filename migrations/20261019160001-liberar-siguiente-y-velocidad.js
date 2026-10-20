'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('rutas_pedidos', 'liberado_en', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.createTable('lecturas_velocidad', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      fkid_repartidor: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'repartidores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      fkid_jornada: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'jornadas_repartidor', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      velocidad_kmh: { type: Sequelize.DECIMAL(6, 1), allowNull: false },
      lat: { type: Sequelize.DECIMAL(10, 8), allowNull: true },
      lng: { type: Sequelize.DECIMAL(11, 8), allowNull: true },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lecturas_velocidad');
    await queryInterface.removeColumn('rutas_pedidos', 'liberado_en');
  },
};
