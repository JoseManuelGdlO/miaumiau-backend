const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

// Importar modelos
const User = require('./User');
const Permission = require('./Permission');
const Role = require('./Role');
const RolePermission = require('./RolePermission');
const City = require('./City');
const Promotion = require('./Promotion');
const PromotionCity = require('./PromotionCity');

// Inicializar modelos
const models = {
  User: User(sequelize, DataTypes),
  Permission: Permission(sequelize, DataTypes),
  Role: Role(sequelize, DataTypes),
  RolePermission: RolePermission(sequelize, DataTypes),
  City: City(sequelize, DataTypes),
  Promotion: Promotion(sequelize, DataTypes),
  PromotionCity: PromotionCity(sequelize, DataTypes)
};

// Definir asociaciones
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// Asociaciones Many-to-Many entre Role y Permission
models.Role.belongsToMany(models.Permission, {
  through: models.RolePermission,
  foreignKey: 'role_id',
  otherKey: 'permission_id',
  as: 'permissions'
});

models.Permission.belongsToMany(models.Role, {
  through: models.RolePermission,
  foreignKey: 'permission_id',
  otherKey: 'role_id',
  as: 'roles'
});

// Asociaciones para RolePermission
models.RolePermission.belongsTo(models.Role, {
  foreignKey: 'role_id',
  as: 'role'
});

models.RolePermission.belongsTo(models.Permission, {
  foreignKey: 'permission_id',
  as: 'permission'
});

// Asociaciones para User
models.User.belongsTo(models.Role, {
  foreignKey: 'rol_id',
  as: 'rol'
});

models.User.belongsTo(models.City, {
  foreignKey: 'ciudad_id',
  as: 'ciudad'
});

// Asociaciones inversas
models.Role.hasMany(models.User, {
  foreignKey: 'rol_id',
  as: 'usuarios'
});

models.City.hasMany(models.User, {
  foreignKey: 'ciudad_id',
  as: 'usuarios'
});

// Asociaciones para Promotion
models.Promotion.belongsToMany(models.City, {
  through: models.PromotionCity,
  foreignKey: 'promotion_id',
  otherKey: 'city_id',
  as: 'ciudades'
});

models.City.belongsToMany(models.Promotion, {
  through: models.PromotionCity,
  foreignKey: 'city_id',
  otherKey: 'promotion_id',
  as: 'promociones'
});

// Asociaciones para PromotionCity
models.PromotionCity.belongsTo(models.Promotion, {
  foreignKey: 'promotion_id',
  as: 'promotion'
});

models.PromotionCity.belongsTo(models.City, {
  foreignKey: 'city_id',
  as: 'city'
});

models.sequelize = sequelize;
models.Sequelize = require('sequelize');

module.exports = models;
