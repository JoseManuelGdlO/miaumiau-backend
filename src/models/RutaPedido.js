module.exports = (sequelize, DataTypes) => {
  const RutaPedido = sequelize.define('RutaPedido', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    fkid_ruta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'rutas',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
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
    orden_entrega: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1
      }
    },
    estado_entrega: {
      type: DataTypes.ENUM('pendiente', 'en_camino', 'entregado', 'fallido'),
      allowNull: false,
      defaultValue: 'pendiente',
      validate: {
        isIn: [['pendiente', 'en_camino', 'entregado', 'fallido']]
      }
    },
    tiempo_estimado_entrega: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    distancia_desde_anterior: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    },
    lat: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      validate: {
        min: -90,
        max: 90
      }
    },
    lng: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      validate: {
        min: -180,
        max: 180
      }
    },
    link_ubicacion: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true,
        len: [0, 500]
      }
    },
    notas_entrega: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    fecha_entrega_real: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'rutas_pedidos',
    timestamps: true,
    indexes: [
      {
        fields: ['fkid_ruta']
      },
      {
        fields: ['fkid_pedido']
      },
      {
        fields: ['estado_entrega']
      },
      {
        fields: ['lat', 'lng']
      },
      {
        fields: ['fkid_ruta', 'orden_entrega'],
        name: 'idx_ruta_orden'
      }
    ]
  });

  // Métodos de instancia
  RutaPedido.prototype.tieneCoordenadas = function() {
    return this.lat !== null && this.lng !== null;
  };

  RutaPedido.prototype.tieneLinkUbicacion = function() {
    return this.link_ubicacion !== null && this.link_ubicacion.trim() !== '';
  };

  RutaPedido.prototype.estaEntregado = function() {
    return this.estado_entrega === 'entregado';
  };

  RutaPedido.prototype.estaPendiente = function() {
    return this.estado_entrega === 'pendiente';
  };

  RutaPedido.prototype.estaEnCamino = function() {
    return this.estado_entrega === 'en_camino';
  };

  RutaPedido.prototype.falloEntrega = function() {
    return this.estado_entrega === 'fallido';
  };

  RutaPedido.prototype.puedeEntregar = function() {
    return ['pendiente', 'en_camino'].includes(this.estado_entrega);
  };

  RutaPedido.prototype.marcarEntregado = function() {
    this.estado_entrega = 'entregado';
    this.fecha_entrega_real = new Date();
    return this.save();
  };

  RutaPedido.prototype.marcarEnCamino = function() {
    this.estado_entrega = 'en_camino';
    return this.save();
  };

  RutaPedido.prototype.marcarFallido = function() {
    this.estado_entrega = 'fallido';
    return this.save();
  };

  RutaPedido.prototype.generarLinkGoogleMaps = function() {
    if (this.tieneCoordenadas()) {
      return `https://www.google.com/maps?q=${this.lat},${this.lng}`;
    }
    return null;
  };

  RutaPedido.prototype.generarLinkWaze = function() {
    if (this.tieneCoordenadas()) {
      return `https://waze.com/ul?ll=${this.lat},${this.lng}&navigate=yes`;
    }
    return null;
  };

  // Métodos estáticos
  RutaPedido.findByRuta = function(rutaId) {
    return this.findAll({
      where: {
        fkid_ruta: rutaId
      },
      order: [['orden_entrega', 'ASC']]
    });
  };

  RutaPedido.findByPedido = function(pedidoId) {
    return this.findAll({
      where: {
        fkid_pedido: pedidoId
      }
    });
  };

  RutaPedido.findByEstado = function(estado) {
    return this.findAll({
      where: {
        estado_entrega: estado
      },
      order: [['created_at', 'DESC']]
    });
  };

  RutaPedido.findPendientesGeolocalizacion = function() {
    return this.findAll({
      where: {
        lat: null,
        lng: null,
        estado_entrega: 'pendiente'
      },
      order: [['created_at', 'ASC']]
    });
  };

  RutaPedido.findConCoordenadas = function() {
    return this.findAll({
      where: {
        lat: {
          [sequelize.Sequelize.Op.ne]: null
        },
        lng: {
          [sequelize.Sequelize.Op.ne]: null
        }
      }
    });
  };

  RutaPedido.obtenerSiguienteEntrega = function(rutaId, ordenActual = 0) {
    return this.findOne({
      where: {
        fkid_ruta: rutaId,
        orden_entrega: {
          [sequelize.Sequelize.Op.gt]: ordenActual
        },
        estado_entrega: 'pendiente'
      },
      order: [['orden_entrega', 'ASC']]
    });
  };

  RutaPedido.contarPorEstado = function(rutaId) {
    return this.findAll({
      where: {
        fkid_ruta: rutaId
      },
      attributes: [
        'estado_entrega',
        [sequelize.fn('COUNT', sequelize.col('id')), 'cantidad']
      ],
      group: ['estado_entrega']
    });
  };

  return RutaPedido;
};
