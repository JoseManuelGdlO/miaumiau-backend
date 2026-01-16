module.exports = (sequelize, DataTypes) => {
  const PromotionUsage = sequelize.define('PromotionUsage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    promotion_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'promotions',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    telefono: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [7, 20]
      }
    },
    fkid_cliente: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'clientes',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    fkid_pedido: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'pedidos',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    }
  }, {
    tableName: 'promotion_usages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false,
    indexes: [
      {
        fields: ['promotion_id']
      },
      {
        fields: ['telefono']
      },
      {
        fields: ['promotion_id', 'telefono']
      },
      {
        fields: ['fkid_pedido']
      },
      {
        fields: ['fkid_cliente']
      }
    ]
  });

  // Métodos estáticos
  PromotionUsage.countByPromotionAndTelefono = async function(promotionId, telefono) {
    return await this.count({
      where: {
        promotion_id: promotionId,
        telefono: telefono
      }
    });
  };

  PromotionUsage.getUsageByPromotion = async function(promotionId) {
    return await this.findAll({
      where: {
        promotion_id: promotionId
      },
      attributes: [
        'telefono',
        [sequelize.fn('COUNT', sequelize.col('id')), 'veces_usado'],
        [sequelize.fn('MAX', sequelize.col('created_at')), 'ultimo_uso']
      ],
      group: ['telefono'],
      order: [[sequelize.literal('veces_usado'), 'DESC']]
    });
  };

  PromotionUsage.getUsageByTelefono = async function(telefono) {
    return await this.findAll({
      where: {
        telefono: telefono
      },
      include: [
        {
          model: sequelize.models.Promotion,
          as: 'promotion',
          attributes: ['id', 'nombre', 'codigo']
        }
      ],
      order: [['created_at', 'DESC']]
    });
  };

  return PromotionUsage;
};
