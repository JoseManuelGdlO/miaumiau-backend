module.exports = (sequelize, DataTypes) => {
  const MovimientoInventarioVehiculo = sequelize.define(
    'MovimientoInventarioVehiculo',
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
      tipo: {
        type: DataTypes.ENUM('carga', 'entrega', 'devolucion', 'ajuste'),
        allowNull: false,
      },
      cantidad: { type: DataTypes.INTEGER, allowNull: false },
      fkid_jornada: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'jornadas_repartidor', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      fkid_pedido: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'pedidos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
    },
    {
      tableName: 'movimientos_inventario_vehiculo',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );
  return MovimientoInventarioVehiculo;
};
