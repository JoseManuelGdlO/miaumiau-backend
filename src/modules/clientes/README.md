# API de Clientes - Búsqueda por Teléfono

## Nuevas Funcionalidades

Se ha agregado la capacidad de buscar clientes por número de teléfono en el API de clientes.

### 1. Búsqueda General (Mejorada)

**Endpoint:** `GET /api/clientes`

**Parámetros de consulta:**
- `search`: Busca en nombre, email **y teléfono**
- `page`: Número de página (opcional, default: 1)
- `limit`: Elementos por página (opcional, default: 10, max: 100)
- `activos`: Filtrar por estado (opcional: 'true' o 'false')
- `ciudad_id` o `fkid_ciudad`: Filtrar por ciudad (opcional)

**Ejemplo:**
```bash
# Buscar clientes que contengan "300" en nombre, email o teléfono
GET /api/clientes?search=300

# Buscar clientes activos que contengan "123" en cualquier campo
GET /api/clientes?search=123&activos=true

# Buscar con paginación
GET /api/clientes?search=300&page=1&limit=20
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "clientes": [
      {
        "id": 1,
        "nombre_completo": "Juan Pérez",
        "telefono": "3001234567",
        "email": "juan@email.com",
        "ciudad": {
          "id": 1,
          "nombre": "Bogotá",
          "departamento": "Cundinamarca"
        },
        "mascotas": [...],
        "totalPedidos": 5,
        "ultimoPedido": "2024-01-15T10:30:00.000Z",
        "totalGastado": 150000,
        "loyaltyPoints": 1500
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

### 2. Búsqueda por Teléfono Exacto (Nuevo)

**Endpoint:** `GET /api/clientes/telefono/:telefono`

**Parámetros:**
- `telefono`: Número de teléfono exacto (7-20 caracteres)

**Validaciones:**
- El teléfono debe tener entre 7 y 20 caracteres
- Solo puede contener números, espacios, guiones, paréntesis y opcionalmente un + al inicio
- Ejemplos válidos: `3001234567`, `+57 300 123 4567`, `(300) 123-4567`

**Ejemplo:**
```bash
# Buscar cliente por teléfono exacto
GET /api/clientes/telefono/3001234567

# Buscar con formato internacional
GET /api/clientes/telefono/%2B57%20300%20123%204567
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": {
    "cliente": {
      "id": 1,
      "nombre_completo": "Juan Pérez",
      "telefono": "3001234567",
      "email": "juan@email.com",
      "ciudad": {
        "id": 1,
        "nombre": "Bogotá",
        "departamento": "Cundinamarca"
      },
      "mascotas": [
        {
          "id": 1,
          "nombre": "Max",
          "edad": 3,
          "genero": "macho",
          "raza": "Golden Retriever",
          "producto_preferido": "Croquetas Premium",
          "puntos_lealtad": 50,
          "notas_especiales": "Alérgico al pollo"
        }
      ],
      "totalPedidos": 5,
      "ultimoPedido": "2024-01-15T10:30:00.000Z",
      "totalGastado": 150000,
      "loyaltyPoints": 1500
    }
  }
}
```

**Respuesta cuando no se encuentra:**
```json
{
  "success": false,
  "message": "Cliente no encontrado con ese número de teléfono"
}
```

## Casos de Uso

### 1. Búsqueda General
- **Uso:** Cuando no sabes exactamente el teléfono pero tienes una parte
- **Ejemplo:** Buscar "300" encontrará todos los clientes con números que contengan "300"

### 2. Búsqueda Exacta
- **Uso:** Cuando tienes el número exacto del cliente
- **Ejemplo:** El cliente llama y proporciona su número exacto
- **Ventaja:** Más rápido y preciso que la búsqueda general

## Autenticación y Permisos

Todas las rutas requieren:
- Token de autenticación válido
- Permiso `ver_clientes` o rol de `super_admin`

## Códigos de Estado HTTP

- `200`: Búsqueda exitosa
- `400`: Datos de entrada inválidos (formato de teléfono incorrecto)
- `401`: No autenticado
- `403`: Sin permisos
- `404`: Cliente no encontrado (solo en búsqueda exacta)
- `500`: Error interno del servidor

## Notas Importantes

1. **Búsqueda General:** Usa `LIKE` con `%` para búsquedas parciales
2. **Búsqueda Exacta:** Usa comparación exacta del campo `telefono`
3. **Solo Clientes Activos:** La búsqueda exacta solo retorna clientes con `isActive: true`
4. **Estadísticas Incluidas:** Ambas búsquedas incluyen estadísticas del cliente (pedidos, gastos, puntos de lealtad)
5. **Relaciones:** Se incluyen automáticamente la ciudad y mascotas del cliente
