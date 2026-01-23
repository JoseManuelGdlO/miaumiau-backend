const { Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const City = sequelize.define('City', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [2, 100],
        notEmpty: true
      }
    },
    departamento: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [2, 100],
        notEmpty: true
      }
    },
    direccion_operaciones: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 500],
        notEmpty: true
      }
    },
    estado_inicial: {
      type: DataTypes.ENUM('activa', 'inactiva', 'en_construccion', 'mantenimiento', 'suspendida'),
      allowNull: false,
      defaultValue: 'activa'
    },
    numero_zonas_entrega: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
        max: 50
      }
    },
    area_cobertura: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0
      }
    },
    tiempo_promedio_entrega: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Tiempo en minutos',
      validate: {
        min: 1,
        max: 1440 // 24 horas en minutos
      }
    },
    horario_atencion: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
      }
    },
    manager: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
      }
    },
    telefono: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        len: [0, 20],
        is: /^[\+]?[0-9\s\-\(\)]+$/
      }
    },
    email_contacto: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmail: true,
        len: [0, 100]
      }
    },
    notas_adicionales: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 1000]
      }
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'America/Mexico_City',
      comment: 'Zona horaria de la ciudad (formato IANA, ej: America/Mexico_City, America/Bogota)'
    },
    max_pedidos_por_horario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      validate: {
        min: 1,
        max: 100
      },
      comment: 'Máximo número de pedidos por horario de entrega (mañana o tarde)'
    },
    dias_trabajo: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [0, 1, 2, 3, 4, 5, 6],
      comment: 'Array de días de la semana que trabajan entregas (0=domingo, 6=sábado)',
      validate: {
        isValidDiasTrabajo(value) {
          if (value !== null && value !== undefined) {
            if (!Array.isArray(value)) {
              throw new Error('dias_trabajo debe ser un array');
            }
            if (value.length === 0) {
              throw new Error('dias_trabajo debe contener al menos un día');
            }
            const validDays = [0, 1, 2, 3, 4, 5, 6];
            for (const day of value) {
              if (!validDays.includes(day)) {
                throw new Error('dias_trabajo debe contener solo valores entre 0 y 6');
              }
            }
          }
        }
      }
    },
    baja_logica: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    tableName: 'cities',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false, // No usar soft delete por defecto, usamos baja_logica
    indexes: [
      {
        fields: ['departamento']
      },
      {
        fields: ['estado_inicial']
      },
      {
        fields: ['baja_logica']
      },
      {
        fields: ['nombre', 'departamento'],
        unique: true
      }
    ]
  });

  // Métodos de instancia
  City.prototype.softDelete = function() {
    this.baja_logica = true;
    return this.save();
  };

  City.prototype.restore = function() {
    this.baja_logica = false;
    return this.save();
  };

  City.prototype.activate = function() {
    this.estado_inicial = 'activa';
    return this.save();
  };

  City.prototype.deactivate = function() {
    this.estado_inicial = 'inactiva';
    return this.save();
  };

  // Método helper para obtener días de trabajo
  City.prototype.getDiasTrabajo = function() {
    if (!this.dias_trabajo || !Array.isArray(this.dias_trabajo) || this.dias_trabajo.length === 0) {
      // Por defecto, todos los días
      return [0, 1, 2, 3, 4, 5, 6];
    }
    return this.dias_trabajo;
  };

  // Método helper para obtener máximo de pedidos por horario
  City.prototype.getMaxPedidosPorHorario = function() {
    return this.max_pedidos_por_horario || 5;
  };

  // Métodos estáticos
  City.findByDepartment = function(departamento) {
    return this.findAll({
      where: { 
        departamento,
        baja_logica: false
      },
      order: [['nombre', 'ASC']]
    });
  };

  City.findByStatus = function(estado_inicial) {
    return this.findAll({
      where: { 
        estado_inicial,
        baja_logica: false
      },
      order: [['nombre', 'ASC']]
    });
  };

  City.findActive = function() {
    return this.findAll({
      where: { 
        baja_logica: false,
        estado_inicial: 'activa'
      },
      order: [['departamento', 'ASC'], ['nombre', 'ASC']]
    });
  };

  City.findDeleted = function() {
    return this.findAll({
      where: { baja_logica: true },
      order: [['updated_at', 'DESC']]
    });
  };

  City.findByNameAndDepartment = function(nombre, departamento) {
    return this.findOne({
      where: { 
        nombre,
        departamento,
        baja_logica: false
      }
    });
  };

  // Scope para consultas comunes
  City.addScope('active', {
    where: { 
      baja_logica: false,
      estado_inicial: 'activa'
    }
  });

  City.addScope('inactive', {
    where: { 
      baja_logica: false,
      estado_inicial: { [Op.ne]: 'activa' }
    }
  });

  City.addScope('deleted', {
    where: { baja_logica: true }
  });

  City.addScope('byDepartment', (departamento) => ({
    where: { 
      departamento,
      baja_logica: false
    }
  }));

  City.addScope('byStatus', (estado_inicial) => ({
    where: { 
      estado_inicial,
      baja_logica: false
    }
  }));

  return City;
};
