'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('contactos_soporte', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      fkid_usuario: { type: Sequelize.INTEGER, allowNull: false, unique: true },
      telefono: { type: Sequelize.STRING(20), allowNull: false },
      repartidores: { type: Sequelize.JSON, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('contactos_soporte');
  },
};
