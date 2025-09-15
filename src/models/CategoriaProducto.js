module.exports = (sequelize, DataTypes) => {
  const CategoriaProducto = sequelize.define('CategoriaProducto', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        len: [2, 100],
        notEmpty: true
      }
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 1000]
      }
    },
    baja_logica: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    tableName: 'categorias_producto',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        fields: ['nombre'],
        unique: true
      },
      {
        fields: ['baja_logica']
      }
    ]
  });

  // Métodos de instancia
  CategoriaProducto.prototype.softDelete = function() {
    this.baja_logica = true;
    return this.save();
  };

  CategoriaProducto.prototype.restore = function() {
    this.baja_logica = false;
    return this.save();
  };

  CategoriaProducto.prototype.activate = function() {
    this.baja_logica = false;
    return this.save();
  };

  CategoriaProducto.prototype.deactivate = function() {
    this.baja_logica = true;
    return this.save();
  };

  // Métodos estáticos
  CategoriaProducto.findByName = function(nombre) {
    return this.findOne({ 
      where: { 
        nombre: {
          [sequelize.Sequelize.Op.like]: nombre
        }
      } 
    });
  };

  CategoriaProducto.findActive = function() {
    return this.findAll({
      where: { baja_logica: false },
      order: [['nombre', 'ASC']]
    });
  };

  CategoriaProducto.findBySearch = function(searchTerm) {
    return this.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { nombre: { [sequelize.Sequelize.Op.like]: `%${searchTerm}%` } },
          { descripcion: { [sequelize.Sequelize.Op.like]: `%${searchTerm}%` } }
        ],
        baja_logica: false
      },
      order: [['nombre', 'ASC']]
    });
  };

  return CategoriaProducto;
};
