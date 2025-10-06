module.exports = (sequelize, DataTypes) => {
  const Agente = sequelize.define('Agente', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100]
      }
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    especialidad: {
      type: DataTypes.STRING(200),
      allowNull: true,
      validate: {
        len: [0, 200]
      }
    },
    contexto: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    system_prompt: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    personalidad: {
      type: DataTypes.JSON,
      allowNull: true,
      validate: {
        isValidJSON(value) {
          if (value && typeof value !== 'object') {
            throw new Error('La personalidad debe ser un objeto JSON válido');
          }
        }
      }
    },
    configuracion: {
      type: DataTypes.JSON,
      allowNull: true,
      validate: {
        isValidJSON(value) {
          if (value && typeof value !== 'object') {
            throw new Error('La configuración debe ser un objeto JSON válido');
          }
        }
      }
    },
    estado: {
      type: DataTypes.ENUM('activo', 'inactivo', 'mantenimiento'),
      allowNull: false,
      defaultValue: 'activo',
      validate: {
        isIn: [['activo', 'inactivo', 'mantenimiento']]
      }
    },
    orden_prioridad: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    fecha_creacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    fecha_actualizacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    baja_logica: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    tableName: 'agentes',
    timestamps: true,
    indexes: [
      {
        fields: ['estado']
      },
      {
        fields: ['orden_prioridad']
      },
      {
        fields: ['baja_logica']
      },
      {
        fields: ['estado', 'orden_prioridad']
      }
    ]
  });

  // Métodos de instancia
  Agente.prototype.estaActivo = function() {
    return this.estado === 'activo';
  };

  Agente.prototype.estaInactivo = function() {
    return this.estado === 'inactivo';
  };

  Agente.prototype.estaEnMantenimiento = function() {
    return this.estado === 'mantenimiento';
  };

  Agente.prototype.puedeUsar = function() {
    return this.estado === 'activo' && !this.baja_logica;
  };

  Agente.prototype.actualizarContexto = function(nuevoContexto) {
    this.contexto = nuevoContexto;
    this.fecha_actualizacion = new Date();
    return this.save();
  };

  Agente.prototype.actualizarSystemPrompt = function(nuevoPrompt) {
    this.system_prompt = nuevoPrompt;
    this.fecha_actualizacion = new Date();
    return this.save();
  };

  Agente.prototype.activar = function() {
    this.estado = 'activo';
    return this.save();
  };

  Agente.prototype.desactivar = function() {
    this.estado = 'inactivo';
    return this.save();
  };

  Agente.prototype.ponerEnMantenimiento = function() {
    this.estado = 'mantenimiento';
    return this.save();
  };

  Agente.prototype.obtenerPersonalidad = function() {
    if (!this.personalidad) {
      return {
        tono: 'neutral',
        formalidad: 'media',
        proactividad: 'media',
        conocimiento: 'basico'
      };
    }
    return this.personalidad;
  };

  Agente.prototype.obtenerConfiguracion = function() {
    if (!this.configuracion) {
      return {
        max_tokens: 1000,
        temperature: 0.7,
        incluir_ofertas: false,
        sugerir_productos: false
      };
    }
    return this.configuracion;
  };

  // Métodos estáticos
  Agente.findActivos = function() {
    return this.findAll({
      where: {
        estado: 'activo',
        baja_logica: false
      },
      order: [['orden_prioridad', 'ASC'], ['nombre', 'ASC']]
    });
  };

  Agente.findByEspecialidad = function(especialidad) {
    return this.findAll({
      where: {
        especialidad: especialidad,
        estado: 'activo',
        baja_logica: false
      },
      order: [['orden_prioridad', 'ASC']]
    });
  };

  Agente.findByEstado = function(estado) {
    return this.findAll({
      where: {
        estado: estado,
        baja_logica: false
      },
      order: [['orden_prioridad', 'ASC'], ['nombre', 'ASC']]
    });
  };

  Agente.findParaSeleccion = function() {
    return this.findAll({
      where: {
        estado: 'activo',
        baja_logica: false
      },
      order: [['orden_prioridad', 'ASC'], ['fecha_actualizacion', 'DESC']],
      attributes: ['id', 'nombre', 'especialidad', 'contexto', 'system_prompt', 'personalidad', 'configuracion']
    });
  };

  Agente.obtenerEstadisticas = function() {
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

  return Agente;
};
