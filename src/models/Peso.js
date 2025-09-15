module.exports = (sequelize, DataTypes) => {
  const Peso = sequelize.define('Peso', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    cantidad: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01,
        notEmpty: true
      }
    },
    unidad_medida: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['kg', 'g', 'lb', 'oz', 'ton']],
        notEmpty: true
      }
    },
    baja_logica: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    tableName: 'pesos',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        fields: ['unidad_medida']
      },
      {
        fields: ['baja_logica']
      },
      {
        fields: ['cantidad']
      }
    ]
  });

  // Métodos de instancia
  Peso.prototype.softDelete = function() {
    this.baja_logica = true;
    return this.save();
  };

  Peso.prototype.restore = function() {
    this.baja_logica = false;
    return this.save();
  };

  Peso.prototype.activate = function() {
    this.baja_logica = false;
    return this.save();
  };

  Peso.prototype.deactivate = function() {
    this.baja_logica = true;
    return this.save();
  };

  // Métodos estáticos
  Peso.findByUnidad = function(unidad_medida) {
    return this.findAll({
      where: { 
        unidad_medida,
        baja_logica: false
      },
      order: [['cantidad', 'ASC']]
    });
  };

  Peso.findActive = function() {
    return this.findAll({
      where: { baja_logica: false },
      order: [['unidad_medida', 'ASC'], ['cantidad', 'ASC']]
    });
  };

  Peso.findByRange = function(minCantidad, maxCantidad) {
    return this.findAll({
      where: { 
        cantidad: {
          [sequelize.Sequelize.Op.between]: [minCantidad, maxCantidad]
        },
        baja_logica: false
      },
      order: [['cantidad', 'ASC']]
    });
  };

  Peso.getUnidadesDisponibles = function() {
    return ['kg', 'g', 'lb', 'oz', 'ton'];
  };

  return Peso;
};
