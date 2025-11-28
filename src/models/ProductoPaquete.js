module.exports = (sequelize, DataTypes) => {
  const ProductoPaquete = sequelize.define('ProductoPaquete', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    fkid_paquete: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'paquetes',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    fkid_producto: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'inventarios',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 9999
      }
    }
  }, {
    tableName: 'productos_paquete',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false,
    indexes: [
      {
        fields: ['fkid_paquete']
      },
      {
        fields: ['fkid_producto']
      },
      {
        fields: ['cantidad']
      },
      {
        unique: true,
        fields: ['fkid_paquete', 'fkid_producto']
      }
    ]
  });

  // Métodos de instancia
  ProductoPaquete.prototype.updateCantidad = function(nuevaCantidad) {
    if (nuevaCantidad < 1 || nuevaCantidad > 9999) {
      throw new Error('La cantidad debe estar entre 1 y 9999');
    }
    this.cantidad = nuevaCantidad;
    return this.save();
  };

  // Métodos estáticos
  ProductoPaquete.findByPaquete = function(paqueteId) {
    return this.findAll({
      where: { 
        fkid_paquete: paqueteId
      },
      order: [['created_at', 'ASC']]
    });
  };

  ProductoPaquete.findByProducto = function(productoId) {
    return this.findAll({
      where: { 
        fkid_producto: productoId
      },
      order: [['created_at', 'DESC']]
    });
  };

  ProductoPaquete.findByPaqueteAndProducto = function(paqueteId, productoId) {
    return this.findOne({
      where: { 
        fkid_paquete: paqueteId,
        fkid_producto: productoId
      }
    });
  };

  ProductoPaquete.getProductosByPaquete = function(paqueteId) {
    return this.findAll({
      where: { 
        fkid_paquete: paqueteId
      },
      order: [['created_at', 'ASC']]
    });
  };

  ProductoPaquete.getPaquetesByProducto = function(productoId) {
    return this.findAll({
      where: { 
        fkid_producto: productoId
      },
      order: [['created_at', 'DESC']]
    });
  };

  return ProductoPaquete;
};

