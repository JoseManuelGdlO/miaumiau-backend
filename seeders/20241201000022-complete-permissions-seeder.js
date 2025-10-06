'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existen permisos para evitar duplicados
    const existingPermissions = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM permissions',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Solo insertar si no hay permisos existentes
    if (existingPermissions[0].count > 0) {
      console.log('Permisos ya existen, saltando inserción');
      return;
    }
    
    const permissions = [
      // ===== PERMISOS DE USUARIOS =====
      {
        nombre: 'ver_usuarios',
        categoria: 'usuarios',
        descripcion: 'Permite ver la lista de usuarios',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_usuarios',
        categoria: 'usuarios',
        descripcion: 'Permite crear nuevos usuarios',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_usuarios',
        categoria: 'usuarios',
        descripcion: 'Permite editar información de usuarios',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_usuarios',
        categoria: 'usuarios',
        descripcion: 'Permite eliminar usuarios del sistema',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'administrar_usuarios',
        categoria: 'usuarios',
        descripcion: 'Permite administrar completamente los usuarios',
        tipo: 'administracion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // ===== PERMISOS DE ROLES =====
      {
        nombre: 'ver_roles',
        categoria: 'roles',
        descripcion: 'Permite ver la lista de roles',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_roles',
        categoria: 'roles',
        descripcion: 'Permite crear nuevos roles',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_roles',
        categoria: 'roles',
        descripcion: 'Permite editar roles existentes',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_roles',
        categoria: 'roles',
        descripcion: 'Permite eliminar roles del sistema',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'asignar_permisos_roles',
        categoria: 'roles',
        descripcion: 'Permite asignar permisos a roles',
        tipo: 'administracion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // ===== PERMISOS DE PERMISOS =====
      {
        nombre: 'ver_permisos',
        categoria: 'permisos',
        descripcion: 'Permite ver la lista de permisos',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_permisos',
        categoria: 'permisos',
        descripcion: 'Permite crear nuevos permisos',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_permisos',
        categoria: 'permisos',
        descripcion: 'Permite editar permisos existentes',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_permisos',
        categoria: 'permisos',
        descripcion: 'Permite eliminar permisos del sistema',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // ===== PERMISOS DE CLIENTES =====
      {
        nombre: 'ver_clientes',
        categoria: 'clientes',
        descripcion: 'Permite ver la lista de clientes',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_clientes',
        categoria: 'clientes',
        descripcion: 'Permite crear nuevos clientes',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_clientes',
        categoria: 'clientes',
        descripcion: 'Permite editar información de clientes',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_clientes',
        categoria: 'clientes',
        descripcion: 'Permite eliminar clientes del sistema',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'ver_stats_clientes',
        categoria: 'clientes',
        descripcion: 'Permite ver estadísticas de clientes',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // ===== PERMISOS DE MASCOTAS =====
      {
        nombre: 'ver_mascotas',
        categoria: 'mascotas',
        descripcion: 'Permite ver la lista de mascotas',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_mascotas',
        categoria: 'mascotas',
        descripcion: 'Permite crear nuevas mascotas',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_mascotas',
        categoria: 'mascotas',
        descripcion: 'Permite editar información de mascotas',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_mascotas',
        categoria: 'mascotas',
        descripcion: 'Permite eliminar mascotas del sistema',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // ===== PERMISOS DE PEDIDOS =====
      {
        nombre: 'ver_pedidos',
        categoria: 'pedidos',
        descripcion: 'Permite ver la lista de pedidos',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_pedidos',
        categoria: 'pedidos',
        descripcion: 'Permite crear nuevos pedidos',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_pedidos',
        categoria: 'pedidos',
        descripcion: 'Permite editar pedidos existentes',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_pedidos',
        categoria: 'pedidos',
        descripcion: 'Permite eliminar pedidos del sistema',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'cambiar_estado_pedidos',
        categoria: 'pedidos',
        descripcion: 'Permite cambiar el estado de pedidos',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'confirmar_pedidos',
        categoria: 'pedidos',
        descripcion: 'Permite confirmar pedidos',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'entregar_pedidos',
        categoria: 'pedidos',
        descripcion: 'Permite marcar pedidos como entregados',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'cancelar_pedidos',
        categoria: 'pedidos',
        descripcion: 'Permite cancelar pedidos',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'ver_stats_pedidos',
        categoria: 'pedidos',
        descripcion: 'Permite ver estadísticas de pedidos',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // ===== PERMISOS DE PRODUCTOS PEDIDO =====
      {
        nombre: 'ver_productos_pedido',
        categoria: 'productos_pedido',
        descripcion: 'Permite ver productos de pedidos',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_productos_pedido',
        categoria: 'productos_pedido',
        descripcion: 'Permite agregar productos a pedidos',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_productos_pedido',
        categoria: 'productos_pedido',
        descripcion: 'Permite editar productos de pedidos',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_productos_pedido',
        categoria: 'productos_pedido',
        descripcion: 'Permite eliminar productos de pedidos',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // ===== PERMISOS DE INVENTARIOS =====
      {
        nombre: 'ver_inventarios',
        categoria: 'inventarios',
        descripcion: 'Permite ver la lista de inventarios',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_inventarios',
        categoria: 'inventarios',
        descripcion: 'Permite crear nuevos inventarios',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_inventarios',
        categoria: 'inventarios',
        descripcion: 'Permite editar inventarios existentes',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_inventarios',
        categoria: 'inventarios',
        descripcion: 'Permite eliminar inventarios del sistema',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // ===== PERMISOS DE CATEGORÍAS PRODUCTO =====
      {
        nombre: 'ver_categorias_producto',
        categoria: 'categorias_producto',
        descripcion: 'Permite ver las categorías de productos',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_categorias_producto',
        categoria: 'categorias_producto',
        descripcion: 'Permite crear nuevas categorías de productos',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_categorias_producto',
        categoria: 'categorias_producto',
        descripcion: 'Permite editar categorías de productos',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_categorias_producto',
        categoria: 'categorias_producto',
        descripcion: 'Permite eliminar categorías de productos',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // ===== PERMISOS DE PESOS =====
      {
        nombre: 'ver_pesos',
        categoria: 'pesos',
        descripcion: 'Permite ver los pesos disponibles',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_pesos',
        categoria: 'pesos',
        descripcion: 'Permite crear nuevos pesos',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_pesos',
        categoria: 'pesos',
        descripcion: 'Permite editar pesos existentes',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_pesos',
        categoria: 'pesos',
        descripcion: 'Permite eliminar pesos del sistema',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // ===== PERMISOS DE PROVEEDORES =====
      {
        nombre: 'ver_proveedores',
        categoria: 'proveedores',
        descripcion: 'Permite ver la lista de proveedores',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_proveedores',
        categoria: 'proveedores',
        descripcion: 'Permite crear nuevos proveedores',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_proveedores',
        categoria: 'proveedores',
        descripcion: 'Permite editar proveedores existentes',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_proveedores',
        categoria: 'proveedores',
        descripcion: 'Permite eliminar proveedores del sistema',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // ===== PERMISOS DE CIUDADES =====
      {
        nombre: 'ver_ciudades',
        categoria: 'ciudades',
        descripcion: 'Permite ver la lista de ciudades',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_ciudades',
        categoria: 'ciudades',
        descripcion: 'Permite crear nuevas ciudades',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_ciudades',
        categoria: 'ciudades',
        descripcion: 'Permite editar ciudades existentes',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_ciudades',
        categoria: 'ciudades',
        descripcion: 'Permite eliminar ciudades del sistema',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // ===== PERMISOS DE PROMOCIONES =====
      {
        nombre: 'ver_promociones',
        categoria: 'promociones',
        descripcion: 'Permite ver la lista de promociones',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_promociones',
        categoria: 'promociones',
        descripcion: 'Permite crear nuevas promociones',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_promociones',
        categoria: 'promociones',
        descripcion: 'Permite editar promociones existentes',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_promociones',
        categoria: 'promociones',
        descripcion: 'Permite eliminar promociones del sistema',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // ===== PERMISOS DE CONVERSACIONES =====
      {
        nombre: 'ver_conversaciones',
        categoria: 'conversaciones',
        descripcion: 'Permite ver la lista de conversaciones',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_conversaciones',
        categoria: 'conversaciones',
        descripcion: 'Permite crear nuevas conversaciones',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_conversaciones',
        categoria: 'conversaciones',
        descripcion: 'Permite editar conversaciones existentes',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_conversaciones',
        categoria: 'conversaciones',
        descripcion: 'Permite eliminar conversaciones del sistema',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'cambiar_estado_conversaciones',
        categoria: 'conversaciones',
        descripcion: 'Permite cambiar el estado de conversaciones',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'asignar_conversaciones',
        categoria: 'conversaciones',
        descripcion: 'Permite asignar conversaciones a clientes',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // ===== PERMISOS DE CONVERSACIONES CHAT =====
      {
        nombre: 'ver_conversaciones_chat',
        categoria: 'conversaciones_chat',
        descripcion: 'Permite ver mensajes de conversaciones',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_conversaciones_chat',
        categoria: 'conversaciones_chat',
        descripcion: 'Permite enviar mensajes en conversaciones',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_conversaciones_chat',
        categoria: 'conversaciones_chat',
        descripcion: 'Permite editar mensajes de conversaciones',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_conversaciones_chat',
        categoria: 'conversaciones_chat',
        descripcion: 'Permite eliminar mensajes de conversaciones',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'marcar_leido_chat',
        categoria: 'conversaciones_chat',
        descripcion: 'Permite marcar mensajes como leídos',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // ===== PERMISOS DE CONVERSACIONES LOGS =====
      {
        nombre: 'ver_conversaciones_logs',
        categoria: 'conversaciones_logs',
        descripcion: 'Permite ver logs de conversaciones',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_conversaciones_logs',
        categoria: 'conversaciones_logs',
        descripcion: 'Permite crear logs de conversaciones',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_conversaciones_logs',
        categoria: 'conversaciones_logs',
        descripcion: 'Permite editar logs de conversaciones',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_conversaciones_logs',
        categoria: 'conversaciones_logs',
        descripcion: 'Permite eliminar logs de conversaciones',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // ===== PERMISOS DE SISTEMA =====
      {
        nombre: 'ver_logs',
        categoria: 'sistema',
        descripcion: 'Permite ver los logs del sistema',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'configurar_sistema',
        categoria: 'sistema',
        descripcion: 'Permite configurar parámetros del sistema',
        tipo: 'administracion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'backup_sistema',
        categoria: 'sistema',
        descripcion: 'Permite realizar backups del sistema',
        tipo: 'especial',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'restore_sistema',
        categoria: 'sistema',
        descripcion: 'Permite restaurar backups del sistema',
        tipo: 'especial',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // ===== PERMISOS DE REPORTES =====
      {
        nombre: 'ver_reportes',
        categoria: 'reportes',
        descripcion: 'Permite ver reportes del sistema',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'generar_reportes',
        categoria: 'reportes',
        descripcion: 'Permite generar nuevos reportes',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'exportar_reportes',
        categoria: 'reportes',
        descripcion: 'Permite exportar reportes en diferentes formatos',
        tipo: 'especial',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    // Insertar permisos usando queryInterface
    await queryInterface.bulkInsert('permissions', permissions);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('permissions', null, {});
  }
};
