'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('repartidor_push_tokens', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      fkid_repartidor: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'repartidores',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      token: {
        type: Sequelize.STRING(512),
        allowNull: false,
        unique: true,
      },
      plataforma: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'android',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
    await queryInterface.addIndex('repartidor_push_tokens', ['fkid_repartidor']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('repartidor_push_tokens');
  },
};
