module.exports = (sequelize, DataTypes) => {
  const Inventario = sequelize.define('Inventario', {
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
    sku: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        notEmpty: true
      }
    },
    fkid_peso: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'pesos',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    fkid_categoria: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'categorias_producto',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    fkid_ciudad: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'cities',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 1000]
      }
    },
    stock_inicial: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    stock_minimo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    stock_maximo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1000,
      validate: {
        min: 1
      }
    },
    costo_unitario: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    precio_venta: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    fkid_proveedor: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'proveedores',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    baja_logica: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    tableName: 'inventarios',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false,
    indexes: [
      {
        fields: ['sku'],
        unique: true
      },
      {
        fields: ['nombre']
      },
      {
        fields: ['fkid_peso']
      },
      {
        fields: ['fkid_categoria']
      },
      {
        fields: ['fkid_ciudad']
      },
      {
        fields: ['fkid_proveedor']
      },
      {
        fields: ['baja_logica']
      },
      {
        fields: ['stock_inicial']
      },
      {
        fields: ['precio_venta']
      }
    ],
    validate: {
      stockMinimoMenorQueMaximo() {
        if (this.stock_minimo > this.stock_maximo) {
          throw new Error('El stock mínimo no puede ser mayor al stock máximo');
        }
      },
      stockInicialValido() {
        if (this.stock_inicial < 0) {
          throw new Error('El stock inicial no puede ser negativo');
        }
        if (this.stock_inicial > this.stock_maximo) {
          throw new Error('El stock inicial no puede ser mayor al stock máximo');
        }
      },
      precioVentaMayorQueCosto() {
        if (this.precio_venta < this.costo_unitario) {
          throw new Error('El precio de venta debe ser mayor o igual al costo unitario');
        }
      }
    }
  });

  // Métodos de instancia
  Inventario.prototype.softDelete = function() {
    this.baja_logica = true;
    return this.save({ fields: ['baja_logica'], validate: false });
  };

  Inventario.prototype.restore = function() {
    this.baja_logica = false;
    return this.save({ fields: ['baja_logica'], validate: false });
  };

  Inventario.prototype.activate = function() {
    this.baja_logica = false;
    return this.save();
  };

  Inventario.prototype.deactivate = function() {
    this.baja_logica = true;
    return this.save();
  };

  Inventario.prototype.updateStock = function(newStock) {
    if (newStock < 0) {
      throw new Error('El stock no puede ser negativo');
    }
    if (newStock > this.stock_maximo) {
      throw new Error('El stock no puede exceder el stock máximo');
    }
    this.stock_inicial = newStock;
    return this.save();
  };

  Inventario.prototype.isLowStock = function() {
    return this.stock_inicial <= this.stock_minimo;
  };

  Inventario.prototype.getProfitMargin = function() {
    if (this.costo_unitario === 0) return 0;
    return ((this.precio_venta - this.costo_unitario) / this.costo_unitario) * 100;
  };

  Inventario.prototype.getTotalValue = function() {
    return this.stock_inicial * this.costo_unitario;
  };

  // Métodos estáticos
  Inventario.findBySKU = function(sku) {
    return this.findOne({ 
      where: { 
        sku: sku
      } 
    });
  };

  Inventario.findByCategory = function(categoriaId) {
    return this.findAll({
      where: { 
        fkid_categoria: categoriaId,
        baja_logica: false
      },
      order: [['nombre', 'ASC']]
    });
  };

  Inventario.findByCity = function(ciudadId) {
    return this.findAll({
      where: { 
        fkid_ciudad: ciudadId,
        baja_logica: false
      },
      order: [['nombre', 'ASC']]
    });
  };

  Inventario.findByProvider = function(proveedorId) {
    return this.findAll({
      where: { 
        fkid_proveedor: proveedorId,
        baja_logica: false
      },
      order: [['nombre', 'ASC']]
    });
  };

  Inventario.findByWeight = function(pesoId) {
    return this.findAll({
      where: { 
        fkid_peso: pesoId,
        baja_logica: false
      },
      order: [['nombre', 'ASC']]
    });
  };

  Inventario.findActive = function() {
    return this.findAll({
      where: { baja_logica: false },
      order: [['nombre', 'ASC']]
    });
  };

  Inventario.findLowStock = function() {
    return this.findAll({
      where: { 
        baja_logica: false,
        stock_inicial: {
          [sequelize.Sequelize.Op.lte]: sequelize.Sequelize.col('stock_minimo')
        }
      },
      order: [['stock_inicial', 'ASC']]
    });
  };

  Inventario.findByPriceRange = function(minPrice, maxPrice) {
    return this.findAll({
      where: { 
        precio_venta: {
          [sequelize.Sequelize.Op.between]: [minPrice, maxPrice]
        },
        baja_logica: false
      },
      order: [['precio_venta', 'ASC']]
    });
  };

  Inventario.findBySearch = function(searchTerm) {
    return this.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { nombre: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } },
          { sku: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } },
          { descripcion: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } }
        ],
        baja_logica: false
      },
      order: [['nombre', 'ASC']]
    });
  };

  Inventario.getInventoryStats = function() {
    return this.findAll({
      attributes: [
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total_items'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('stock_inicial')), 'total_stock'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.literal('stock_inicial * costo_unitario')), 'total_value'],
        [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('precio_venta')), 'avg_price']
      ],
      where: { baja_logica: false }
    });
  };

  return Inventario;
};
