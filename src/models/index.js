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
const PromotionUsage = require('./PromotionUsage');
const Peso = require('./Peso');
const CategoriaProducto = require('./CategoriaProducto');
const Proveedor = require('./Proveedor');
const Inventario = require('./Inventario');
const Conversacion = require('./Conversacion');
const ConversacionChat = require('./ConversacionChat');
const ConversacionLog = require('./ConversacionLog');
const ConversacionFlag = require('./ConversacionFlag');
const ConversacionFlagAsignacion = require('./ConversacionFlagAsignacion');
const Pedido = require('./Pedido');
const ProductoPedido = require('./ProductoPedido');
const Cliente = require('./Cliente');
const Mascota = require('./Mascota');
const Ruta = require('./Ruta');
const RutaPedido = require('./RutaPedido');
const Agente = require('./Agente');
const AgenteConversacion = require('./AgenteConversacion');
const Repartidor = require('./Repartidor');
const Notificacion = require('./Notificacion');
const Paquete = require('./Paquete');
const ProductoPaquete = require('./ProductoPaquete');
const PaquetePedido = require('./PaquetePedido');
const WhatsAppPhoneNumber = require('./WhatsAppPhoneNumber');

// Inicializar modelos
const models = {
  User: User(sequelize, DataTypes),
  Permission: Permission(sequelize, DataTypes),
  Role: Role(sequelize, DataTypes),
  RolePermission: RolePermission(sequelize, DataTypes),
  City: City(sequelize, DataTypes),
  Promotion: Promotion(sequelize, DataTypes),
  PromotionCity: PromotionCity(sequelize, DataTypes),
  PromotionUsage: PromotionUsage(sequelize, DataTypes),
  Peso: Peso(sequelize, DataTypes),
  CategoriaProducto: CategoriaProducto(sequelize, DataTypes),
  Proveedor: Proveedor(sequelize, DataTypes),
  Inventario: Inventario(sequelize, DataTypes),
  Conversacion: Conversacion(sequelize, DataTypes),
  ConversacionChat: ConversacionChat(sequelize, DataTypes),
  ConversacionLog: ConversacionLog(sequelize, DataTypes),
  ConversacionFlag: ConversacionFlag(sequelize, DataTypes),
  ConversacionFlagAsignacion: ConversacionFlagAsignacion(sequelize, DataTypes),
  Pedido: Pedido(sequelize, DataTypes),
  ProductoPedido: ProductoPedido(sequelize, DataTypes),
  Cliente: Cliente(sequelize, DataTypes),
  Mascota: Mascota(sequelize, DataTypes),
  Ruta: Ruta(sequelize, DataTypes),
  RutaPedido: RutaPedido(sequelize, DataTypes),
  Agente: Agente(sequelize, DataTypes),
  AgenteConversacion: AgenteConversacion(sequelize, DataTypes),
  Repartidor: Repartidor(sequelize, DataTypes),
  Notificacion: Notificacion(sequelize, DataTypes),
  Paquete: Paquete(sequelize, DataTypes),
  ProductoPaquete: ProductoPaquete(sequelize, DataTypes),
  PaquetePedido: PaquetePedido(sequelize, DataTypes),
  WhatsAppPhoneNumber: WhatsAppPhoneNumber(sequelize, DataTypes)
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

// Asociaciones para PromotionUsage
models.PromotionUsage.belongsTo(models.Promotion, {
  foreignKey: 'promotion_id',
  as: 'promotion'
});

models.PromotionUsage.belongsTo(models.Cliente, {
  foreignKey: 'fkid_cliente',
  as: 'cliente'
});

models.PromotionUsage.belongsTo(models.Pedido, {
  foreignKey: 'fkid_pedido',
  as: 'pedido'
});

// Asociaciones inversas
models.Promotion.hasMany(models.PromotionUsage, {
  foreignKey: 'promotion_id',
  as: 'usages'
});

models.Cliente.hasMany(models.PromotionUsage, {
  foreignKey: 'fkid_cliente',
  as: 'promociones_usadas'
});

models.Pedido.hasOne(models.PromotionUsage, {
  foreignKey: 'fkid_pedido',
  as: 'promocion_usada'
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
models.Conversacion.belongsTo(models.Cliente, {
  foreignKey: 'id_cliente',
  as: 'cliente'
});

models.Conversacion.belongsTo(models.Pedido, {
  foreignKey: 'id_pedido',
  as: 'pedido'
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

// Asociaciones para Flags
models.Conversacion.hasMany(models.ConversacionFlagAsignacion, {
  foreignKey: 'fkid_conversacion',
  as: 'flagAsignaciones'
});

models.Conversacion.belongsToMany(models.ConversacionFlag, {
  through: models.ConversacionFlagAsignacion,
  foreignKey: 'fkid_conversacion',
  otherKey: 'fkid_flag',
  as: 'flags'
});

models.ConversacionFlag.belongsToMany(models.Conversacion, {
  through: models.ConversacionFlagAsignacion,
  foreignKey: 'fkid_flag',
  otherKey: 'fkid_conversacion',
  as: 'conversaciones'
});

models.ConversacionFlagAsignacion.belongsTo(models.Conversacion, {
  foreignKey: 'fkid_conversacion',
  as: 'conversacion'
});

models.ConversacionFlagAsignacion.belongsTo(models.ConversacionFlag, {
  foreignKey: 'fkid_flag',
  as: 'flag'
});

// Asociaciones inversas
models.Cliente.hasMany(models.Conversacion, {
  foreignKey: 'id_cliente',
  as: 'conversaciones'
});

models.Pedido.hasMany(models.Conversacion, {
  foreignKey: 'id_pedido',
  as: 'conversaciones'
});

// Asociaciones para Pedidos
models.Pedido.belongsTo(models.Cliente, {
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

models.Pedido.hasMany(models.PaquetePedido, {
  foreignKey: 'fkid_pedido',
  as: 'paquetes'
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
models.Cliente.hasMany(models.Pedido, {
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

// Asociaciones para Cliente
models.Cliente.belongsTo(models.City, {
  foreignKey: 'fkid_ciudad',
  as: 'ciudad'
});

models.Cliente.hasMany(models.Mascota, {
  foreignKey: 'fkid_cliente',
  as: 'mascotas'
});

// Asociaciones para Mascota
models.Mascota.belongsTo(models.Cliente, {
  foreignKey: 'fkid_cliente',
  as: 'cliente'
});

// Asociaciones inversas
models.City.hasMany(models.Cliente, {
  foreignKey: 'fkid_ciudad',
  as: 'clientes'
});

// Asociaciones para Ruta
models.Ruta.belongsTo(models.City, {
  foreignKey: 'fkid_ciudad',
  as: 'ciudad'
});

models.Ruta.belongsTo(models.Repartidor, {
  foreignKey: 'fkid_repartidor',
  as: 'repartidor'
});

models.Ruta.hasMany(models.RutaPedido, {
  foreignKey: 'fkid_ruta',
  as: 'pedidos'
});

// Asociaciones para RutaPedido
models.RutaPedido.belongsTo(models.Ruta, {
  foreignKey: 'fkid_ruta',
  as: 'ruta'
});

models.RutaPedido.belongsTo(models.Pedido, {
  foreignKey: 'fkid_pedido',
  as: 'pedido'
});

// Asociaciones inversas
models.City.hasMany(models.Ruta, {
  foreignKey: 'fkid_ciudad',
  as: 'rutas'
});

models.Repartidor.hasMany(models.Ruta, {
  foreignKey: 'fkid_repartidor',
  as: 'rutas_asignadas'
});

models.Pedido.hasMany(models.RutaPedido, {
  foreignKey: 'fkid_pedido',
  as: 'rutas'
});

// Asociaciones para Agente
models.Agente.hasMany(models.AgenteConversacion, {
  foreignKey: 'fkid_agente',
  as: 'conversaciones'
});

// Asociaciones para AgenteConversacion
models.AgenteConversacion.belongsTo(models.Agente, {
  foreignKey: 'fkid_agente',
  as: 'agente'
});

models.AgenteConversacion.belongsTo(models.Conversacion, {
  foreignKey: 'fkid_conversacion',
  as: 'conversacion'
});

// Asociaciones inversas
models.Conversacion.hasMany(models.AgenteConversacion, {
  foreignKey: 'fkid_conversacion',
  as: 'agentes'
});

// Asociaciones para Repartidor
models.Repartidor.belongsTo(models.City, {
  foreignKey: 'fkid_ciudad',
  as: 'ciudad'
});

models.Repartidor.belongsTo(models.User, {
  foreignKey: 'fkid_usuario',
  as: 'usuario'
});

models.Repartidor.hasMany(models.Ruta, {
  foreignKey: 'fkid_repartidor',
  as: 'rutas'
});

// Asociaciones inversas
models.City.hasMany(models.Repartidor, {
  foreignKey: 'fkid_ciudad',
  as: 'repartidores'
});

models.User.hasMany(models.Repartidor, {
  foreignKey: 'fkid_usuario',
  as: 'repartidor'
});

// Asociaciones para Paquete
models.Paquete.hasMany(models.ProductoPaquete, {
  foreignKey: 'fkid_paquete',
  as: 'productos'
});

// Asociaciones para ProductoPaquete
models.ProductoPaquete.belongsTo(models.Paquete, {
  foreignKey: 'fkid_paquete',
  as: 'paquete'
});

models.ProductoPaquete.belongsTo(models.Inventario, {
  foreignKey: 'fkid_producto',
  as: 'producto'
});

// Asociaciones inversas
models.Inventario.hasMany(models.ProductoPaquete, {
  foreignKey: 'fkid_producto',
  as: 'paquetes'
});

// Asociaciones para PaquetePedido
models.PaquetePedido.belongsTo(models.Pedido, {
  foreignKey: 'fkid_pedido',
  as: 'pedido'
});

models.PaquetePedido.belongsTo(models.Paquete, {
  foreignKey: 'fkid_paquete',
  as: 'paquete'
});

// Asociaciones inversas
models.Paquete.hasMany(models.PaquetePedido, {
  foreignKey: 'fkid_paquete',
  as: 'pedidos'
});

models.sequelize = sequelize;
models.Sequelize = require('sequelize');

module.exports = models;
