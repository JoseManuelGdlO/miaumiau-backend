module.exports = (sequelize, DataTypes) => {
  const LecturaKilometraje = sequelize.define('LecturaKilometraje', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fkid_repartidor: { type: DataTypes.INTEGER, allowNull: false },
    fkid_jornada: { type: DataTypes.INTEGER, allowNull: true },
    kilometros: { type: DataTypes.DECIMAL(10, 1), allowNull: false },
    lat: { type: DataTypes.DECIMAL(10, 8), allowNull: true },
    lng: { type: DataTypes.DECIMAL(11, 8), allowNull: true },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
  }, {
    tableName: 'lecturas_kilometraje',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });
  return LecturaKilometraje;
};
