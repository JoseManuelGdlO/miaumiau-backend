'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('repartidores', 'licencia_vigencia', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });
    await queryInterface.addColumn('repartidores', 'licencia_foto', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    await queryInterface.addColumn('repartidores', 'seguro_social', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
    await queryInterface.addColumn('repartidores', 'tipo_sangre', {
      type: Sequelize.STRING(3),
      allowNull: true
    });
    await queryInterface.addColumn('repartidores', 'consentimiento_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('repartidores', 'consentimiento_archivo', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('repartidores', 'consentimiento_archivo');
    await queryInterface.removeColumn('repartidores', 'consentimiento_at');
    await queryInterface.removeColumn('repartidores', 'tipo_sangre');
    await queryInterface.removeColumn('repartidores', 'seguro_social');
    await queryInterface.removeColumn('repartidores', 'licencia_foto');
    await queryInterface.removeColumn('repartidores', 'licencia_vigencia');
  }
};
