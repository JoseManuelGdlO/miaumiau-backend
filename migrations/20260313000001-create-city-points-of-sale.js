'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('city_points_of_sale', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      city_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'cities',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      nombre: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      direccion: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      telefono: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      encargado: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      baja_logica: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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

    await queryInterface.addIndex('city_points_of_sale', ['city_id'], {
      name: 'idx_city_points_of_sale_city_id',
    });

    await queryInterface.addIndex('city_points_of_sale', ['baja_logica'], {
      name: 'idx_city_points_of_sale_baja_logica',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('city_points_of_sale');
  },
};

