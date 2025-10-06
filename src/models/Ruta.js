module.exports = (sequelize, DataTypes) => {
  const Ruta = sequelize.define('Ruta', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre_ruta: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100]
      }
    },
    fecha_ruta: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        notEmpty: true,
        isDate: true
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
    fkid_repartidor: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    estado: {
      type: DataTypes.ENUM('planificada', 'en_progreso', 'completada', 'cancelada'),
      allowNull: false,
      defaultValue: 'planificada',
      validate: {
        isIn: [['planificada', 'en_progreso', 'completada', 'cancelada']]
      }
    },
    total_pedidos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    total_entregados: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    distancia_estimada: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    },
    tiempo_estimado: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    notas: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    fecha_creacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    fecha_inicio: {
      type: DataTypes.DATE,
      allowNull: true
    },
    fecha_fin: {
      type: DataTypes.DATE,
      allowNull: true
    },
    baja_logica: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    tableName: 'rutas',
    timestamps: true,
    indexes: [
      {
        fields: ['fecha_ruta']
      },
      {
        fields: ['fkid_ciudad']
      },
      {
        fields: ['fkid_repartidor']
      },
      {
        fields: ['estado']
      },
      {
        fields: ['baja_logica']
      },
      {
        fields: ['fecha_ruta', 'fkid_ciudad']
      }
    ]
  });

  // Métodos de instancia
  Ruta.prototype.calcularProgreso = function() {
    if (this.total_pedidos === 0) return 0;
    return Math.round((this.total_entregados / this.total_pedidos) * 100);
  };

  Ruta.prototype.estaCompleta = function() {
    return this.total_entregados === this.total_pedidos && this.total_pedidos > 0;
  };

  Ruta.prototype.puedeIniciar = function() {
    return this.estado === 'planificada' && this.total_pedidos > 0;
  };

  Ruta.prototype.puedeCompletar = function() {
    return this.estado === 'en_progreso' && this.estaCompleta();
  };

  // Métodos estáticos
  Ruta.findByRepartidor = function(repartidorId, fecha = null) {
    const whereClause = {
      fkid_repartidor: repartidorId,
      baja_logica: false
    };

    if (fecha) {
      whereClause.fecha_ruta = fecha;
    }

    return this.findAll({
      where: whereClause,
      order: [['fecha_ruta', 'DESC'], ['created_at', 'DESC']]
    });
  };

  Ruta.findByCiudad = function(ciudadId, fecha = null) {
    const whereClause = {
      fkid_ciudad: ciudadId,
      baja_logica: false
    };

    if (fecha) {
      whereClause.fecha_ruta = fecha;
    }

    return this.findAll({
      where: whereClause,
      order: [['fecha_ruta', 'DESC'], ['created_at', 'DESC']]
    });
  };

  Ruta.findByEstado = function(estado) {
    return this.findAll({
      where: {
        estado: estado,
        baja_logica: false
      },
      order: [['fecha_ruta', 'ASC'], ['created_at', 'ASC']]
    });
  };

  Ruta.findActivas = function() {
    return this.findAll({
      where: {
        estado: ['planificada', 'en_progreso'],
        baja_logica: false
      },
      order: [['fecha_ruta', 'ASC'], ['created_at', 'ASC']]
    });
  };

  return Ruta;
};
