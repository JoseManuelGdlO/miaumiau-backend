module.exports = (sequelize, DataTypes) => {
  const PaquetePedido = sequelize.define('PaquetePedido', {
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
    fkid_paquete: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'paquetes',
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
    descuento_paquete: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0,
        max: 100
      }
    },
    notas_paquete: {
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
    tableName: 'paquetes_pedido',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false,
    indexes: [
      {
        fields: ['fkid_pedido']
      },
      {
        fields: ['fkid_paquete']
      },
      {
        fields: ['cantidad']
      },
      {
        fields: ['precio_total']
      },
      {
        fields: ['baja_logica']
      },
      {
        unique: true,
        fields: ['fkid_pedido', 'fkid_paquete']
      }
    ]
  });

  // Métodos de instancia
  PaquetePedido.prototype.softDelete = function() {
    this.baja_logica = true;
    return this.save();
  };

  PaquetePedido.prototype.restore = function() {
    this.baja_logica = false;
    return this.save();
  };

  PaquetePedido.prototype.updateCantidad = function(nuevaCantidad) {
    this.cantidad = nuevaCantidad;
    this.precio_total = parseFloat(this.precio_unidad) * parseInt(nuevaCantidad);
    return this.save();
  };

  PaquetePedido.prototype.updatePrecioUnidad = function(nuevoPrecio) {
    this.precio_unidad = nuevoPrecio;
    this.precio_total = parseFloat(nuevoPrecio) * parseInt(this.cantidad);
    return this.save();
  };

  PaquetePedido.prototype.aplicarDescuento = function(porcentajeDescuento) {
    this.descuento_paquete = porcentajeDescuento;
    const descuento = (parseFloat(this.precio_total) * parseFloat(porcentajeDescuento)) / 100;
    this.precio_total = parseFloat(this.precio_total) - descuento;
    return this.save();
  };

  PaquetePedido.prototype.calcularPrecioTotal = function() {
    const precioBase = parseFloat(this.precio_unidad) * parseInt(this.cantidad);
    const descuento = (precioBase * parseFloat(this.descuento_paquete)) / 100;
    this.precio_total = precioBase - descuento;
    return this.save();
  };

  PaquetePedido.prototype.updateNotas = function(notas) {
    this.notas_paquete = notas;
    return this.save();
  };

  // Métodos estáticos
  PaquetePedido.findByPedido = function(pedidoId) {
    return this.findAll({
      where: { 
        fkid_pedido: pedidoId,
        baja_logica: false
      },
      order: [['created_at', 'ASC']]
    });
  };

  PaquetePedido.findByPaquete = function(paqueteId) {
    return this.findAll({
      where: { 
        fkid_paquete: paqueteId,
        baja_logica: false
      },
      order: [['created_at', 'DESC']]
    });
  };

  PaquetePedido.findByPedidoAndPaquete = function(pedidoId, paqueteId) {
    return this.findOne({
      where: { 
        fkid_pedido: pedidoId,
        fkid_paquete: paqueteId,
        baja_logica: false
      }
    });
  };

  PaquetePedido.getTotalByPedido = function(pedidoId) {
    return this.findAll({
      attributes: [
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('precio_total')), 'total_paquetes']
      ],
      where: { 
        fkid_pedido: pedidoId,
        baja_logica: false
      }
    });
  };

  return PaquetePedido;
};

