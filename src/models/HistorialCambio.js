module.exports = (sequelize, DataTypes) => {
  const HistorialCambio = sequelize.define('HistorialCambio', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fkid_usuario: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    accion: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    entidad: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    entidad_id: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    detalle: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  }, {
    tableName: 'historial_cambios',
    underscored: true,
  });

  return HistorialCambio;
};
