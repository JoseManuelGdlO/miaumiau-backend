module.exports = (sequelize, DataTypes) => {
  const AgenteConversacion = sequelize.define('AgenteConversacion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    fkid_agente: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'agentes',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    fkid_conversacion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'conversaciones',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    fecha_asignacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    rendimiento: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0,
        max: 5
      }
    },
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'agentes_conversaciones',
    timestamps: true,
    indexes: [
      {
        fields: ['fkid_agente']
      },
      {
        fields: ['fkid_conversacion']
      },
      {
        fields: ['fecha_asignacion']
      },
      {
        fields: ['rendimiento']
      }
    ]
  });

  // Métodos de instancia
  AgenteConversacion.prototype.tieneFeedback = function() {
    return this.feedback !== null && this.feedback.trim() !== '';
  };

  AgenteConversacion.prototype.tieneRendimiento = function() {
    return this.rendimiento > 0;
  };

  AgenteConversacion.prototype.rendimientoAlto = function() {
    return this.rendimiento >= 4.0;
  };

  AgenteConversacion.prototype.rendimientoMedio = function() {
    return this.rendimiento >= 2.0 && this.rendimiento < 4.0;
  };

  AgenteConversacion.prototype.rendimientoBajo = function() {
    return this.rendimiento < 2.0;
  };

  AgenteConversacion.prototype.actualizarRendimiento = function(nuevoRendimiento, feedback = null) {
    this.rendimiento = nuevoRendimiento;
    if (feedback) {
      this.feedback = feedback;
    }
    return this.save();
  };

  // Métodos estáticos
  AgenteConversacion.findByAgente = function(agenteId) {
    return this.findAll({
      where: {
        fkid_agente: agenteId
      },
      order: [['fecha_asignacion', 'DESC']]
    });
  };

  AgenteConversacion.findByConversacion = function(conversacionId) {
    return this.findAll({
      where: {
        fkid_conversacion: conversacionId
      },
      order: [['fecha_asignacion', 'DESC']]
    });
  };

  AgenteConversacion.findConRendimiento = function(minRendimiento = 0) {
    return this.findAll({
      where: {
        rendimiento: {
          [sequelize.Sequelize.Op.gte]: minRendimiento
        }
      },
      order: [['rendimiento', 'DESC'], ['fecha_asignacion', 'DESC']]
    });
  };

  AgenteConversacion.obtenerEstadisticasAgente = function(agenteId) {
    return this.findAll({
      where: {
        fkid_agente: agenteId
      },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_conversaciones'],
        [sequelize.fn('AVG', sequelize.col('rendimiento')), 'rendimiento_promedio'],
        [sequelize.fn('MAX', sequelize.col('rendimiento')), 'rendimiento_maximo'],
        [sequelize.fn('MIN', sequelize.col('rendimiento')), 'rendimiento_minimo']
      ]
    });
  };

  AgenteConversacion.obtenerEstadisticasGenerales = function() {
    return this.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_asignaciones'],
        [sequelize.fn('AVG', sequelize.col('rendimiento')), 'rendimiento_promedio_general'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN rendimiento >= 4.0 THEN 1 END')), 'rendimiento_alto'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN rendimiento >= 2.0 AND rendimiento < 4.0 THEN 1 END')), 'rendimiento_medio'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN rendimiento < 2.0 THEN 1 END')), 'rendimiento_bajo']
      ]
    });
  };

  return AgenteConversacion;
};
