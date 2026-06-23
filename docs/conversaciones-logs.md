# Logs de conversación (`conversaciones_logs`)

## Propósito

La tabla `conversaciones_logs` registra **eventos de negocio y errores** asociados a una conversación. No es un duplicado del historial de chat (`conversaciones_chat`).

El panel de detalle carga los logs con:

```
GET /api/conversaciones-logs/conversacion/:conversacionId
```

Requiere permiso `ver_conversaciones_logs`.

## Tipos de log (`tipo_log`)

| Tipo | Uso |
|------|-----|
| `inicio` | Conversación creada |
| `mensaje` | Reservado para errores de mensajería (p. ej. fallo de WhatsApp). No se usa para cada mensaje enviado/recibido |
| `transferencia` | Conversación asignada a un cliente |
| `escalacion` | Escalación manual o futura (vía API) |
| `cierre` | Disponible en el modelo; cierres se registran como `sistema` |
| `error` | Disponible en el modelo; errores operativos usan `nivel: error` |
| `sistema` | Cambios de estado, pedidos, reaperturas, eventos n8n |

## Qué se registra automáticamente

- **Inicio** de conversación (`POST /conversaciones`, `findOrCreate`)
- **Cambios de status** (activa, pausada, cerrada, etc.)
- **Asignación de cliente** a conversación
- **Reapertura** automática cuando llega actividad en conversación cerrada
- **Pedido creado** vía `POST /api/pedidos` (n8n u otros): un log por cada conversación que coincida por teléfono, siempre que se cree un pedido nuevo
- **Cliente identificado** al preparar un pedido (si la conversación no tenía `id_cliente`)
- **Errores de WhatsApp** (`status: failed`, reenvío fallido de mensajes pendientes)
- **Pausa del bot** por modificación de pedido activo (n8n)
- **Baja lógica / restauración** de conversación o mensaje (admin)

## Qué ya no se registra

Para reducir ruido, **no** se crean logs cuando:

- Un usuario o el bot envía/recibe un mensaje de chat
- Un agente envía texto o imagen por WhatsApp
- WhatsApp reporta estados exitosos (`sent`, `delivered`, `read`)
- Se reenvía correctamente un mensaje pendiente del agente

El historial de mensajes sigue en `conversaciones_chat`.

## Log al crear pedido

Flujo en `POST /api/pedidos`:

1. Se crea el pedido.
2. Se vincula `id_cliente` / `id_pedido` en conversaciones del teléfono (si aplica).
3. Se registra **siempre** un log `sistema` por conversación encontrada:

```json
{
  "pedido_id": 123,
  "numero_pedido": "PED-001",
  "cliente_id": 45,
  "total": 1500,
  "estado": "pendiente",
  "fuente": "api_pedidos"
}
```

Descripción: `Pedido {numero_pedido} creado`.

## Errores y KPIs

- Los logs con `nivel: error` o `tipo_log: error` marcan conversaciones con error en el listado.
- Al **cerrar** una conversación (`status: cerrada`), los logs de error se ocultan (`baja_logica: true`) para que dejen de contar en filtros/KPI. No se restauran al reabrir la conversación.

## API de consulta

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/conversaciones-logs/conversacion/:id` | Todos los logs activos de una conversación (orden cronológico) |
| GET | `/conversaciones-logs` | Listado paginado con filtros |
| POST | `/conversaciones-logs` | Crear log manual (admite `tipo_log: mensaje` u otros) |

## Crear logs manualmente

El tipo `mensaje` permanece en el ENUM para uso futuro o registros puntuales vía `POST /conversaciones-logs`, pero el backend ya no lo genera en cada mensaje de chat.
