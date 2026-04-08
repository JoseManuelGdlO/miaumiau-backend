'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('clientes', 'password_hash', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    await queryInterface.addColumn('clientes', 'must_change_password', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('clientes', 'must_change_password');
    await queryInterface.removeColumn('clientes', 'password_hash');
  }
};
