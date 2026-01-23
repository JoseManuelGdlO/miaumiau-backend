module.exports = (sequelize, DataTypes) => {
  const ConversacionFlagAsignacion = sequelize.define('ConversacionFlagAsignacion', {
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
    fkid_flag: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'conversaciones_flags',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    }
  }, {
    tableName: 'conversaciones_flags_asignaciones',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        fields: ['fkid_conversacion']
      },
      {
        fields: ['fkid_flag']
      },
      {
        fields: ['fkid_conversacion', 'fkid_flag'],
        unique: true,
        name: 'unique_conversacion_flag'
      },
      {
        fields: ['created_at']
      }
    ]
  });

  // Métodos estáticos
  ConversacionFlagAsignacion.findByConversacion = function(conversacionId) {
    return this.findAll({
      where: {
        fkid_conversacion: conversacionId
      },
      order: [['created_at', 'DESC']]
    });
  };

  ConversacionFlagAsignacion.findByFlag = function(flagId) {
    return this.findAll({
      where: {
        fkid_flag: flagId
      },
      order: [['created_at', 'DESC']]
    });
  };

  ConversacionFlagAsignacion.findByConversacionAndFlag = function(conversacionId, flagId) {
    return this.findOne({
      where: {
        fkid_conversacion: conversacionId,
        fkid_flag: flagId
      }
    });
  };

  ConversacionFlagAsignacion.removeByConversacionAndFlag = function(conversacionId, flagId) {
    return this.destroy({
      where: {
        fkid_conversacion: conversacionId,
        fkid_flag: flagId
      }
    });
  };

  return ConversacionFlagAsignacion;
};
