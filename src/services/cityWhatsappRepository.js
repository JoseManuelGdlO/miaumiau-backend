const { Op } = require('sequelize');

function createCityWhatsappRepository(model) {
  return {
    findByInviteHash(hash, transaction) {
      return model.findOne({ where: { invite_token_hash: hash }, transaction });
    },
    findByPhoneNumberId(phoneNumberId, transaction) {
      return model.findOne({ where: { phone_number_id: phoneNumberId }, transaction });
    },
    findByCityId(cityId, transaction) {
      return model.findOne({ where: { city_id: cityId }, transaction });
    },
    findByCityIds(cityIds, transaction) {
      if (!cityIds.length) return Promise.resolve([]);
      return model.findAll({ where: { city_id: { [Op.in]: cityIds } }, transaction });
    },
    create(row, transaction) {
      return model.create(row, { transaction });
    },
    async update(id, patch, transaction) {
      await model.update(patch, { where: { id }, transaction });
      return model.findOne({ where: { id }, transaction });
    },
    destroyByCityId(cityId, transaction) {
      return model.destroy({ where: { city_id: cityId }, transaction });
    }
  };
}

module.exports = { createCityWhatsappRepository };
