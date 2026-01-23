module.exports = (sequelize, DataTypes) => {
  const ConversacionFlag = sequelize.define('ConversacionFlag', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [1, 100],
        notEmpty: true
      }
    },
    color: {
      type: DataTypes.STRING(7),
      allowNull: false,
      defaultValue: '#3B82F6',
      validate: {
        is: /^#[0-9A-F]{6}$/i,
        notEmpty: true
      }
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 500]
      }
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    baja_logica: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    tableName: 'conversaciones_flags',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        fields: ['nombre']
      },
      {
        fields: ['activo']
      },
      {
        fields: ['baja_logica']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  // Métodos de instancia
  ConversacionFlag.prototype.softDelete = function() {
    this.baja_logica = true;
    return this.save();
  };

  ConversacionFlag.prototype.restore = function() {
    this.baja_logica = false;
    return this.save();
  };

  ConversacionFlag.prototype.activate = function() {
    this.activo = true;
    return this.save();
  };

  ConversacionFlag.prototype.deactivate = function() {
    this.activo = false;
    return this.save();
  };

  ConversacionFlag.prototype.isActive = function() {
    return this.activo && !this.baja_logica;
  };

  // Métodos estáticos
  ConversacionFlag.findActive = function() {
    return this.findAll({
      where: {
        activo: true,
        baja_logica: false
      },
      order: [['nombre', 'ASC']]
    });
  };

  ConversacionFlag.findByName = function(nombre) {
    return this.findOne({
      where: {
        nombre: {
          [sequelize.Sequelize.Op.iLike]: nombre
        },
        baja_logica: false
      }
    });
  };

  ConversacionFlag.findByColor = function(color) {
    return this.findAll({
      where: {
        color: color,
        baja_logica: false
      },
      order: [['nombre', 'ASC']]
    });
  };

  return ConversacionFlag;
};
