# Mapeo de Permisos del Sistema

## 📋 Categorías de Permisos

### 1. **usuarios** - Gestión de Usuarios del Sistema
- `ver_usuarios` - Ver lista de usuarios
- `crear_usuarios` - Crear nuevos usuarios
- `editar_usuarios` - Editar información de usuarios
- `eliminar_usuarios` - Eliminar usuarios
- `administrar_usuarios` - Administración completa de usuarios

### 2. **roles** - Gestión de Roles
- `ver_roles` - Ver lista de roles
- `crear_roles` - Crear nuevos roles
- `editar_roles` - Editar roles existentes
- `eliminar_roles` - Eliminar roles
- `asignar_permisos_roles` - Asignar permisos a roles

### 3. **permisos** - Gestión de Permisos
- `ver_permisos` - Ver lista de permisos
- `crear_permisos` - Crear nuevos permisos
- `editar_permisos` - Editar permisos existentes
- `eliminar_permisos` - Eliminar permisos

### 4. **clientes** - Gestión de Clientes
- `ver_clientes` - Ver lista de clientes
- `crear_clientes` - Crear nuevos clientes
- `editar_clientes` - Editar información de clientes
- `eliminar_clientes` - Eliminar clientes
- `ver_stats_clientes` - Ver estadísticas de clientes

### 5. **mascotas** - Gestión de Mascotas
- `ver_mascotas` - Ver lista de mascotas
- `crear_mascotas` - Crear nuevas mascotas
- `editar_mascotas` - Editar información de mascotas
- `eliminar_mascotas` - Eliminar mascotas

### 6. **pedidos** - Gestión de Pedidos
- `ver_pedidos` - Ver lista de pedidos
- `crear_pedidos` - Crear nuevos pedidos
- `editar_pedidos` - Editar pedidos existentes
- `eliminar_pedidos` - Eliminar pedidos
- `cambiar_estado_pedidos` - Cambiar estado de pedidos
- `confirmar_pedidos` - Confirmar pedidos
- `entregar_pedidos` - Marcar como entregados
- `cancelar_pedidos` - Cancelar pedidos
- `ver_stats_pedidos` - Ver estadísticas de pedidos

### 7. **productos_pedido** - Gestión de Productos en Pedidos
- `ver_productos_pedido` - Ver productos de pedidos
- `crear_productos_pedido` - Agregar productos a pedidos
- `editar_productos_pedido` - Editar productos de pedidos
- `eliminar_productos_pedido` - Eliminar productos de pedidos

### 8. **inventarios** - Gestión de Inventarios
- `ver_inventarios` - Ver lista de inventarios
- `crear_inventarios` - Crear nuevos inventarios
- `editar_inventarios` - Editar inventarios existentes
- `eliminar_inventarios` - Eliminar inventarios

### 9. **categorias_producto** - Gestión de Categorías de Productos
- `ver_categorias_producto` - Ver categorías de productos
- `crear_categorias_producto` - Crear nuevas categorías
- `editar_categorias_producto` - Editar categorías existentes
- `eliminar_categorias_producto` - Eliminar categorías

### 10. **pesos** - Gestión de Pesos
- `ver_pesos` - Ver pesos disponibles
- `crear_pesos` - Crear nuevos pesos
- `editar_pesos` - Editar pesos existentes
- `eliminar_pesos` - Eliminar pesos

### 11. **proveedores** - Gestión de Proveedores
- `ver_proveedores` - Ver lista de proveedores
- `crear_proveedores` - Crear nuevos proveedores
- `editar_proveedores` - Editar proveedores existentes
- `eliminar_proveedores` - Eliminar proveedores

### 12. **ciudades** - Gestión de Ciudades
- `ver_ciudades` - Ver lista de ciudades
- `crear_ciudades` - Crear nuevas ciudades
- `editar_ciudades` - Editar ciudades existentes
- `eliminar_ciudades` - Eliminar ciudades

### 13. **promociones** - Gestión de Promociones
- `ver_promociones` - Ver lista de promociones
- `crear_promociones` - Crear nuevas promociones
- `editar_promociones` - Editar promociones existentes
- `eliminar_promociones` - Eliminar promociones

### 14. **conversaciones** - Gestión de Conversaciones
- `ver_conversaciones` - Ver lista de conversaciones
- `crear_conversaciones` - Crear nuevas conversaciones
- `editar_conversaciones` - Editar conversaciones existentes
- `eliminar_conversaciones` - Eliminar conversaciones
- `cambiar_estado_conversaciones` - Cambiar estado de conversaciones
- `asignar_conversaciones` - Asignar conversaciones a clientes

### 15. **conversaciones_chat** - Gestión de Mensajes de Chat
- `ver_conversaciones_chat` - Ver mensajes de conversaciones
- `crear_conversaciones_chat` - Enviar mensajes en conversaciones
- `editar_conversaciones_chat` - Editar mensajes de conversaciones
- `eliminar_conversaciones_chat` - Eliminar mensajes de conversaciones
- `marcar_leido_chat` - Marcar mensajes como leídos

### 16. **conversaciones_logs** - Gestión de Logs de Conversaciones
- `ver_conversaciones_logs` - Ver logs de conversaciones
- `crear_conversaciones_logs` - Crear logs de conversaciones
- `editar_conversaciones_logs` - Editar logs de conversaciones
- `eliminar_conversaciones_logs` - Eliminar logs de conversaciones

### 17. **sistema** - Gestión del Sistema
- `ver_logs` - Ver logs del sistema
- `configurar_sistema` - Configurar parámetros del sistema
- `backup_sistema` - Realizar backups del sistema
- `restore_sistema` - Restaurar backups del sistema

### 18. **reportes** - Gestión de Reportes
- `ver_reportes` - Ver reportes del sistema
- `generar_reportes` - Generar nuevos reportes
- `exportar_reportes` - Exportar reportes en diferentes formatos

## 🎯 Tipos de Permisos

### **lectura**
- Permite ver/listar recursos
- Acceso de solo lectura
- No permite modificaciones

### **escritura**
- Permite crear y editar recursos
- Incluye operaciones de creación y actualización
- No incluye eliminación

### **eliminacion**
- Permite eliminar recursos del sistema
- Operaciones de borrado lógico y físico
- Acceso de alto nivel

### **administracion**
- Permite gestión completa del módulo
- Incluye todas las operaciones CRUD
- Acceso de administrador

### **especial**
- Operaciones especiales del sistema
- Backup, restauración, exportación
- Acceso de super administrador

## 🔧 Uso en el Frontend

### Verificación de Permisos
```javascript
// Verificar si el usuario puede ver usuarios
if (userPermissions.includes('ver_usuarios')) {
  showUsersList();
}

// Verificar si puede crear usuarios
if (userPermissions.includes('crear_usuarios')) {
  showCreateUserButton();
}

// Verificar si es super admin (acceso total)
if (userPermissions.includes('*')) {
  showAllFeatures();
}
```

### Mapeo de Rutas a Permisos
```javascript
const routePermissions = {
  '/users': 'ver_usuarios',
  '/users/create': 'crear_usuarios',
  '/users/edit': 'editar_usuarios',
  '/users/delete': 'eliminar_usuarios',
  '/roles': 'ver_roles',
  '/roles/create': 'crear_roles',
  '/permissions': 'ver_permisos',
  '/clients': 'ver_clientes',
  '/orders': 'ver_pedidos',
  '/orders/create': 'crear_pedidos',
  '/conversations': 'ver_conversaciones',
  // ... más rutas
};
```

### Componentes Condicionales
```javascript
// Mostrar botón solo si tiene permiso
{userPermissions.includes('crear_usuarios') && (
  <Button onClick={createUser}>Crear Usuario</Button>
)}

// Mostrar menú solo si tiene permisos de administración
{userPermissions.some(p => p.includes('administrar')) && (
  <AdminMenu />
)}
```

## 🚀 Implementación

### 1. Ejecutar Seeder de Permisos
```bash
npx sequelize-cli db:seed --seed 20241201000022-complete-permissions-seeder.js
```

### 2. Asignar Permisos a Roles
```bash
node scripts/seed-super-admin-permissions.js
```

### 3. Actualizar Rutas (Automático)
```bash
node scripts/update-all-routes-permissions.js
```

### 4. Verificar en el Frontend
```javascript
// Obtener permisos del usuario después del login
const userPermissions = await getUserPermissions();

// Usar en componentes
const canCreateUsers = userPermissions.includes('crear_usuarios');
const canViewReports = userPermissions.includes('ver_reportes');
```

## 📊 Estructura de Respuesta de Permisos

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "admin@miaumiau.com",
      "rol": {
        "id": 1,
        "nombre": "admin",
        "permissions": [
          {
            "id": 1,
            "nombre": "ver_usuarios",
            "categoria": "usuarios",
            "tipo": "lectura"
          },
          {
            "id": 2,
            "nombre": "crear_usuarios",
            "categoria": "usuarios",
            "tipo": "escritura"
          }
        ]
      }
    }
  }
}
```

## 🔒 Seguridad

- **Super Admin**: Acceso total a todo el sistema
- **Verificación Dinámica**: Permisos consultados desde BD en tiempo real
- **Granularidad**: Control fino por módulo y acción
- **Escalabilidad**: Fácil agregar nuevos permisos y roles
