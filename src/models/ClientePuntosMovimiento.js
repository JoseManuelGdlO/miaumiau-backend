module.exports = (sequelize, DataTypes) => {
  const ClientePuntosMovimiento = sequelize.define(
    'ClientePuntosMovimiento',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      fkid_cliente: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'clientes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      tipo: {
        type: DataTypes.ENUM('ganado', 'gastado', 'ajuste'),
        allowNull: false
      },
      puntos: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      saldo_despues: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      referencia: {
        type: DataTypes.STRING(255),
        allowNull: true
      }
    },
    {
      tableName: 'cliente_puntos_movimientos',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false
    }
  );

  return ClientePuntosMovimiento;
};
