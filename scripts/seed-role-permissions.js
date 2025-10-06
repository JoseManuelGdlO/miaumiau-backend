#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

console.log('🚀 Asignando permisos a roles del sistema...\n');

try {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('No se encontró package.json. Ejecuta este script desde la raíz del backend.');
  }

  require('dotenv').config();

  const models = require('../src/models');
  const { sequelize } = models;

  // Configuración de permisos por rol
  const rolePermissionsConfig = {
    'admin': [
      // Usuarios
      'ver_usuarios', 'crear_usuarios', 'editar_usuarios', 'eliminar_usuarios',
      // Roles
      'ver_roles', 'crear_roles', 'editar_roles', 'eliminar_roles', 'asignar_permisos_roles',
      // Permisos
      'ver_permisos', 'crear_permisos', 'editar_permisos', 'eliminar_permisos',
      // Clientes
      'ver_clientes', 'crear_clientes', 'editar_clientes', 'eliminar_clientes', 'ver_stats_clientes',
      // Mascotas
      'ver_mascotas', 'crear_mascotas', 'editar_mascotas', 'eliminar_mascotas',
      // Pedidos
      'ver_pedidos', 'crear_pedidos', 'editar_pedidos', 'eliminar_pedidos', 
      'cambiar_estado_pedidos', 'confirmar_pedidos', 'entregar_pedidos', 'cancelar_pedidos', 'ver_stats_pedidos',
      // Productos Pedido
      'ver_productos_pedido', 'crear_productos_pedido', 'editar_productos_pedido', 'eliminar_productos_pedido',
      // Inventarios
      'ver_inventarios', 'crear_inventarios', 'editar_inventarios', 'eliminar_inventarios',
      // Categorías Producto
      'ver_categorias_producto', 'crear_categorias_producto', 'editar_categorias_producto', 'eliminar_categorias_producto',
      // Pesos
      'ver_pesos', 'crear_pesos', 'editar_pesos', 'eliminar_pesos',
      // Proveedores
      'ver_proveedores', 'crear_proveedores', 'editar_proveedores', 'eliminar_proveedores',
      // Ciudades
      'ver_ciudades', 'crear_ciudades', 'editar_ciudades', 'eliminar_ciudades',
      // Promociones
      'ver_promociones', 'crear_promociones', 'editar_promociones', 'eliminar_promociones',
      // Conversaciones
      'ver_conversaciones', 'crear_conversaciones', 'editar_conversaciones', 'eliminar_conversaciones',
      'cambiar_estado_conversaciones', 'asignar_conversaciones',
      // Conversaciones Chat
      'ver_conversaciones_chat', 'crear_conversaciones_chat', 'editar_conversaciones_chat', 'eliminar_conversaciones_chat', 'marcar_leido_chat',
      // Conversaciones Logs
      'ver_conversaciones_logs', 'crear_conversaciones_logs', 'editar_conversaciones_logs', 'eliminar_conversaciones_logs',
      // Sistema
      'ver_logs', 'configurar_sistema',
      // Reportes
      'ver_reportes', 'generar_reportes', 'exportar_reportes'
    ],
    'moderator': [
      // Clientes
      'ver_clientes', 'crear_clientes', 'editar_clientes',
      // Mascotas
      'ver_mascotas', 'crear_mascotas', 'editar_mascotas',
      // Pedidos
      'ver_pedidos', 'crear_pedidos', 'editar_pedidos',
      'cambiar_estado_pedidos', 'confirmar_pedidos', 'entregar_pedidos', 'cancelar_pedidos',
      // Productos Pedido
      'ver_productos_pedido', 'crear_productos_pedido', 'editar_productos_pedido',
      // Inventarios
      'ver_inventarios', 'crear_inventarios', 'editar_inventarios',
      // Categorías Producto
      'ver_categorias_producto', 'crear_categorias_producto', 'editar_categorias_producto',
      // Pesos
      'ver_pesos', 'crear_pesos', 'editar_pesos',
      // Proveedores
      'ver_proveedores', 'crear_proveedores', 'editar_proveedores',
      // Ciudades
      'ver_ciudades', 'crear_ciudades', 'editar_ciudades',
      // Promociones
      'ver_promociones', 'crear_promociones', 'editar_promociones',
      // Conversaciones
      'ver_conversaciones', 'crear_conversaciones', 'editar_conversaciones',
      'cambiar_estado_conversaciones', 'asignar_conversaciones',
      // Conversaciones Chat
      'ver_conversaciones_chat', 'crear_conversaciones_chat', 'editar_conversaciones_chat', 'marcar_leido_chat',
      // Conversaciones Logs
      'ver_conversaciones_logs', 'crear_conversaciones_logs', 'editar_conversaciones_logs',
      // Reportes
      'ver_reportes', 'generar_reportes'
    ],
    'agente': [
      // Clientes
      'ver_clientes', 'crear_clientes', 'editar_clientes',
      // Mascotas
      'ver_mascotas', 'crear_mascotas', 'editar_mascotas',
      // Pedidos
      'ver_pedidos', 'crear_pedidos',
      'cambiar_estado_pedidos', 'confirmar_pedidos', 'entregar_pedidos',
      // Productos Pedido
      'ver_productos_pedido', 'crear_productos_pedido',
      // Inventarios
      'ver_inventarios',
      // Categorías Producto
      'ver_categorias_producto',
      // Pesos
      'ver_pesos',
      // Proveedores
      'ver_proveedores',
      // Ciudades
      'ver_ciudades',
      // Promociones
      'ver_promociones',
      // Conversaciones
      'ver_conversaciones', 'crear_conversaciones', 'editar_conversaciones',
      'cambiar_estado_conversaciones', 'asignar_conversaciones',
      // Conversaciones Chat
      'ver_conversaciones_chat', 'crear_conversaciones_chat', 'marcar_leido_chat',
      // Conversaciones Logs
      'ver_conversaciones_logs', 'crear_conversaciones_logs'
    ],
    'user': [
      // Clientes
      'ver_clientes',
      // Mascotas
      'ver_mascotas',
      // Pedidos
      'ver_pedidos',
      // Productos Pedido
      'ver_productos_pedido',
      // Inventarios
      'ver_inventarios',
      // Categorías Producto
      'ver_categorias_producto',
      // Pesos
      'ver_pesos',
      // Proveedores
      'ver_proveedores',
      // Ciudades
      'ver_ciudades',
      // Promociones
      'ver_promociones',
      // Conversaciones
      'ver_conversaciones',
      // Conversaciones Chat
      'ver_conversaciones_chat',
      // Conversaciones Logs
      'ver_conversaciones_logs'
    ],
    'guest': [
      // Solo lectura básica
      'ver_inventarios',
      'ver_categorias_producto',
      'ver_pesos',
      'ver_ciudades',
      'ver_promociones'
    ],
    'auditor': [
      // Solo lectura para auditoría
      'ver_usuarios',
      'ver_roles',
      'ver_permisos',
      'ver_clientes',
      'ver_mascotas',
      'ver_pedidos',
      'ver_productos_pedido',
      'ver_inventarios',
      'ver_categorias_producto',
      'ver_pesos',
      'ver_proveedores',
      'ver_ciudades',
      'ver_promociones',
      'ver_conversaciones',
      'ver_conversaciones_chat',
      'ver_conversaciones_logs',
      'ver_logs',
      'ver_reportes'
    ]
  };

  (async () => {
    const tx = await sequelize.transaction();
    try {
      // Obtener todos los permisos
      const allPermissions = await models.Permission.findAll({
        where: { baja_logica: false }
      }, { transaction: tx });

      if (allPermissions.length === 0) {
        console.log('⚠️  No se encontraron permisos en la base de datos');
        console.log('   Ejecuta primero el seeder de permisos');
        return;
      }

      // Crear mapa de permisos por nombre
      const permissionsMap = {};
      allPermissions.forEach(permission => {
        permissionsMap[permission.nombre] = permission;
      });

      console.log(`✅ Encontrados ${allPermissions.length} permisos en el sistema`);

      // Procesar cada rol
      for (const [roleName, permissionNames] of Object.entries(rolePermissionsConfig)) {
        console.log(`\n🔹 Procesando rol: ${roleName}`);
        
        // Buscar el rol
        const role = await models.Role.findOne({
          where: { nombre: roleName }
        }, { transaction: tx });

        if (!role) {
          console.log(`   ⚠️  Rol ${roleName} no encontrado, saltando...`);
          continue;
        }

        console.log(`   ✅ Rol ${roleName} encontrado (ID: ${role.id})`);

        // Obtener IDs de permisos válidos
        const validPermissionIds = permissionNames
          .filter(name => permissionsMap[name])
          .map(name => permissionsMap[name].id);

        const invalidPermissions = permissionNames.filter(name => !permissionsMap[name]);
        if (invalidPermissions.length > 0) {
          console.log(`   ⚠️  Permisos no encontrados: ${invalidPermissions.join(', ')}`);
        }

        // Verificar permisos ya asignados
        const existingRolePermissions = await models.RolePermission.findAll({
          where: {
            role_id: role.id,
            permission_id: { [models.Sequelize.Op.in]: validPermissionIds }
          }
        }, { transaction: tx });

        const existingPermissionIds = existingRolePermissions.map(rp => rp.permission_id);
        const newPermissionIds = validPermissionIds.filter(id => !existingPermissionIds.includes(id));

        if (newPermissionIds.length === 0) {
          console.log(`   ✅ El rol ${roleName} ya tiene todos los permisos asignados`);
          continue;
        }

        // Asignar permisos faltantes
        const rolePermissionsToCreate = newPermissionIds.map(permissionId => ({
          role_id: role.id,
          permission_id: permissionId,
          created_at: new Date(),
          updated_at: new Date()
        }));

        await models.RolePermission.bulkCreate(rolePermissionsToCreate, { transaction: tx });

        console.log(`   ✅ Asignados ${newPermissionIds.length} permisos al rol ${roleName}`);

        // Mostrar permisos asignados por categoría
        const newPermissions = allPermissions.filter(p => newPermissionIds.includes(p.id));
        const permissionsByCategory = {};
        
        newPermissions.forEach(permission => {
          if (!permissionsByCategory[permission.categoria]) {
            permissionsByCategory[permission.categoria] = [];
          }
          permissionsByCategory[permission.categoria].push(permission);
        });

        Object.keys(permissionsByCategory).sort().forEach(category => {
          console.log(`      📂 ${category}: ${permissionsByCategory[category].length} permisos`);
        });
      }

      await tx.commit();
      console.log('\n🎉 Permisos asignados exitosamente a todos los roles');
      process.exit(0);
    } catch (error) {
      await tx.rollback();
      console.error('\n❌ Error durante la asignación de permisos:', error.message);
      process.exit(1);
    }
  })();

} catch (error) {
  console.error('\n❌ Error inicializando el script:', error.message);
  console.error('\n💡 Sugerencias:');
  console.error('   - Verifica variables de entorno de DB');
  console.error('   - Ejecuta migraciones y seeders base antes de este script');
  process.exit(1);
}
