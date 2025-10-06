#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Actualizando todas las rutas para usar sistema de permisos dinámicos...\n');

// Mapeo de módulos y sus permisos correspondientes
const modulePermissions = {
  'users': {
    'GET /': 'ver_usuarios',
    'GET /stats': 'ver_usuarios',
    'GET /:id': 'ver_usuarios',
    'POST /': 'crear_usuarios',
    'PUT /:id': 'editar_usuarios',
    'DELETE /:id': 'eliminar_usuarios',
    'PATCH /:id/restore': 'editar_usuarios',
    'PATCH /:id/change-password': 'editar_usuarios'
  },
  'roles': {
    'GET /': 'ver_roles',
    'GET /:id': 'ver_roles',
    'POST /': 'crear_roles',
    'PUT /:id': 'editar_roles',
    'DELETE /:id': 'eliminar_roles',
    'PATCH /:id/restore': 'editar_roles',
    'POST /:id/permissions': 'asignar_permisos_roles',
    'DELETE /:id/permissions/:permission_id': 'asignar_permisos_roles',
    'GET /:id/permissions': 'ver_roles'
  },
  'clientes': {
    'GET /': 'ver_clientes',
    'GET /stats': 'ver_stats_clientes',
    'GET /active': 'ver_clientes',
    'GET /:id': 'ver_clientes',
    'POST /': 'crear_clientes',
    'PUT /:id': 'editar_clientes',
    'DELETE /:id': 'eliminar_clientes',
    'PATCH /:id/restore': 'editar_clientes'
  },
  'mascotas': {
    'GET /': 'ver_mascotas',
    'GET /:id': 'ver_mascotas',
    'POST /': 'crear_mascotas',
    'PUT /:id': 'editar_mascotas',
    'DELETE /:id': 'eliminar_mascotas',
    'PATCH /:id/restore': 'editar_mascotas'
  },
  'pedidos': {
    'GET /': 'ver_pedidos',
    'GET /:id': 'ver_pedidos',
    'POST /': 'crear_pedidos',
    'PUT /:id': 'editar_pedidos',
    'DELETE /:id': 'eliminar_pedidos',
    'PATCH /:id/restore': 'editar_pedidos',
    'PATCH /:id/estado': 'cambiar_estado_pedidos',
    'PATCH /:id/confirmar': 'confirmar_pedidos',
    'PATCH /:id/entregar': 'entregar_pedidos',
    'PATCH /:id/cancelar': 'cancelar_pedidos',
    'GET /cliente/:clientId': 'ver_pedidos',
    'GET /estado/:estado': 'ver_pedidos',
    'GET /ciudad/:ciudadId': 'ver_pedidos',
    'GET /numero/:numero': 'ver_pedidos'
  },
  'productos-pedido': {
    'GET /': 'ver_productos_pedido',
    'GET /:id': 'ver_productos_pedido',
    'POST /': 'crear_productos_pedido',
    'PUT /:id': 'editar_productos_pedido',
    'DELETE /:id': 'eliminar_productos_pedido',
    'PATCH /:id/restore': 'editar_productos_pedido'
  },
  'inventarios': {
    'GET /': 'ver_inventarios',
    'GET /:id': 'ver_inventarios',
    'POST /': 'crear_inventarios',
    'PUT /:id': 'editar_inventarios',
    'DELETE /:id': 'eliminar_inventarios',
    'PATCH /:id/restore': 'editar_inventarios'
  },
  'categorias-producto': {
    'GET /': 'ver_categorias_producto',
    'GET /:id': 'ver_categorias_producto',
    'POST /': 'crear_categorias_producto',
    'PUT /:id': 'editar_categorias_producto',
    'DELETE /:id': 'eliminar_categorias_producto',
    'PATCH /:id/restore': 'editar_categorias_producto'
  },
  'pesos': {
    'GET /': 'ver_pesos',
    'GET /:id': 'ver_pesos',
    'POST /': 'crear_pesos',
    'PUT /:id': 'editar_pesos',
    'DELETE /:id': 'eliminar_pesos',
    'PATCH /:id/restore': 'editar_pesos'
  },
  'proveedores': {
    'GET /': 'ver_proveedores',
    'GET /:id': 'ver_proveedores',
    'POST /': 'crear_proveedores',
    'PUT /:id': 'editar_proveedores',
    'DELETE /:id': 'eliminar_proveedores',
    'PATCH /:id/restore': 'editar_proveedores'
  },
  'cities': {
    'GET /': 'ver_ciudades',
    'GET /:id': 'ver_ciudades',
    'POST /': 'crear_ciudades',
    'PUT /:id': 'editar_ciudades',
    'DELETE /:id': 'eliminar_ciudades',
    'PATCH /:id/restore': 'editar_ciudades'
  },
  'promotions': {
    'GET /': 'ver_promociones',
    'GET /:id': 'ver_promociones',
    'POST /': 'crear_promociones',
    'PUT /:id': 'editar_promociones',
    'DELETE /:id': 'eliminar_promociones',
    'PATCH /:id/restore': 'editar_promociones'
  },
  'conversaciones': {
    'GET /': 'ver_conversaciones',
    'GET /:id': 'ver_conversaciones',
    'POST /': 'crear_conversaciones',
    'PUT /:id': 'editar_conversaciones',
    'DELETE /:id': 'eliminar_conversaciones',
    'PATCH /:id/restore': 'editar_conversaciones',
    'PATCH /:id/status': 'cambiar_estado_conversaciones',
    'PATCH /:id/assign': 'asignar_conversaciones',
    'GET /status/:status': 'ver_conversaciones',
    'GET /client/:clientId': 'ver_conversaciones',
    'GET /search/:term': 'ver_conversaciones'
  },
  'conversaciones-chat': {
    'GET /': 'ver_conversaciones_chat',
    'GET /:id': 'ver_conversaciones_chat',
    'POST /': 'crear_conversaciones_chat',
    'PUT /:id': 'editar_conversaciones_chat',
    'DELETE /:id': 'eliminar_conversaciones_chat',
    'PATCH /:id/restore': 'editar_conversaciones_chat',
    'PATCH /:id/read': 'marcar_leido_chat',
    'PATCH /:id/unread': 'marcar_leido_chat',
    'GET /conversacion/:conversacionId': 'ver_conversaciones_chat',
    'GET /from/:from': 'ver_conversaciones_chat',
    'GET /date/:fecha': 'ver_conversaciones_chat',
    'GET /search/:term': 'ver_conversaciones_chat',
    'GET /hour/:fecha': 'ver_conversaciones_chat'
  },
  'conversaciones-logs': {
    'GET /': 'ver_conversaciones_logs',
    'GET /:id': 'ver_conversaciones_logs',
    'POST /': 'crear_conversaciones_logs',
    'PUT /:id': 'editar_conversaciones_logs',
    'DELETE /:id': 'eliminar_conversaciones_logs',
    'PATCH /:id/restore': 'editar_conversaciones_logs',
    'PATCH /:id/data': 'editar_conversaciones_logs',
    'PATCH /:id/data/add': 'editar_conversaciones_logs',
    'GET /conversacion/:conversacionId': 'ver_conversaciones_logs',
    'GET /type/:tipo': 'ver_conversaciones_logs',
    'GET /level/:nivel': 'ver_conversaciones_logs',
    'GET /date/:fecha': 'ver_conversaciones_logs',
    'GET /search/data': 'ver_conversaciones_logs',
    'GET /hour/:fecha': 'ver_conversaciones_logs'
  }
};

// Función para actualizar un archivo de rutas
function updateRoutesFile(moduleName, routesPath) {
  try {
    if (!fs.existsSync(routesPath)) {
      console.log(`⚠️  Archivo no encontrado: ${routesPath}`);
      return;
    }

    let content = fs.readFileSync(routesPath, 'utf8');
    const originalContent = content;

    // Reemplazar imports
    content = content.replace(
      /const { authenticateToken, requireRole } = require\('\.\.\/\.\.\/middleware\/auth'\);/,
      `const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');`
    );

    // Reemplazar requireRole con requireSuperAdminOrPermission
    const permissions = modulePermissions[moduleName];
    if (permissions) {
      Object.keys(permissions).forEach(routePattern => {
        const permission = permissions[routePattern];
        
        // Buscar y reemplazar requireRole con el permiso específico
        const requireRoleRegex = new RegExp(
          `requireRole\\(\\[.*?\\]\\)`,
          'g'
        );
        
        content = content.replace(requireRoleRegex, (match) => {
          // Solo reemplazar si no es una ruta pública
          if (!content.includes('// Rutas públicas') || 
              content.indexOf(match) > content.indexOf('// Rutas protegidas')) {
            return `requireSuperAdminOrPermission('${permission}')`;
          }
          return match;
        });
      });
    }

    // Escribir el archivo actualizado si hubo cambios
    if (content !== originalContent) {
      fs.writeFileSync(routesPath, content, 'utf8');
      console.log(`✅ Actualizado: ${routesPath}`);
    } else {
      console.log(`⏭️  Sin cambios: ${routesPath}`);
    }

  } catch (error) {
    console.error(`❌ Error actualizando ${routesPath}:`, error.message);
  }
}

// Actualizar todos los módulos
const modulesDir = path.join(__dirname, '../src/modules');
const modules = fs.readdirSync(modulesDir);

modules.forEach(moduleName => {
  const routesPath = path.join(modulesDir, moduleName, 'routes.js');
  updateRoutesFile(moduleName, routesPath);
});

console.log('\n🎉 Actualización completada!');
console.log('\n📋 Resumen de categorías de permisos:');
console.log('=====================================');

const categories = [
  'usuarios', 'roles', 'permisos', 'clientes', 'mascotas', 'pedidos',
  'productos_pedido', 'inventarios', 'categorias_producto', 'pesos',
  'proveedores', 'ciudades', 'promociones', 'conversaciones',
  'conversaciones_chat', 'conversaciones_logs', 'sistema', 'reportes'
];

categories.forEach(category => {
  console.log(`- ${category}`);
});

console.log('\n💡 Tipos de permisos:');
console.log('- lectura: Ver/listar recursos');
console.log('- escritura: Crear/editar recursos');
console.log('- eliminacion: Eliminar recursos');
console.log('- administracion: Gestionar completamente');
console.log('- especial: Operaciones especiales (backup, exportar, etc.)');
