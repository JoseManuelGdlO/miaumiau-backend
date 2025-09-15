module.exports = (sequelize, DataTypes) => {
  const ConversacionLog = sequelize.define('ConversacionLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
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
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    hora: {
      type: DataTypes.TIME,
      allowNull: false
    },
    data: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: 'Datos del log en formato JSON'
    },
    tipo_log: {
      type: DataTypes.ENUM('inicio', 'mensaje', 'transferencia', 'escalacion', 'cierre', 'error', 'sistema'),
      allowNull: false,
      defaultValue: 'sistema'
    },
    nivel: {
      type: DataTypes.ENUM('info', 'warning', 'error', 'debug'),
      allowNull: false,
      defaultValue: 'info'
    },
    descripcion: {
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
    tableName: 'conversaciones_logs',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        fields: ['fkid_conversacion']
      },
      {
        fields: ['fecha']
      },
      {
        fields: ['hora']
      },
      {
        fields: ['tipo_log']
      },
      {
        fields: ['nivel']
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
  ConversacionLog.prototype.softDelete = function() {
    this.baja_logica = true;
    return this.save();
  };

  ConversacionLog.prototype.restore = function() {
    this.baja_logica = false;
    return this.save();
  };

  ConversacionLog.prototype.updateData = function(newData) {
    const currentData = this.data || {};
    this.data = { ...currentData, ...newData };
    return this.save();
  };

  ConversacionLog.prototype.addToData = function(key, value) {
    const currentData = this.data || {};
    currentData[key] = value;
    this.data = currentData;
    return this.save();
  };

  ConversacionLog.prototype.updateDescription = function(description) {
    this.descripcion = description;
    return this.save();
  };

  ConversacionLog.prototype.changeLevel = function(level) {
    this.nivel = level;
    return this.save();
  };

  // Métodos estáticos
  ConversacionLog.findByConversation = function(conversacionId) {
    return this.findAll({
      where: { 
        fkid_conversacion: conversacionId,
        baja_logica: false
      },
      order: [['created_at', 'ASC']]
    });
  };

  ConversacionLog.findByType = function(tipoLog) {
    return this.findAll({
      where: { 
        tipo_log: tipoLog,
        baja_logica: false
      },
      order: [['created_at', 'DESC']]
    });
  };

  ConversacionLog.findByLevel = function(nivel) {
    return this.findAll({
      where: { 
        nivel: nivel,
        baja_logica: false
      },
      order: [['created_at', 'DESC']]
    });
  };

  ConversacionLog.findByDate = function(fecha) {
    return this.findAll({
      where: { 
        fecha: fecha,
        baja_logica: false
      },
      order: [['hora', 'ASC']]
    });
  };

  ConversacionLog.findByDateRange = function(startDate, endDate) {
    return this.findAll({
      where: { 
        fecha: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        },
        baja_logica: false
      },
      order: [['fecha', 'ASC'], ['hora', 'ASC']]
    });
  };

  ConversacionLog.findErrors = function(conversacionId = null) {
    const whereClause = { 
      nivel: 'error',
      baja_logica: false
    };
    
    if (conversacionId) {
      whereClause.fkid_conversacion = conversacionId;
    }
    
    return this.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']]
    });
  };

  ConversacionLog.findWarnings = function(conversacionId = null) {
    const whereClause = { 
      nivel: 'warning',
      baja_logica: false
    };
    
    if (conversacionId) {
      whereClause.fkid_conversacion = conversacionId;
    }
    
    return this.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']]
    });
  };

  ConversacionLog.searchInData = function(searchKey, searchValue, conversacionId = null) {
    const whereClause = { 
      baja_logica: false
    };
    
    if (conversacionId) {
      whereClause.fkid_conversacion = conversacionId;
    }
    
    // Buscar en el campo JSON data
    whereClause[`data.${searchKey}`] = searchValue;
    
    return this.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']]
    });
  };

  ConversacionLog.getLogStats = function(conversacionId = null) {
    const whereClause = { baja_logica: false };
    
    if (conversacionId) {
      whereClause.fkid_conversacion = conversacionId;
    }
    
    return this.findAll({
      attributes: [
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total_logs'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN nivel = "info" THEN 1 END')), 'logs_info'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN nivel = "warning" THEN 1 END')), 'logs_warning'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN nivel = "error" THEN 1 END')), 'logs_error'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN nivel = "debug" THEN 1 END')), 'logs_debug']
      ],
      where: whereClause
    });
  };

  ConversacionLog.getLogsByType = function(conversacionId = null) {
    const whereClause = { baja_logica: false };
    
    if (conversacionId) {
      whereClause.fkid_conversacion = conversacionId;
    }
    
    return this.findAll({
      attributes: [
        'tipo_log',
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total']
      ],
      where: whereClause,
      group: ['tipo_log'],
      order: [[sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'DESC']]
    });
  };

  ConversacionLog.getLogsByLevel = function(conversacionId = null) {
    const whereClause = { baja_logica: false };
    
    if (conversacionId) {
      whereClause.fkid_conversacion = conversacionId;
    }
    
    return this.findAll({
      attributes: [
        'nivel',
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total']
      ],
      where: whereClause,
      group: ['nivel'],
      order: [[sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'DESC']]
    });
  };

  ConversacionLog.getRecentLogs = function(limit = 10, conversacionId = null) {
    const whereClause = { baja_logica: false };
    
    if (conversacionId) {
      whereClause.fkid_conversacion = conversacionId;
    }
    
    return this.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: limit
    });
  };

  ConversacionLog.getLogsByHour = function(fecha) {
    return this.findAll({
      attributes: [
        [sequelize.Sequelize.fn('EXTRACT', sequelize.Sequelize.literal('HOUR FROM hora')), 'hora'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total_logs']
      ],
      where: { 
        fecha: fecha,
        baja_logica: false
      },
      group: [sequelize.Sequelize.fn('EXTRACT', sequelize.Sequelize.literal('HOUR FROM hora'))],
      order: [[sequelize.Sequelize.fn('EXTRACT', sequelize.Sequelize.literal('HOUR FROM hora')), 'ASC']]
    });
  };

  ConversacionLog.createLog = function(conversacionId, data, tipoLog = 'sistema', nivel = 'info', descripcion = null) {
    return this.create({
      fkid_conversacion: conversacionId,
      data: data,
      tipo_log: tipoLog,
      nivel: nivel,
      descripcion: descripcion
    });
  };

  return ConversacionLog;
};
