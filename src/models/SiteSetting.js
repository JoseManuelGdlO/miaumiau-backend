module.exports = (sequelize, DataTypes) => {
  const SiteSetting = sequelize.define(
    'SiteSetting',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      clave: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      valor: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      tableName: 'site_settings',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return SiteSetting;
};
