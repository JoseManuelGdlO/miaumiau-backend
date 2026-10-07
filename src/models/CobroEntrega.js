module.exports = (sequelize, DataTypes) => {
  const CobroEntrega = sequelize.define(
    'CobroEntrega',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      fkid_pedido: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'pedidos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      fkid_repartidor: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'repartidores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      metodo: {
        type: DataTypes.ENUM('efectivo', 'transferencia', 'mixto'),
        allowNull: false
      },
      monto_efectivo: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      monto_transferencia: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      comprobante_path: {
        type: DataTypes.STRING(255),
        allowNull: true
      }
    },
    {
      tableName: 'cobros_entrega',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );

  return CobroEntrega;
};
