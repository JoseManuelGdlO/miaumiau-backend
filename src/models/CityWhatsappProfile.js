module.exports = (sequelize, DataTypes) => {
  const CityWhatsappProfile = sequelize.define('CityWhatsappProfile', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    city_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    invite_token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    invite_token_encrypted: { type: DataTypes.TEXT, allowNull: false },
    invite_expires_at: { type: DataTypes.DATE, allowNull: false },
    invite_used_at: { type: DataTypes.DATE, allowNull: true },
    waba_id: { type: DataTypes.STRING(64), allowNull: true },
    phone_number_id: { type: DataTypes.STRING(64), allowNull: true, unique: true },
    business_id: { type: DataTypes.STRING(64), allowNull: true },
    display_phone: { type: DataTypes.STRING(32), allowNull: true },
    access_token_encrypted: { type: DataTypes.TEXT, allowNull: true },
    coexistence_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    coexistence_sync_error: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'city_whatsapp_profiles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
  });
  return CityWhatsappProfile;
};
