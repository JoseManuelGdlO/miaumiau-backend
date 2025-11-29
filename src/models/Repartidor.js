module.exports = (sequelize, DataTypes) => {
  const Repartidor = sequelize.define('Repartidor', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    codigo_repartidor: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [3, 20]
      }
    },
    nombre_completo: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 150]
      }
    },
    telefono: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [10, 20]
      }
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        isEmail: true,
        len: [1, 100]
      }
    },
    fkid_ciudad: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'cities',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    fkid_usuario: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    tipo_vehiculo: {
      type: DataTypes.ENUM('moto', 'bicicleta', 'auto', 'camioneta', 'caminando'),
      allowNull: false,
      defaultValue: 'moto',
      validate: {
        isIn: [['moto', 'bicicleta', 'auto', 'camioneta', 'caminando']]
      }
    },
    capacidad_carga: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    },
    estado: {
      type: DataTypes.ENUM('activo', 'inactivo', 'ocupado', 'disponible', 'en_ruta'),
      allowNull: false,
      defaultValue: 'disponible',
      validate: {
        isIn: [['activo', 'inactivo', 'ocupado', 'disponible', 'en_ruta']]
      }
    },
    zona_cobertura: {
      type: DataTypes.JSON,
      allowNull: true,
      validate: {
        isValidJSON(value) {
          if (value && typeof value !== 'object') {
            throw new Error('La zona de cobertura debe ser un objeto JSON válido');
          }
        }
      }
    },
    horario_trabajo: {
      type: DataTypes.JSON,
      allowNull: true,
      validate: {
        isValidJSON(value) {
          if (value && typeof value !== 'object') {
            throw new Error('El horario de trabajo debe ser un objeto JSON válido');
          }
        }
      }
    },
    tarifa_base: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    },
    comision_porcentaje: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0,
        max: 100
      }
    },
    fecha_ingreso: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: true
      }
    },
    fecha_nacimiento: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: true
      }
    },
    direccion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    documento_identidad: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [0, 50]
      }
    },
    licencia_conducir: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [0, 50]
      }
    },
    seguro_vehiculo: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
      }
    },
    notas: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    calificacion_promedio: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0,
        max: 5
      }
    },
    total_entregas: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    total_km_recorridos: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    },
    fecha_ultima_entrega: {
      type: DataTypes.DATE,
      allowNull: true
    },
    baja_logica: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    tableName: 'repartidores',
    timestamps: true,
    indexes: [
      {
        fields: ['codigo_repartidor']
      },
      {
        fields: ['fkid_ciudad']
      },
      {
        fields: ['fkid_usuario']
      },
      {
        fields: ['estado']
      },
      {
        fields: ['tipo_vehiculo']
      },
      {
        fields: ['baja_logica']
      },
      {
        fields: ['estado', 'fkid_ciudad']
      }
    ]
  });

  // Métodos de instancia
  Repartidor.prototype.estaDisponible = function() {
    return this.estado === 'disponible' && !this.baja_logica;
  };

  Repartidor.prototype.estaActivo = function() {
    return this.estado === 'activo' && !this.baja_logica;
  };

  Repartidor.prototype.estaEnRuta = function() {
    return this.estado === 'en_ruta';
  };

  Repartidor.prototype.estaOcupado = function() {
    return this.estado === 'ocupado';
  };

  Repartidor.prototype.puedeTrabajar = function() {
    return ['activo', 'disponible'].includes(this.estado) && !this.baja_logica;
  };

  Repartidor.prototype.marcarDisponible = function() {
    this.estado = 'disponible';
    return this.save();
  };

  Repartidor.prototype.marcarOcupado = function() {
    this.estado = 'ocupado';
    return this.save();
  };

  Repartidor.prototype.marcarEnRuta = function() {
    this.estado = 'en_ruta';
    return this.save();
  };

  Repartidor.prototype.actualizarMetricas = function(entregas = 0, km = 0) {
    this.total_entregas += entregas;
    this.total_km_recorridos += km;
    this.fecha_ultima_entrega = new Date();
    return this.save();
  };

  Repartidor.prototype.actualizarCalificacion = function(nuevaCalificacion) {
    // Calcular promedio ponderado (simplificado)
    const totalCalificaciones = this.total_entregas;
    const nuevaCalificacionPromedio = ((this.calificacion_promedio * totalCalificaciones) + nuevaCalificacion) / (totalCalificaciones + 1);
    this.calificacion_promedio = Math.round(nuevaCalificacionPromedio * 100) / 100;
    return this.save();
  };

  Repartidor.prototype.obtenerZonaCobertura = function() {
    if (!this.zona_cobertura) {
      return null;
    }
    return this.zona_cobertura;
  };

  Repartidor.prototype.obtenerHorarioTrabajo = function() {
    if (!this.horario_trabajo) {
      return null;
    }
    return this.horario_trabajo;
  };

  Repartidor.prototype.estaEnHorarioTrabajo = function(fecha = new Date()) {
    const horario = this.obtenerHorarioTrabajo();
    if (!horario) return true; // Si no hay horario definido, asumir disponible

    const diaSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][fecha.getDay()];
    const horarioDia = horario[diaSemana];
    
    if (!horarioDia) return false; // No trabaja este día

    const horaActual = fecha.getHours() * 60 + fecha.getMinutes();
    const [horaInicio, minutoInicio] = horarioDia.inicio.split(':').map(Number);
    const [horaFin, minutoFin] = horarioDia.fin.split(':').map(Number);
    
    const inicioMinutos = horaInicio * 60 + minutoInicio;
    const finMinutos = horaFin * 60 + minutoFin;

    return horaActual >= inicioMinutos && horaActual <= finMinutos;
  };

  // Métodos estáticos
  Repartidor.findDisponibles = function(ciudadId = null) {
    const whereClause = {
      estado: 'disponible',
      baja_logica: false
    };

    if (ciudadId) {
      whereClause.fkid_ciudad = ciudadId;
    }

    return this.findAll({
      where: whereClause,
      order: [['calificacion_promedio', 'DESC'], ['total_entregas', 'DESC']]
    });
  };

  Repartidor.findByCiudad = function(ciudadId) {
    return this.findAll({
      where: {
        fkid_ciudad: ciudadId,
        baja_logica: false
      },
      order: [['nombre_completo', 'ASC']]
    });
  };

  Repartidor.findByEstado = function(estado) {
    return this.findAll({
      where: {
        estado: estado,
        baja_logica: false
      },
      order: [['nombre_completo', 'ASC']]
    });
  };

  Repartidor.findByTipoVehiculo = function(tipoVehiculo) {
    return this.findAll({
      where: {
        tipo_vehiculo: tipoVehiculo,
        baja_logica: false
      },
      order: [['nombre_completo', 'ASC']]
    });
  };

  Repartidor.findMejoresCalificados = function(limit = 10) {
    return this.findAll({
      where: {
        baja_logica: false,
        total_entregas: {
          [sequelize.Sequelize.Op.gt]: 0
        }
      },
      order: [['calificacion_promedio', 'DESC'], ['total_entregas', 'DESC']],
      limit: limit
    });
  };

  Repartidor.obtenerEstadisticas = function() {
    return this.findAll({
      attributes: [
        'estado',
        [sequelize.fn('COUNT', sequelize.col('id')), 'cantidad']
      ],
      where: {
        baja_logica: false
      },
      group: ['estado']
    });
  };

  Repartidor.obtenerEstadisticasPorCiudad = function() {
    return this.findAll({
      attributes: [
        'fkid_ciudad',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_repartidores'],
        [sequelize.fn('AVG', sequelize.col('calificacion_promedio')), 'calificacion_promedio'],
        [sequelize.fn('SUM', sequelize.col('total_entregas')), 'total_entregas']
      ],
      where: {
        baja_logica: false
      },
      group: ['fkid_ciudad']
    });
  };

  return Repartidor;
};
