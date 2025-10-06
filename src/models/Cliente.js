module.exports = (sequelize, DataTypes) => {
  const Cliente = sequelize.define('Cliente', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre_completo: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [2, 100],
        notEmpty: true
      }
    },
    telefono: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [7, 20]
      }
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmail: true,
        len: [0, 100]
      }
    },
    fkid_ciudad: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'cities',
        key: 'id'
      },
      validate: {
        notNull: true
      }
    },
    canal_contacto: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [0, 50]
      }
    },
    direccion_entrega: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 500]
      }
    },
    puntos_lealtad: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    notas_especiales: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 1000]
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    }
  }, {
    tableName: 'clientes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false,
    indexes: [
      {
        fields: ['email'],
        unique: true,
        where: {
          email: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      },
      {
        fields: ['telefono']
      },
      {
        fields: ['fkid_ciudad']
      },
      {
        fields: ['isActive']
      }
    ]
  });

  // Métodos de instancia
  Cliente.prototype.softDelete = function() {
    this.isActive = false;
    return this.save();
  };

  Cliente.prototype.restore = function() {
    this.isActive = true;
    return this.save();
  };

  Cliente.prototype.addLoyaltyPoints = function(points) {
    this.puntos_lealtad += points;
    return this.save();
  };

  Cliente.prototype.removeLoyaltyPoints = function(points) {
    this.puntos_lealtad = Math.max(0, this.puntos_lealtad - points);
    return this.save();
  };

  // Métodos estáticos
  Cliente.findActive = function() {
    return this.findAll({
      where: { isActive: true },
      order: [['nombre_completo', 'ASC']]
    });
  };

  Cliente.findByEmail = function(email) {
    return this.findOne({
      where: { 
        email,
        isActive: true
      }
    });
  };

  Cliente.findByPhone = function(telefono) {
    return this.findOne({
      where: { 
        telefono,
        isActive: true
      }
    });
  };

  Cliente.findByCity = function(ciudad_id) {
    return this.findAll({
      where: { 
        fkid_ciudad: ciudad_id,
        isActive: true
      },
      order: [['nombre_completo', 'ASC']]
    });
  };

  return Cliente;
};
