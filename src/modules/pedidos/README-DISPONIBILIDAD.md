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
        "disponible": true,
        "pedidos": 2,
        "capacidad": 5
      },
      {
        "fecha": "2025-10-27",
        "disponible": false,
        "pedidos": 5,
        "capacidad": 5
      },
      {
        "fecha": "2025-10-28",
        "disponible": true,
        "pedidos": 0,
        "capacidad": 5
      },
      {
        "fecha": "2025-10-29",
        "disponible": false,
        "pedidos": 0,
        "capacidad": 5,
        "motivo_no_disponible": "Día no laboral"
      }
    ],
    "fecha_consulta": "2025-10-25",
    "ciudad": null,
    "total_dias": 7
  }
}
```

### Estructura de la Respuesta

#### Campo `disponibilidad` (Array)
Cada objeto en el array representa un día y contiene:

- `fecha`: Fecha en formato `YYYY-MM-DD`
- `disponible`: `boolean` - Si hay disponibilidad en el horario de entrega del día
- `pedidos`: `number` - Cantidad de pedidos programados para ese día en el horario de entrega
- `capacidad`: `number` - Capacidad máxima para el horario de entrega (p. ej. 5)
- `motivo_no_disponible`: `string` (solo en días no laborales) - Ej.: "Día no laboral"

#### Campos Adicionales
- `fecha_consulta`: Fecha que se pasó como parámetro
- `ciudad`: Objeto con `id`, `nombre` e `input_original` si se filtró por ciudad; `null` en caso contrario
- `total_dias`: Número total de días en la respuesta (7)

### Lógica de Disponibilidad

#### Horarios
- **Único horario de entrega**: 8:00 AM - 6:00 PM (configurable en el controller)

#### Capacidad
- **Máximo por día (único horario)**: 5 pedidos (configurable por ciudad)
- **Disponibilidad**: Se considera disponible si hay menos de 5 pedidos en ese día dentro del horario

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
- La capacidad máxima es configurable por ciudad (actualmente 5 por día en el único horario)

### Ejemplo de Integración

```javascript
// Consultar disponibilidad
const response = await fetch('/api/pedidos/disponibilidad/2025-10-25?ciudad_id=1');
const data = await response.json();

if (data.success) {
  data.data.disponibilidad.forEach(dia => {
    console.log(`${dia.fecha}: ${dia.disponible ? 'Disponible' : 'No disponible'} (${dia.pedidos}/${dia.capacidad})`);
  });
}
```
