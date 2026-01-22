'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('conversaciones', 'whatsapp_phone_number_id', {
      type: Sequelize.STRING(64),
      allowNull: true
    });

    await queryInterface.addIndex('conversaciones', ['whatsapp_phone_number_id'], {
      name: 'idx_conversaciones_whatsapp_phone_number_id'
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('conversaciones', 'idx_conversaciones_whatsapp_phone_number_id');
    } catch (e) {}
    await queryInterface.removeColumn('conversaciones', 'whatsapp_phone_number_id');
  }
};
