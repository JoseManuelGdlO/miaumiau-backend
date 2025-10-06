module.exports = (sequelize, DataTypes) => {
  const Mascota = sequelize.define('Mascota', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        len: [1, 50],
        notEmpty: true
      }
    },
    edad: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
        max: 30
      }
    },
    genero: {
      type: DataTypes.ENUM('macho', 'hembra'),
      allowNull: true
    },
    raza: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [0, 50]
      }
    },
    producto_preferido: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
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
    fkid_cliente: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'clientes',
        key: 'id'
      },
      validate: {
        notNull: true
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    }
  }, {
    tableName: 'mascotas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false,
    indexes: [
      {
        fields: ['fkid_cliente']
      },
      {
        fields: ['genero']
      },
      {
        fields: ['raza']
      },
      {
        fields: ['isActive']
      }
    ]
  });

  // Métodos de instancia
  Mascota.prototype.softDelete = function() {
    this.isActive = false;
    return this.save();
  };

  Mascota.prototype.restore = function() {
    this.isActive = true;
    return this.save();
  };

  Mascota.prototype.addLoyaltyPoints = function(points) {
    this.puntos_lealtad += points;
    return this.save();
  };

  Mascota.prototype.removeLoyaltyPoints = function(points) {
    this.puntos_lealtad = Math.max(0, this.puntos_lealtad - points);
    return this.save();
  };

  // Métodos estáticos
  Mascota.findActive = function() {
    return this.findAll({
      where: { isActive: true },
      order: [['nombre', 'ASC']]
    });
  };

  Mascota.findByCliente = function(cliente_id) {
    return this.findAll({
      where: { 
        fkid_cliente: cliente_id,
        isActive: true
      },
      order: [['nombre', 'ASC']]
    });
  };

  Mascota.findByRaza = function(raza) {
    return this.findAll({
      where: { 
        raza,
        isActive: true
      },
      order: [['nombre', 'ASC']]
    });
  };

  Mascota.findByGenero = function(genero) {
    return this.findAll({
      where: { 
        genero,
        isActive: true
      },
      order: [['nombre', 'ASC']]
    });
  };

  return Mascota;
};
