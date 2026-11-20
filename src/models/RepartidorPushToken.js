module.exports = (sequelize, DataTypes) => {
  const RepartidorPushToken = sequelize.define('RepartidorPushToken', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fkid_repartidor: { type: DataTypes.INTEGER, allowNull: false },
    token: { type: DataTypes.STRING(512), allowNull: false, unique: true },
    plataforma: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'android' },
  }, {
    tableName: 'repartidor_push_tokens',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });
  return RepartidorPushToken;
};
