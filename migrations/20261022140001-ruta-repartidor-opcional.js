'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE rutas MODIFY fkid_repartidor INT NULL',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE rutas MODIFY fkid_repartidor INT NOT NULL',
    );
  },
};
