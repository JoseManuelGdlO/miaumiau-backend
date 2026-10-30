'use strict';

const { backfillProfiles } = require('../src/services/cityWhatsappService');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('city_whatsapp_profiles', {
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
      invite_token_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      invite_token_encrypted: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      invite_expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      invite_used_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      waba_id: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      phone_number_id: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      business_id: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      display_phone: {
        type: Sequelize.STRING(32),
        allowNull: true,
      },
      access_token_encrypted: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      coexistence_enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      coexistence_sync_error: {
        type: Sequelize.TEXT,
        allowNull: true,
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

    await queryInterface.addIndex('city_whatsapp_profiles', ['city_id'], {
      name: 'idx_city_whatsapp_profiles_city_id',
      unique: true,
    });
    await queryInterface.addIndex('city_whatsapp_profiles', ['invite_token_hash'], {
      name: 'idx_city_whatsapp_profiles_invite_token_hash',
      unique: true,
    });
    await queryInterface.addIndex('city_whatsapp_profiles', ['phone_number_id'], {
      name: 'idx_city_whatsapp_profiles_phone_number_id',
      unique: true,
    });

    if (!String(process.env.CREDENTIALS_ENCRYPTION_KEY || '').trim()) {
      throw new Error('Falta CREDENTIALS_ENCRYPTION_KEY');
    }
    const [cities] = await queryInterface.sequelize.query('SELECT id FROM cities');
    const rows = backfillProfiles({
      cityIds: cities.map((row) => row.id),
      existingCityIds: [],
      now: Date.now(),
    });
    if (rows.length) await queryInterface.bulkInsert('city_whatsapp_profiles', rows);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('city_whatsapp_profiles');
  },
};
