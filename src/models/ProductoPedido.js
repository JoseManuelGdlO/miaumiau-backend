module.exports = (sequelize, DataTypes) => {
  const ProductoPedido = sequelize.define('ProductoPedido', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    fkid_pedido: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'pedidos',
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
    },
    precio_unidad: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01
      }
    },
    precio_total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01
      }
    },
    descuento_producto: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0,
        max: 100
      }
    },
    notas_producto: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 500]
      }
    },
    baja_logica: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    tableName: 'productos_pedido',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        fields: ['fkid_pedido']
      },
      {
        fields: ['fkid_producto']
      },
      {
        fields: ['cantidad']
      },
      {
        fields: ['precio_unidad']
      },
      {
        fields: ['precio_total']
      },
      {
        fields: ['baja_logica']
      },
      {
        fields: ['created_at']
      },
      {
        unique: true,
        fields: ['fkid_pedido', 'fkid_producto']
      }
    ]
  });

  // Métodos de instancia
  ProductoPedido.prototype.softDelete = function() {
    this.baja_logica = true;
    return this.save();
  };

  ProductoPedido.prototype.restore = function() {
    this.baja_logica = false;
    return this.save();
  };

  ProductoPedido.prototype.updateCantidad = function(nuevaCantidad) {
    this.cantidad = nuevaCantidad;
    this.precio_total = parseFloat(this.precio_unidad) * parseInt(nuevaCantidad);
    return this.save();
  };

  ProductoPedido.prototype.updatePrecioUnidad = function(nuevoPrecio) {
    this.precio_unidad = nuevoPrecio;
    this.precio_total = parseFloat(nuevoPrecio) * parseInt(this.cantidad);
    return this.save();
  };

  ProductoPedido.prototype.aplicarDescuento = function(porcentajeDescuento) {
    this.descuento_producto = porcentajeDescuento;
    const descuento = (parseFloat(this.precio_total) * parseFloat(porcentajeDescuento)) / 100;
    this.precio_total = parseFloat(this.precio_total) - descuento;
    return this.save();
  };

  ProductoPedido.prototype.calcularPrecioTotal = function() {
    const precioBase = parseFloat(this.precio_unidad) * parseInt(this.cantidad);
    const descuento = (precioBase * parseFloat(this.descuento_producto)) / 100;
    this.precio_total = precioBase - descuento;
    return this.save();
  };

  ProductoPedido.prototype.updateNotas = function(notas) {
    this.notas_producto = notas;
    return this.save();
  };

  // Métodos estáticos
  ProductoPedido.findByPedido = function(pedidoId) {
    return this.findAll({
      where: { 
        fkid_pedido: pedidoId,
        baja_logica: false
      },
      order: [['created_at', 'ASC']]
    });
  };

  ProductoPedido.findByProducto = function(productoId) {
    return this.findAll({
      where: { 
        fkid_producto: productoId,
        baja_logica: false
      },
      order: [['created_at', 'DESC']]
    });
  };

  ProductoPedido.findByCantidad = function(cantidad) {
    return this.findAll({
      where: { 
        cantidad: cantidad,
        baja_logica: false
      },
      order: [['created_at', 'DESC']]
    });
  };

  ProductoPedido.findByPrecioRange = function(precioMin, precioMax) {
    return this.findAll({
      where: { 
        precio_total: {
          [sequelize.Sequelize.Op.between]: [precioMin, precioMax]
        },
        baja_logica: false
      },
      order: [['precio_total', 'DESC']]
    });
  };

  ProductoPedido.findConDescuento = function() {
    return this.findAll({
      where: { 
        descuento_producto: {
          [sequelize.Sequelize.Op.gt]: 0
        },
        baja_logica: false
      },
      order: [['descuento_producto', 'DESC']]
    });
  };

  ProductoPedido.getProductoPedidoStats = function(pedidoId = null) {
    const whereClause = { baja_logica: false };
    
    if (pedidoId) {
      whereClause.fkid_pedido = pedidoId;
    }
    
    return this.findAll({
      attributes: [
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total_productos'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('cantidad')), 'total_cantidad'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('precio_total')), 'total_ventas'],
        [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('precio_unidad')), 'precio_promedio'],
        [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('cantidad')), 'cantidad_promedio']
      ],
      where: whereClause
    });
  };

  ProductoPedido.getProductosMasVendidos = function(limit = 10) {
    return this.findAll({
      attributes: [
        'fkid_producto',
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('cantidad')), 'total_vendido'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('fkid_pedido')), 'total_pedidos'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('precio_total')), 'total_ventas']
      ],
      where: { baja_logica: false },
      group: ['fkid_producto'],
      order: [[sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('cantidad')), 'DESC']],
      limit: limit
    });
  };

  ProductoPedido.getProductosPorPedido = function() {
    return this.findAll({
      attributes: [
        'fkid_pedido',
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('fkid_producto')), 'total_productos'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('cantidad')), 'total_cantidad'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('precio_total')), 'total_ventas']
      ],
      where: { baja_logica: false },
      group: ['fkid_pedido'],
      order: [[sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('fkid_producto')), 'DESC']]
    });
  };

  ProductoPedido.getDescuentosAplicados = function() {
    return this.findAll({
      attributes: [
        'descuento_producto',
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total_productos'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('precio_total')), 'total_ventas']
      ],
      where: { 
        baja_logica: false,
        descuento_producto: {
          [sequelize.Sequelize.Op.gt]: 0
        }
      },
      group: ['descuento_producto'],
      order: [['descuento_producto', 'DESC']]
    });
  };

  ProductoPedido.getRecentProductosPedido = function(limit = 10) {
    return this.findAll({
      where: { baja_logica: false },
      order: [['created_at', 'DESC']],
      limit: limit
    });
  };

  ProductoPedido.findByPedidoAndProducto = function(pedidoId, productoId) {
    return this.findOne({
      where: { 
        fkid_pedido: pedidoId,
        fkid_producto: productoId,
        baja_logica: false
      }
    });
  };

  ProductoPedido.getTotalByPedido = function(pedidoId) {
    return this.findAll({
      attributes: [
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('precio_total')), 'total_pedido']
      ],
      where: { 
        fkid_pedido: pedidoId,
        baja_logica: false
      }
    });
  };

  return ProductoPedido;
};
