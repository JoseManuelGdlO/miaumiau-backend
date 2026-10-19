module.exports = (sequelize, DataTypes) => {
  const LecturaVelocidad = sequelize.define('LecturaVelocidad', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fkid_repartidor: { type: DataTypes.INTEGER, allowNull: false },
    fkid_jornada: { type: DataTypes.INTEGER, allowNull: true },
    velocidad_kmh: { type: DataTypes.DECIMAL(6, 1), allowNull: false },
    lat: { type: DataTypes.DECIMAL(10, 8), allowNull: true },
    lng: { type: DataTypes.DECIMAL(11, 8), allowNull: true },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
  }, {
    tableName: 'lecturas_velocidad',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });
  return LecturaVelocidad;
};
