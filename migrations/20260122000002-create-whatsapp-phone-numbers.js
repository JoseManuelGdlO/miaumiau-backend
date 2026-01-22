'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('whatsapp_phone_numbers', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      phoneid: {
        type: Sequelize.STRING(64),
        allowNull: false
      },
      telefono: {
        type: Sequelize.STRING(32),
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    await queryInterface.addIndex('whatsapp_phone_numbers', ['telefono'], {
      name: 'idx_whatsapp_phone_numbers_telefono',
      unique: true
    });
    await queryInterface.addIndex('whatsapp_phone_numbers', ['phoneid'], {
      name: 'idx_whatsapp_phone_numbers_phoneid'
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('whatsapp_phone_numbers', 'idx_whatsapp_phone_numbers_telefono');
    } catch (e) {}
    try {
      await queryInterface.removeIndex('whatsapp_phone_numbers', 'idx_whatsapp_phone_numbers_phoneid');
    } catch (e) {}
    await queryInterface.dropTable('whatsapp_phone_numbers');
  }
};
