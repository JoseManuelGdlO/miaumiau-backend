module.exports = (sequelize, DataTypes) => {
  const Pedido = sequelize.define('Pedido', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    fkid_cliente: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    telefono_referencia: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        len: [7, 20],
        is: /^[\+]?[0-9\s\-\(\)]+$/
      }
    },
    email_referencia: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true,
        len: [5, 255]
      }
    },
    direccion_entrega: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 500],
        notEmpty: true
      }
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
    numero_pedido: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [5, 50],
        notEmpty: true
      }
    },
    estado: {
      type: DataTypes.ENUM('pendiente', 'confirmado', 'en_preparacion', 'en_camino', 'entregado', 'cancelado'),
      allowNull: false,
      defaultValue: 'pendiente'
    },
    fecha_pedido: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    fecha_entrega_estimada: {
      type: DataTypes.DATE,
      allowNull: true
    },
    fecha_entrega_real: {
      type: DataTypes.DATE,
      allowNull: true
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    },
    impuestos: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    },
    descuento: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    },
    metodo_pago: {
      type: DataTypes.ENUM('efectivo', 'tarjeta', 'transferencia', 'pago_movil'),
      allowNull: true
    },
    notas: {
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
    tableName: 'pedidos',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        fields: ['fkid_cliente']
      },
      {
        fields: ['fkid_ciudad']
      },
      {
        fields: ['numero_pedido']
      },
      {
        fields: ['estado']
      },
      {
        fields: ['fecha_pedido']
      },
      {
        fields: ['fecha_entrega_estimada']
      },
      {
        fields: ['metodo_pago']
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
  Pedido.prototype.softDelete = function() {
    this.baja_logica = true;
    return this.save();
  };

  Pedido.prototype.restore = function() {
    this.baja_logica = false;
    return this.save();
  };

  Pedido.prototype.confirmar = function() {
    this.estado = 'confirmado';
    return this.save();
  };

  Pedido.prototype.preparar = function() {
    this.estado = 'en_preparacion';
    return this.save();
  };

  Pedido.prototype.enviar = function() {
    this.estado = 'en_camino';
    return this.save();
  };

  Pedido.prototype.entregar = function() {
    this.estado = 'entregado';
    this.fecha_entrega_real = new Date();
    return this.save();
  };

  Pedido.prototype.cancelar = function() {
    this.estado = 'cancelado';
    return this.save();
  };

  Pedido.prototype.calcularTotal = function() {
    this.total = parseFloat(this.subtotal) + parseFloat(this.impuestos) - parseFloat(this.descuento);
    return this.save();
  };

  Pedido.prototype.actualizarSubtotal = function(nuevoSubtotal) {
    this.subtotal = nuevoSubtotal;
    return this.calcularTotal();
  };

  Pedido.prototype.agregarImpuestos = function(porcentajeImpuestos) {
    this.impuestos = (parseFloat(this.subtotal) * parseFloat(porcentajeImpuestos)) / 100;
    return this.calcularTotal();
  };

  Pedido.prototype.aplicarDescuento = function(descuento) {
    this.descuento = descuento;
    return this.calcularTotal();
  };

  // Métodos estáticos
  Pedido.findByCliente = function(clienteId) {
    return this.findAll({
      where: { 
        fkid_cliente: clienteId,
        baja_logica: false
      },
      order: [['fecha_pedido', 'DESC']]
    });
  };

  Pedido.findByEstado = function(estado) {
    return this.findAll({
      where: { 
        estado: estado,
        baja_logica: false
      },
      order: [['fecha_pedido', 'DESC']]
    });
  };

  Pedido.findByCiudad = function(ciudadId) {
    return this.findAll({
      where: { 
        fkid_ciudad: ciudadId,
        baja_logica: false
      },
      order: [['fecha_pedido', 'DESC']]
    });
  };

  Pedido.findByNumero = function(numeroPedido) {
    return this.findOne({
      where: { 
        numero_pedido: numeroPedido,
        baja_logica: false
      }
    });
  };

  Pedido.findByFechaRange = function(fechaInicio, fechaFin) {
    return this.findAll({
      where: { 
        fecha_pedido: {
          [sequelize.Sequelize.Op.between]: [fechaInicio, fechaFin]
        },
        baja_logica: false
      },
      order: [['fecha_pedido', 'DESC']]
    });
  };

  Pedido.findPendientes = function() {
    return this.findAll({
      where: { 
        estado: 'pendiente',
        baja_logica: false
      },
      order: [['fecha_pedido', 'ASC']]
    });
  };

  Pedido.findEnPreparacion = function() {
    return this.findAll({
      where: { 
        estado: 'en_preparacion',
        baja_logica: false
      },
      order: [['fecha_pedido', 'ASC']]
    });
  };

  Pedido.findEnCamino = function() {
    return this.findAll({
      where: { 
        estado: 'en_camino',
        baja_logica: false
      },
      order: [['fecha_pedido', 'ASC']]
    });
  };

  Pedido.findEntregados = function() {
    return this.findAll({
      where: { 
        estado: 'entregado',
        baja_logica: false
      },
      order: [['fecha_entrega_real', 'DESC']]
    });
  };

  Pedido.findCancelados = function() {
    return this.findAll({
      where: { 
        estado: 'cancelado',
        baja_logica: false
      },
      order: [['fecha_pedido', 'DESC']]
    });
  };

  Pedido.findByMetodoPago = function(metodoPago) {
    return this.findAll({
      where: { 
        metodo_pago: metodoPago,
        baja_logica: false
      },
      order: [['fecha_pedido', 'DESC']]
    });
  };

  Pedido.getPedidoStats = function() {
    return this.findAll({
      attributes: [
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total_pedidos'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN estado = "pendiente" THEN 1 END')), 'pedidos_pendientes'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN estado = "confirmado" THEN 1 END')), 'pedidos_confirmados'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN estado = "en_preparacion" THEN 1 END')), 'pedidos_en_preparacion'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN estado = "en_camino" THEN 1 END')), 'pedidos_en_camino'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN estado = "entregado" THEN 1 END')), 'pedidos_entregados'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN estado = "cancelado" THEN 1 END')), 'pedidos_cancelados'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('total')), 'total_ventas']
      ],
      where: { baja_logica: false }
    });
  };

  Pedido.getPedidosByEstado = function() {
    return this.findAll({
      attributes: [
        'estado',
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total']
      ],
      where: { baja_logica: false },
      group: ['estado'],
      order: [[sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'DESC']]
    });
  };

  Pedido.getPedidosByMetodoPago = function() {
    return this.findAll({
      attributes: [
        'metodo_pago',
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('total')), 'total_ventas']
      ],
      where: { 
        baja_logica: false,
        metodo_pago: {
          [sequelize.Sequelize.Op.ne]: null
        }
      },
      group: ['metodo_pago'],
      order: [[sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('total')), 'DESC']]
    });
  };

  Pedido.getPedidosByCiudad = function() {
    return this.findAll({
      attributes: [
        'fkid_ciudad',
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total_pedidos'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('total')), 'total_ventas']
      ],
      where: { baja_logica: false },
      group: ['fkid_ciudad'],
      order: [[sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'DESC']]
    });
  };

  Pedido.getRecentPedidos = function(limit = 10) {
    return this.findAll({
      where: { baja_logica: false },
      order: [['fecha_pedido', 'DESC']],
      limit: limit
    });
  };

  Pedido.generateNumeroPedido = function() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `PED-${timestamp}-${random}`;
  };

  return Pedido;
};
