module.exports = (sequelize, DataTypes) => {
  const CampanaEnvio = sequelize.define('CampanaEnvio', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fkid_cliente: { type: DataTypes.INTEGER, allowNull: false },
    plantilla: { type: DataTypes.STRING(80), allowNull: false },
    enviado_en: { type: DataTypes.DATE, allowNull: false },
  }, {
    tableName: 'campana_envios',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });
  return CampanaEnvio;
};
