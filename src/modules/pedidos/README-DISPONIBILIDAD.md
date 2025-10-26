# API de Disponibilidad de Entregas

## Endpoint de Disponibilidad

**URL:** `GET /api/pedidos/disponibilidad/:fecha_inicio`

**Descripción:** Obtiene la disponibilidad de entregas para los próximos 7 días a partir del día siguiente a la fecha proporcionada.

### Parámetros

#### Parámetro de Ruta
- `fecha_inicio` (requerido): Fecha de referencia en formato `YYYY-MM-DD`
  - Ejemplo: `2025-10-25`
  - La disponibilidad se calcula a partir del día siguiente (26 de octubre en este caso)

#### Parámetros de Consulta (Opcionales)
- `ciudad_id` (opcional): ID de la ciudad para filtrar la disponibilidad
  - Si no se especifica, se considera toda la ciudad

### Ejemplo de Uso

```bash
# Obtener disponibilidad a partir del 26 de octubre de 2025
GET /api/pedidos/disponibilidad/2025-10-25

# Obtener disponibilidad para una ciudad específica
GET /api/pedidos/disponibilidad/2025-10-25?ciudad_id=1
```

### Respuesta

```json
{
  "success": true,
  "data": {
    "disponibilidad": [
      {
        "fecha": "2025-10-26",
        "manana_disponible": true,
        "tarde_disponible": true,
        "pedidos_manana": 2,
        "pedidos_tarde": 1,
        "capacidad_manana": 5,
        "capacidad_tarde": 5
      },
      {
        "fecha": "2025-10-27",
        "manana_disponible": false,
        "tarde_disponible": true,
        "pedidos_manana": 5,
        "pedidos_tarde": 3,
        "capacidad_manana": 5,
        "capacidad_tarde": 5
      },
      {
        "fecha": "2025-10-28",
        "manana_disponible": true,
        "tarde_disponible": true,
        "pedidos_manana": 0,
        "pedidos_tarde": 2,
        "capacidad_manana": 5,
        "capacidad_tarde": 5
      }
    ],
    "fecha_consulta": "2025-10-25",
    "ciudad_id": 1,
    "total_dias": 7
  }
}
```

### Estructura de la Respuesta

#### Campo `disponibilidad` (Array)
Cada objeto en el array representa un día y contiene:

- `fecha`: Fecha en formato `YYYY-MM-DD`
- `manana_disponible`: `boolean` - Si hay disponibilidad en el horario de mañana (8:00 AM - 12:00 PM)
- `tarde_disponible`: `boolean` - Si hay disponibilidad en el horario de tarde (2:00 PM - 6:00 PM)
- `pedidos_manana`: `number` - Cantidad de pedidos programados para la mañana
- `pedidos_tarde`: `number` - Cantidad de pedidos programados para la tarde
- `capacidad_manana`: `number` - Capacidad máxima para el horario de mañana (5)
- `capacidad_tarde`: `number` - Capacidad máxima para el horario de tarde (5)

#### Campos Adicionales
- `fecha_consulta`: Fecha que se pasó como parámetro
- `ciudad_id`: ID de la ciudad filtrada (null si no se especificó)
- `total_dias`: Número total de días en la respuesta (7)

### Lógica de Disponibilidad

#### Horarios
- **Mañana**: 8:00 AM - 12:00 PM
- **Tarde**: 2:00 PM - 6:00 PM

#### Capacidad
- **Máximo por horario**: 5 pedidos
- **Disponibilidad**: Se considera disponible si hay menos de 5 pedidos en ese horario

#### Estados Considerados
Solo se cuentan los pedidos con los siguientes estados:
- `pendiente`
- `confirmado`
- `en_preparacion`
- `en_camino`

Los pedidos `entregado` y `cancelado` no afectan la disponibilidad.

### Códigos de Estado HTTP

- `200`: Consulta exitosa
- `400`: Fecha de inicio inválida
- `500`: Error interno del servidor

### Casos de Uso

1. **Sistema de Reservas**: Mostrar al cliente qué días y horarios están disponibles
2. **Planificación de Entregas**: Ayudar a los administradores a planificar las entregas
3. **API de Integración**: Permitir que sistemas externos consulten la disponibilidad
4. **Bot de WhatsApp**: Responder automáticamente sobre disponibilidad

### Notas Importantes

- La consulta siempre retorna 7 días consecutivos
- La fecha de inicio se incrementa en 1 día automáticamente
- El endpoint es público (no requiere autenticación)
- Los horarios están definidos en horario local del servidor
- La capacidad máxima es configurable (actualmente 5 por horario)

### Ejemplo de Integración

```javascript
// Consultar disponibilidad
const response = await fetch('/api/pedidos/disponibilidad/2025-10-25?ciudad_id=1');
const data = await response.json();

if (data.success) {
  data.data.disponibilidad.forEach(dia => {
    console.log(`${dia.fecha}:`);
    console.log(`  Mañana: ${dia.manana_disponible ? 'Disponible' : 'No disponible'} (${dia.pedidos_manana}/${dia.capacidad_manana})`);
    console.log(`  Tarde: ${dia.tarde_disponible ? 'Disponible' : 'No disponible'} (${dia.pedidos_tarde}/${dia.capacidad_tarde})`);
  });
}
```
