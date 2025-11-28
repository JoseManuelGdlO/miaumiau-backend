module.exports = (sequelize, DataTypes) => {
  const Paquete = sequelize.define('Paquete', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        len: [2, 200],
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
    precio: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    descuento: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0.00,
      validate: {
        min: 0,
        max: 100
      }
    },
    precio_final: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    }
  }, {
    tableName: 'paquetes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false,
    indexes: [
      {
        fields: ['nombre']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['precio_final']
      }
    ],
    hooks: {
      beforeSave: (paquete) => {
        // Calcular precio_final antes de guardar
        if (paquete.precio !== undefined) {
          const precio = parseFloat(paquete.precio);
          const descuento = paquete.descuento ? parseFloat(paquete.descuento) : 0;
          const descuentoAmount = (precio * descuento) / 100;
          paquete.precio_final = precio - descuentoAmount;
        }
      },
      beforeUpdate: (paquete) => {
        // Calcular precio_final antes de actualizar
        if (paquete.precio !== undefined) {
          const precio = parseFloat(paquete.precio);
          const descuento = paquete.descuento ? parseFloat(paquete.descuento) : 0;
          const descuentoAmount = (precio * descuento) / 100;
          paquete.precio_final = precio - descuentoAmount;
        }
      }
    },
    validate: {
      precioFinalValido() {
        if (this.precio_final < 0) {
          throw new Error('El precio final no puede ser negativo');
        }
      },
      descuentoValido() {
        if (this.descuento && (this.descuento < 0 || this.descuento > 100)) {
          throw new Error('El descuento debe estar entre 0 y 100');
        }
      }
    }
  });

  // Métodos de instancia
  Paquete.prototype.softDelete = function() {
    this.is_active = false;
    return this.save();
  };

  Paquete.prototype.restore = function() {
    this.is_active = true;
    return this.save();
  };

  Paquete.prototype.activate = function() {
    this.is_active = true;
    return this.save();
  };

  Paquete.prototype.deactivate = function() {
    this.is_active = false;
    return this.save();
  };

  Paquete.prototype.updatePrecio = function(nuevoPrecio, nuevoDescuento = null) {
    this.precio = nuevoPrecio;
    if (nuevoDescuento !== null) {
      this.descuento = nuevoDescuento;
    }
    const descuento = this.descuento ? parseFloat(this.descuento) : 0;
    const descuentoAmount = (parseFloat(nuevoPrecio) * descuento) / 100;
    this.precio_final = parseFloat(nuevoPrecio) - descuentoAmount;
    return this.save();
  };

  Paquete.prototype.aplicarDescuento = function(porcentajeDescuento) {
    if (porcentajeDescuento < 0 || porcentajeDescuento > 100) {
      throw new Error('El descuento debe estar entre 0 y 100');
    }
    this.descuento = porcentajeDescuento;
    const descuentoAmount = (parseFloat(this.precio) * porcentajeDescuento) / 100;
    this.precio_final = parseFloat(this.precio) - descuentoAmount;
    return this.save();
  };

  // Métodos estáticos
  Paquete.findByName = function(nombre) {
    return this.findOne({ 
      where: { 
        nombre: nombre,
        is_active: true
      } 
    });
  };

  Paquete.findActive = function() {
    return this.findAll({
      where: { is_active: true },
      order: [['nombre', 'ASC']]
    });
  };

  Paquete.findInactive = function() {
    return this.findAll({
      where: { is_active: false },
      order: [['nombre', 'ASC']]
    });
  };

  Paquete.findBySearch = function(searchTerm) {
    return this.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { nombre: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } },
          { descripcion: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } }
        ],
        is_active: true
      },
      order: [['nombre', 'ASC']]
    });
  };

  Paquete.findByPriceRange = function(minPrice, maxPrice) {
    return this.findAll({
      where: { 
        precio_final: {
          [sequelize.Sequelize.Op.between]: [minPrice, maxPrice]
        },
        is_active: true
      },
      order: [['precio_final', 'ASC']]
    });
  };

  Paquete.findWithDescuento = function() {
    return this.findAll({
      where: { 
        descuento: {
          [sequelize.Sequelize.Op.gt]: 0
        },
        is_active: true
      },
      order: [['descuento', 'DESC']]
    });
  };

  Paquete.getPackageStats = function() {
    return this.findAll({
      attributes: [
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total_paquetes'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('precio_final')), 'total_valor'],
        [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('precio_final')), 'precio_promedio'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal("CASE WHEN is_active = true THEN 1 END")), 'paquetes_activos'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal("CASE WHEN is_active = false THEN 1 END")), 'paquetes_inactivos']
      ]
    });
  };

  return Paquete;
};

