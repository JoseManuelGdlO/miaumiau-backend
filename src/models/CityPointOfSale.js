module.exports = (sequelize, DataTypes) => {
  const CityPointOfSale = sequelize.define('CityPointOfSale', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    city_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    nombre: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        len: [2, 150],
        notEmpty: true
      }
    },
    direccion: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [5, 1000],
        notEmpty: true
      }
    },
    telefono: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        len: [0, 20],
        is: /^[\+]?[0-9\s\-\(\)]+$/
      }
    },
    encargado: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
      }
    },
    baja_logica: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    tableName: 'city_points_of_sale',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false,
    indexes: [
      {
        fields: ['city_id']
      },
      {
        fields: ['baja_logica']
      }
    ]
  });

  CityPointOfSale.findByCity = function (cityId, options = {}) {
    const where = {
      city_id: cityId,
      baja_logica: false,
      ...(options.where || {})
    };
    return this.findAll({
      where,
      order: [['nombre', 'ASC']]
    });
  };

  return CityPointOfSale;
};

