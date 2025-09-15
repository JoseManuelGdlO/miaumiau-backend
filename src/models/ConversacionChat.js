module.exports = (sequelize, DataTypes) => {
  const ConversacionChat = sequelize.define('ConversacionChat', {
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
    from: {
      type: DataTypes.ENUM('usuario', 'bot', 'agente', 'sistema'),
      allowNull: false,
      defaultValue: 'usuario'
    },
    mensaje: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [1, 5000],
        notEmpty: true
      }
    },
    tipo_mensaje: {
      type: DataTypes.ENUM('texto', 'imagen', 'archivo', 'audio', 'video', 'ubicacion', 'contacto'),
      allowNull: false,
      defaultValue: 'texto'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Información adicional del mensaje (URLs, tamaños, etc.)'
    },
    leido: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    baja_logica: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    tableName: 'conversaciones_chat',
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
        fields: ['from']
      },
      {
        fields: ['tipo_mensaje']
      },
      {
        fields: ['leido']
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
  ConversacionChat.prototype.softDelete = function() {
    this.baja_logica = true;
    return this.save();
  };

  ConversacionChat.prototype.restore = function() {
    this.baja_logica = false;
    return this.save();
  };

  ConversacionChat.prototype.markAsRead = function() {
    this.leido = true;
    return this.save();
  };

  ConversacionChat.prototype.markAsUnread = function() {
    this.leido = false;
    return this.save();
  };

  ConversacionChat.prototype.updateMessage = function(newMessage) {
    this.mensaje = newMessage;
    return this.save();
  };

  ConversacionChat.prototype.addMetadata = function(metadata) {
    const currentMetadata = this.metadata || {};
    this.metadata = { ...currentMetadata, ...metadata };
    return this.save();
  };

  // Métodos estáticos
  ConversacionChat.findByConversation = function(conversacionId) {
    return this.findAll({
      where: { 
        fkid_conversacion: conversacionId,
        baja_logica: false
      },
      order: [['created_at', 'ASC']]
    });
  };

  ConversacionChat.findByFrom = function(from) {
    return this.findAll({
      where: { 
        from: from,
        baja_logica: false
      },
      order: [['created_at', 'DESC']]
    });
  };

  ConversacionChat.findByMessageType = function(tipoMensaje) {
    return this.findAll({
      where: { 
        tipo_mensaje: tipoMensaje,
        baja_logica: false
      },
      order: [['created_at', 'DESC']]
    });
  };

  ConversacionChat.findUnread = function(conversacionId = null) {
    const whereClause = { 
      leido: false,
      baja_logica: false
    };
    
    if (conversacionId) {
      whereClause.fkid_conversacion = conversacionId;
    }
    
    return this.findAll({
      where: whereClause,
      order: [['created_at', 'ASC']]
    });
  };

  ConversacionChat.findByDate = function(fecha) {
    return this.findAll({
      where: { 
        fecha: fecha,
        baja_logica: false
      },
      order: [['hora', 'ASC']]
    });
  };

  ConversacionChat.findByDateRange = function(startDate, endDate) {
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

  ConversacionChat.searchMessages = function(searchTerm, conversacionId = null) {
    const whereClause = { 
      mensaje: {
        [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%`
      },
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

  ConversacionChat.getChatStats = function(conversacionId = null) {
    const whereClause = { baja_logica: false };
    
    if (conversacionId) {
      whereClause.fkid_conversacion = conversacionId;
    }
    
    return this.findAll({
      attributes: [
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total_mensajes'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN from = "usuario" THEN 1 END')), 'mensajes_usuario'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN from = "bot" THEN 1 END')), 'mensajes_bot'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN from = "agente" THEN 1 END')), 'mensajes_agente'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN leido = false THEN 1 END')), 'mensajes_no_leidos']
      ],
      where: whereClause
    });
  };

  ConversacionChat.getMessagesByType = function(conversacionId = null) {
    const whereClause = { baja_logica: false };
    
    if (conversacionId) {
      whereClause.fkid_conversacion = conversacionId;
    }
    
    return this.findAll({
      attributes: [
        'tipo_mensaje',
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total']
      ],
      where: whereClause,
      group: ['tipo_mensaje'],
      order: [[sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'DESC']]
    });
  };

  ConversacionChat.getRecentMessages = function(limit = 10, conversacionId = null) {
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

  ConversacionChat.getMessagesByHour = function(fecha) {
    return this.findAll({
      attributes: [
        [sequelize.Sequelize.fn('EXTRACT', sequelize.Sequelize.literal('HOUR FROM hora')), 'hora'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total_mensajes']
      ],
      where: { 
        fecha: fecha,
        baja_logica: false
      },
      group: [sequelize.Sequelize.fn('EXTRACT', sequelize.Sequelize.literal('HOUR FROM hora'))],
      order: [[sequelize.Sequelize.fn('EXTRACT', sequelize.Sequelize.literal('HOUR FROM hora')), 'ASC']]
    });
  };

  return ConversacionChat;
};
