'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('historial_cambios', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      fkid_usuario: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      accion: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      entidad: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      entidad_id: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },
      detalle: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addIndex('historial_cambios', ['created_at']);
    await queryInterface.addIndex('historial_cambios', ['accion']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('historial_cambios');
  },
};
