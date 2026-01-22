module.exports = (sequelize, DataTypes) => {
  const WhatsAppPhoneNumber = sequelize.define('WhatsAppPhoneNumber', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    phoneid: {
      type: DataTypes.STRING(64),
      allowNull: false,
      validate: {
        len: [5, 64]
      }
    },
    telefono: {
      type: DataTypes.STRING(32),
      allowNull: false,
      validate: {
        len: [5, 32]
      }
    }
  }, {
    tableName: 'whatsapp_phone_numbers',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        fields: ['telefono'],
        unique: true
      },
      {
        fields: ['phoneid']
      }
    ]
  });

  return WhatsAppPhoneNumber;
};
