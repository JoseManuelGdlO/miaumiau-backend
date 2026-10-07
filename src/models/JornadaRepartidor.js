module.exports = (sequelize, DataTypes) => {
  const JornadaRepartidor = sequelize.define(
    'JornadaRepartidor',
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
      fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      estado: {
        type: DataTypes.ENUM('borrador', 'esperando_call_center', 'validada', 'cerrada'),
        allowNull: false,
        defaultValue: 'borrador'
      },
      fkid_notificacion: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'notificaciones', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      efectivo_a_depositar: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      comprobante_deposito_path: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      cerrada_en: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      tableName: 'jornadas_repartidor',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          unique: true,
          fields: ['fkid_repartidor', 'fecha']
        }
      ]
    }
  );

  return JornadaRepartidor;
};
