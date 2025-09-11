module.exports = (sequelize, DataTypes) => {
  const PromotionCity = sequelize.define('PromotionCity', {
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
    city_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'cities',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    }
  }, {
    tableName: 'promotion_cities',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['promotion_id', 'city_id']
      },
      {
        fields: ['promotion_id']
      },
      {
        fields: ['city_id']
      }
    ]
  });

  // Métodos estáticos
  PromotionCity.findByPromotion = function(promotionId) {
    return this.findAll({
      where: { promotion_id: promotionId },
      include: [
        {
          model: sequelize.models.City,
          as: 'city'
        }
      ]
    });
  };

  PromotionCity.findByCity = function(cityId) {
    return this.findAll({
      where: { city_id: cityId },
      include: [
        {
          model: sequelize.models.Promotion,
          as: 'promotion'
        }
      ]
    });
  };

  PromotionCity.assignPromotionToCity = async function(promotionId, cityId) {
    const [promotionCity, created] = await this.findOrCreate({
      where: {
        promotion_id: promotionId,
        city_id: cityId
      }
    });
    return { promotionCity, created };
  };

  PromotionCity.removePromotionFromCity = async function(promotionId, cityId) {
    return await this.destroy({
      where: {
        promotion_id: promotionId,
        city_id: cityId
      }
    });
  };

  PromotionCity.syncPromotionCities = async function(promotionId, cityIds) {
    // Eliminar todas las asignaciones actuales de la promoción
    await this.destroy({
      where: { promotion_id: promotionId }
    });

    // Crear las nuevas asignaciones
    if (cityIds && cityIds.length > 0) {
      const promotionCities = cityIds.map(cityId => ({
        promotion_id: promotionId,
        city_id: cityId
      }));
      
      await this.bulkCreate(promotionCities);
    }
  };

  return PromotionCity;
};
