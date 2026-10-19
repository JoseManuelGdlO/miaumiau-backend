module.exports = (sequelize, DataTypes) => {
  const InventarioVehiculo = sequelize.define(
    'InventarioVehiculo',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      fkid_repartidor: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'repartidores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      fkid_producto: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'inventarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      nombre: { type: DataTypes.STRING(150), allowNull: false },
      cantidad: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'inventario_vehiculo',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [{ unique: true, fields: ['fkid_repartidor', 'nombre'] }],
    }
  );
  return InventarioVehiculo;
};
