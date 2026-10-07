module.exports = (sequelize, DataTypes) => {
  const JornadaCarga = sequelize.define(
    'JornadaCarga',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      fkid_jornada: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'jornadas_repartidor', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      nombre: {
        type: DataTypes.STRING(150),
        allowNull: false
      },
      fkid_producto: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'inventarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      cantidad: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      precio_unitario: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      es_extra: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    },
    {
      tableName: 'jornada_cargas',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );

  return JornadaCarga;
};
