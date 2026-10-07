module.exports = (sequelize, DataTypes) => {
  const RepartidorPuntosMovimiento = sequelize.define(
    'RepartidorPuntosMovimiento',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      fkid_repartidor: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'repartidores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      puntos: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      saldo_posterior: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      fkid_pedido: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'pedidos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      }
    },
    {
      tableName: 'repartidor_puntos_movimientos',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false
    }
  );

  return RepartidorPuntosMovimiento;
};
