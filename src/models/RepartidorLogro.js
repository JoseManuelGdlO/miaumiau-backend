module.exports = (sequelize, DataTypes) => {
  const RepartidorLogro = sequelize.define(
    'RepartidorLogro',
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
      codigo: {
        type: DataTypes.STRING(40),
        allowNull: false
      },
      desbloqueado_en: {
        type: DataTypes.DATE,
        allowNull: false
      }
    },
    {
      tableName: 'repartidor_logros',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          unique: true,
          fields: ['fkid_repartidor', 'codigo']
        }
      ]
    }
  );

  return RepartidorLogro;
};
