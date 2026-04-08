'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('site_settings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      clave: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      valor: {
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.bulkInsert('site_settings', [
      {
        clave: 'hero_youtube_video_id',
        valor: 'h3u-4RAwZSA',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('site_settings');
  },
};
