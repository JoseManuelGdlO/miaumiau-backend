'use strict';

const FLAG_EVIDENCIAS = 'ocultar_evidencias_fotograficas';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('configuraciones', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      identificador: {
        type: Sequelize.STRING(80),
        allowNull: false,
        unique: true,
      },
      nombre: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      activo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.bulkInsert('configuraciones', [{
      identificador: FLAG_EVIDENCIAS,
      nombre: 'Ocultar evidencias fotográficas',
      descripcion: 'Con la flag activa, el repartidor no ve ni necesita las fotos de odómetro y combustible. El check-in se envía sin la foto.',
      activo: true,
      created_at: new Date(),
      updated_at: new Date(),
    }]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('configuraciones');
  },
};
