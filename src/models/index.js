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
const Peso = require('./Peso');
const CategoriaProducto = require('./CategoriaProducto');
const Proveedor = require('./Proveedor');
const Inventario = require('./Inventario');
const Conversacion = require('./Conversacion');
const ConversacionChat = require('./ConversacionChat');
const ConversacionLog = require('./ConversacionLog');
const Pedido = require('./Pedido');
const ProductoPedido = require('./ProductoPedido');

// Inicializar modelos
const models = {
  User: User(sequelize, DataTypes),
  Permission: Permission(sequelize, DataTypes),
  Role: Role(sequelize, DataTypes),
  RolePermission: RolePermission(sequelize, DataTypes),
  City: City(sequelize, DataTypes),
  Promotion: Promotion(sequelize, DataTypes),
  PromotionCity: PromotionCity(sequelize, DataTypes),
  Peso: Peso(sequelize, DataTypes),
  CategoriaProducto: CategoriaProducto(sequelize, DataTypes),
  Proveedor: Proveedor(sequelize, DataTypes),
  Inventario: Inventario(sequelize, DataTypes),
  Conversacion: Conversacion(sequelize, DataTypes),
  ConversacionChat: ConversacionChat(sequelize, DataTypes),
  ConversacionLog: ConversacionLog(sequelize, DataTypes),
  Pedido: Pedido(sequelize, DataTypes),
  ProductoPedido: ProductoPedido(sequelize, DataTypes)
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

// Asociaciones para Inventario
models.Inventario.belongsTo(models.Peso, {
  foreignKey: 'fkid_peso',
  as: 'peso'
});

models.Inventario.belongsTo(models.CategoriaProducto, {
  foreignKey: 'fkid_categoria',
  as: 'categoria'
});

models.Inventario.belongsTo(models.City, {
  foreignKey: 'fkid_ciudad',
  as: 'ciudad'
});

models.Inventario.belongsTo(models.Proveedor, {
  foreignKey: 'fkid_proveedor',
  as: 'proveedor'
});

// Asociaciones inversas
models.Peso.hasMany(models.Inventario, {
  foreignKey: 'fkid_peso',
  as: 'inventarios'
});

models.CategoriaProducto.hasMany(models.Inventario, {
  foreignKey: 'fkid_categoria',
  as: 'inventarios'
});

models.City.hasMany(models.Inventario, {
  foreignKey: 'fkid_ciudad',
  as: 'inventarios'
});

models.Proveedor.hasMany(models.Inventario, {
  foreignKey: 'fkid_proveedor',
  as: 'inventarios'
});

// Asociaciones para Conversaciones
models.Conversacion.belongsTo(models.User, {
  foreignKey: 'id_cliente',
  as: 'cliente'
});

models.Conversacion.hasMany(models.ConversacionChat, {
  foreignKey: 'fkid_conversacion',
  as: 'chats'
});

models.Conversacion.hasMany(models.ConversacionLog, {
  foreignKey: 'fkid_conversacion',
  as: 'logs'
});

// Asociaciones para ConversacionChat
models.ConversacionChat.belongsTo(models.Conversacion, {
  foreignKey: 'fkid_conversacion',
  as: 'conversacion'
});

// Asociaciones para ConversacionLog
models.ConversacionLog.belongsTo(models.Conversacion, {
  foreignKey: 'fkid_conversacion',
  as: 'conversacion'
});

// Asociaciones inversas
models.User.hasMany(models.Conversacion, {
  foreignKey: 'id_cliente',
  as: 'conversaciones'
});

// Asociaciones para Pedidos
models.Pedido.belongsTo(models.User, {
  foreignKey: 'fkid_cliente',
  as: 'cliente'
});

models.Pedido.belongsTo(models.City, {
  foreignKey: 'fkid_ciudad',
  as: 'ciudad'
});

models.Pedido.hasMany(models.ProductoPedido, {
  foreignKey: 'fkid_pedido',
  as: 'productos'
});

// Asociaciones para ProductoPedido
models.ProductoPedido.belongsTo(models.Pedido, {
  foreignKey: 'fkid_pedido',
  as: 'pedido'
});

models.ProductoPedido.belongsTo(models.Inventario, {
  foreignKey: 'fkid_producto',
  as: 'producto'
});

// Asociaciones inversas
models.User.hasMany(models.Pedido, {
  foreignKey: 'fkid_cliente',
  as: 'pedidos'
});

models.City.hasMany(models.Pedido, {
  foreignKey: 'fkid_ciudad',
  as: 'pedidos'
});

models.Inventario.hasMany(models.ProductoPedido, {
  foreignKey: 'fkid_producto',
  as: 'productos_pedido'
});

models.sequelize = sequelize;
models.Sequelize = require('sequelize');

module.exports = models;
