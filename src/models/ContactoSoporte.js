module.exports = (sequelize, DataTypes) => {
  const ContactoSoporte = sequelize.define('ContactoSoporte', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fkid_usuario: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    telefono: { type: DataTypes.STRING(20), allowNull: false },
    repartidores: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  }, {
    tableName: 'contactos_soporte',
    underscored: true,
  });

  return ContactoSoporte;
};
