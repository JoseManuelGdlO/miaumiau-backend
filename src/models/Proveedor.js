module.exports = (sequelize, DataTypes) => {
  const Proveedor = sequelize.define('Proveedor', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        len: [2, 150],
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
    correo: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true
      }
    },
    telefono: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        len: [7, 20],
        notEmpty: true
      }
    },
    baja_logica: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    tableName: 'proveedores',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        fields: ['nombre']
      },
      {
        fields: ['correo'],
        unique: true
      },
      {
        fields: ['telefono']
      },
      {
        fields: ['baja_logica']
      }
    ]
  });

  // Métodos de instancia
  Proveedor.prototype.softDelete = function() {
    this.baja_logica = true;
    return this.save();
  };

  Proveedor.prototype.restore = function() {
    this.baja_logica = false;
    return this.save();
  };

  Proveedor.prototype.activate = function() {
    this.baja_logica = false;
    return this.save();
  };

  Proveedor.prototype.deactivate = function() {
    this.baja_logica = true;
    return this.save();
  };

  // Métodos estáticos
  Proveedor.findByEmail = function(correo) {
    return this.findOne({ 
      where: { 
        correo: correo
      } 
    });
  };

  Proveedor.findByPhone = function(telefono) {
    return this.findOne({ 
      where: { 
        telefono: telefono
      } 
    });
  };

  Proveedor.findActive = function() {
    return this.findAll({
      where: { baja_logica: false },
      order: [['nombre', 'ASC']]
    });
  };

  Proveedor.findBySearch = function(searchTerm) {
    return this.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { nombre: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } },
          { descripcion: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } },
          { correo: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } }
        ],
        baja_logica: false
      },
      order: [['nombre', 'ASC']]
    });
  };

  return Proveedor;
};
