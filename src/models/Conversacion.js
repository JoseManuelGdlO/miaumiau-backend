module.exports = (sequelize, DataTypes) => {
  const Conversacion = sequelize.define('Conversacion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    from: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [2, 100],
        notEmpty: true
      }
    },
    status: {
      type: DataTypes.ENUM('activa', 'pausada', 'cerrada', 'en_espera'),
      allowNull: false,
      defaultValue: 'activa'
    },
    id_cliente: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'clientes',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    id_pedido: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'pedidos',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    whatsapp_phone_number_id: {
      type: DataTypes.STRING(64),
      allowNull: true,
      defaultValue: "990229367500305", // por ahora
      validate: {
        len: [1, 64]
      }
    },
    tipo_usuario: {
      type: DataTypes.ENUM('cliente', 'agente', 'bot', 'sistema'),
      allowNull: false,
      defaultValue: 'cliente'
    },
    baja_logica: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    tableName: 'conversaciones',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        fields: ['from']
      },
      {
        fields: ['status']
      },
      {
        fields: ['id_cliente']
      },
      {
        fields: ['id_pedido']
      },
      {
        fields: ['whatsapp_phone_number_id']
      },
      {
        fields: ['tipo_usuario']
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
  Conversacion.prototype.softDelete = function() {
    this.baja_logica = true;
    return this.save();
  };

  Conversacion.prototype.restore = function() {
    this.baja_logica = false;
    return this.save();
  };

  Conversacion.prototype.activate = function() {
    this.status = 'activa';
    return this.save();
  };

  Conversacion.prototype.pause = function() {
    this.status = 'pausada';
    return this.save();
  };

  Conversacion.prototype.close = function() {
    this.status = 'cerrada';
    return this.save();
  };

  Conversacion.prototype.wait = function() {
    this.status = 'en_espera';
    return this.save();
  };

  Conversacion.prototype.assignToClient = function(clientId) {
    this.id_cliente = clientId;
    return this.save();
  };

  Conversacion.prototype.changeUserType = function(userType) {
    this.tipo_usuario = userType;
    return this.save();
  };

  // Métodos estáticos
  Conversacion.findByStatus = function(status) {
    return this.findAll({
      where: { 
        status: status,
        baja_logica: false
      },
      order: [['created_at', 'DESC']]
    });
  };

  Conversacion.findByClient = function(clientId) {
    return this.findAll({
      where: { 
        id_cliente: clientId,
        baja_logica: false
      },
      order: [['created_at', 'DESC']]
    });
  };

  Conversacion.findByUserType = function(userType) {
    return this.findAll({
      where: { 
        tipo_usuario: userType,
        baja_logica: false
      },
      order: [['created_at', 'DESC']]
    });
  };

  Conversacion.findActive = function() {
    return this.findAll({
      where: { 
        status: 'activa',
        baja_logica: false
      },
      order: [['created_at', 'DESC']]
    });
  };

  Conversacion.findByFrom = function(from) {
    return this.findAll({
      where: { 
        from: {
          [sequelize.Sequelize.Op.iLike]: `%${from}%`
        },
        baja_logica: false
      },
      order: [['created_at', 'DESC']]
    });
  };

  Conversacion.findByDateRange = function(startDate, endDate) {
    return this.findAll({
      where: { 
        created_at: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        },
        baja_logica: false
      },
      order: [['created_at', 'DESC']]
    });
  };

  Conversacion.getConversationStats = function() {
    return this.findAll({
      attributes: [
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total_conversaciones'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN status = "activa" THEN 1 END')), 'conversaciones_activas'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN status = "cerrada" THEN 1 END')), 'conversaciones_cerradas'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN status = "pausada" THEN 1 END')), 'conversaciones_pausadas'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN status = "en_espera" THEN 1 END')), 'conversaciones_en_espera']
      ],
      where: { baja_logica: false }
    });
  };

  Conversacion.getConversationsByUserType = function() {
    return this.findAll({
      attributes: [
        'tipo_usuario',
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'total']
      ],
      where: { baja_logica: false },
      group: ['tipo_usuario'],
      order: [[sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'DESC']]
    });
  };

  Conversacion.getRecentConversations = function(limit = 10) {
    return this.findAll({
      where: { baja_logica: false },
      order: [['created_at', 'DESC']],
      limit: limit
    });
  };

  return Conversacion;
};
