module.exports = (sequelize, DataTypes) => {
  const Notificacion = sequelize.define('Notificacion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    prioridad: {
      type: DataTypes.ENUM('baja', 'media', 'alta', 'urgente'),
      allowNull: false,
      defaultValue: 'media'
    },
    leida: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    fecha_creacion: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    hora_creacion: {
      type: DataTypes.TIME,
      allowNull: false
    },
    datos: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    tableName: 'notificaciones',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        fields: ['prioridad']
      },
      {
        fields: ['leida']
      },
      {
        fields: ['fecha_creacion']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  // Hooks para establecer fecha_creacion y hora_creacion automáticamente
  Notificacion.beforeCreate((notificacion, options) => {
    const now = new Date();
    if (!notificacion.fecha_creacion) {
      notificacion.fecha_creacion = now.toISOString().split('T')[0]; // YYYY-MM-DD
    }
    if (!notificacion.hora_creacion) {
      const timeString = now.toTimeString().split(' ')[0]; // HH:mm:ss
      notificacion.hora_creacion = timeString;
    }
  });

  // Métodos de instancia
  Notificacion.prototype.marcarComoLeida = function() {
    this.leida = true;
    return this.save();
  };

  Notificacion.prototype.marcarComoNoLeida = function() {
    this.leida = false;
    return this.save();
  };

  // Métodos estáticos
  Notificacion.findByPrioridad = function(prioridad) {
    return this.findAll({
      where: { prioridad: prioridad },
      order: [['created_at', 'DESC']]
    });
  };

  Notificacion.findLeidas = function() {
    return this.findAll({
      where: { leida: true },
      order: [['created_at', 'DESC']]
    });
  };

  Notificacion.findNoLeidas = function() {
    return this.findAll({
      where: { leida: false },
      order: [['created_at', 'DESC']]
    });
  };

  Notificacion.findByFecha = function(fecha) {
    return this.findAll({
      where: { fecha_creacion: fecha },
      order: [['hora_creacion', 'DESC']]
    });
  };

  Notificacion.findByFechaRange = function(fechaInicio, fechaFin) {
    return this.findAll({
      where: {
        fecha_creacion: {
          [sequelize.Sequelize.Op.between]: [fechaInicio, fechaFin]
        }
      },
      order: [['fecha_creacion', 'DESC'], ['hora_creacion', 'DESC']]
    });
  };

  Notificacion.findUrgentes = function() {
    return this.findAll({
      where: {
        prioridad: 'urgente',
        leida: false
      },
      order: [['created_at', 'DESC']]
    });
  };

  Notificacion.getStats = function() {
    return this.findAll({
      attributes: [
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total_notificaciones'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN leida = false THEN 1 END')), 'no_leidas'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN prioridad = "urgente" AND leida = false THEN 1 END')), 'urgentes_no_leidas']
      ]
    });
  };

  Notificacion.getRecent = function(limit = 10) {
    return this.findAll({
      order: [['created_at', 'DESC']],
      limit: limit
    });
  };

  return Notificacion;
};

