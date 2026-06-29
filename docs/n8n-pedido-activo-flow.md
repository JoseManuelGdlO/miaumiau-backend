# Flujo n8n: pedido activo y alerta de modificación

Endpoints para detectar si un usuario tiene un pedido en curso y, si intenta modificarlo vía bot, notificar al asesor y pausar la conversación automática.

## Resumen del flujo

1. Al recibir mensaje o clic en botón, n8n obtiene la conversación (`find-or-create`).
2. Si `conversacion.status === 'pausada'` → **no ejecutar** el flujo del bot (el asesor ya está atendiendo o se espera atención humana).
3. Si no está pausada → `GET /api/n8n/pedido-activo?telefono=...`
4. Si `tiene_pedido_activo === false` → continuar flujo normal del bot.
5. Si `tiene_pedido_activo === true` → `POST /api/n8n/alerta-modificacion-pedido`
6. Responder al usuario que un asesor lo atenderá.

## Autenticación

Mismo patrón que el resto de integraciones n8n: **JWT** en header `Authorization: Bearer <token>`.

Permisos requeridos:

| Endpoint | Permiso |
|----------|---------|
| `GET /api/n8n/pedido-activo` | `ver_pedidos` |
| `POST /api/n8n/alerta-modificacion-pedido` | `crear_notificaciones` |

El usuario de servicio de n8n (p. ej. super_admin) debe tener ambos permisos.

---

## 1. Verificar pedido activo

**`GET /api/n8n/pedido-activo?telefono={telefono}`**

### Query params

| Parámetro | Requerido | Descripción |
|-----------|-----------|-------------|
| `telefono` | Sí | Teléfono del usuario (WhatsApp) |

### Estados considerados "activos"

Solo cuenta pedidos con:

- `pendiente`
- `en_camino`

No cuenta: `entregado`, `cancelado`, `no_entregado`, `confirmado`, `en_preparacion`.

### Respuesta

```json
{
  "success": true,
  "tiene_pedido_activo": true,
  "pedido": {
    "id": 123,
    "numero_pedido": "PED-2024-001",
    "estado": "en_camino"
  }
}
```

Si no hay pedido activo:

```json
{
  "success": true,
  "tiene_pedido_activo": false,
  "pedido": null
}
```

### Expresión IF en n8n

```
{{ $json.tiene_pedido_activo === true }}
```

---

## 2. Crear alerta y pausar bot

**`POST /api/n8n/alerta-modificacion-pedido`**

### Body

```json
{
  "telefono": "5215512345678",
  "fkid_conversacion": 42,
  "texto_boton": "Cambiar dirección",
  "mensaje_usuario": "Quiero modificar mi pedido",
  "pedido_id": 123
}
```

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `telefono` | Sí | Teléfono del usuario |
| `fkid_conversacion` | Sí | ID de la conversación activa |
| `texto_boton` | No | Texto del botón presionado |
| `mensaje_usuario` | No | Último mensaje del usuario |
| `pedido_id` | No | ID del pedido (del paso 1, evita re-consulta) |

### Qué hace el endpoint

1. Valida que la conversación exista y que el teléfono coincida con `conversacion.from`.
2. Re-valida que el usuario tenga pedido activo (`pendiente` o `en_camino`).
3. Crea notificación en `/api/notificaciones` (inbox del asesor) con acción por defecto para ir a la conversación.
4. Pone la conversación en `status: 'pausada'` (el bot deja de procesar a ese usuario).
5. Anti-spam: si ya está pausada y hay notificación no leída reciente (2 h), no duplica.
6. **Fuera de horario:** si la hora actual (timezone de la ciudad) está fuera del horario configurado, envía un mensaje de WhatsApp al cliente indicando que será atendido en el siguiente turno y muestra el horario de atención. El flujo de notificación y pausa **no cambia**.

### Evaluación de horario por ciudad

El horario se configura por ciudad en el panel admin (`dias_trabajo` + `horario_por_dia`).

Resolución de ciudad (en este orden):

1. Ciudad del cliente asociado a la conversación (`cliente.fkid_ciudad`)
2. Ciudad del pedido activo (`pedido.fkid_ciudad`)
3. Ciudad **5 (Durango)** por defecto

Se considera **fuera de horario** si:

- El día actual no está en `dias_trabajo`, o
- La hora local (según `city.timezone`) está antes de `inicio` o en/ después de `fin` del slot del día.

El mensaje al cliente solo se envía cuando `creada: true` (no en la rama anti-spam).

Ejemplo de mensaje al cliente:

```
Actualmente estamos fuera de horario de atención. Te atenderemos en el siguiente turno disponible.

Horario de atención:
Lunes: 09:00 - 18:00
Martes: 09:00 - 18:00
...
```

### Respuesta exitosa (201)

```json
{
  "success": true,
  "creada": true,
  "fuera_de_horario": true,
  "mensaje_cliente_enviado": true,
  "conversacion_pausada": true,
  "conversacion": {
    "id": 42,
    "status": "pausada"
  },
  "notificacion": {
    "id": 55,
    "nombre": "Cliente con pedido activo solicita cambios",
    "prioridad": "alta"
  }
}
```

| Campo | Descripción |
|-------|-------------|
| `fuera_de_horario` | `true` si la solicitud ocurrió fuera del horario de la ciudad |
| `mensaje_cliente_enviado` | `true` si se envió (o encoló) el WhatsApp de aviso al cliente |

Dentro de horario, `fuera_de_horario` y `mensaje_cliente_enviado` son `false`.

### Anti-spam (200, sin duplicar)

```json
{
  "success": true,
  "creada": false,
  "conversacion_pausada": true,
  "conversacion": {
    "id": 42,
    "status": "pausada"
  },
  "notificacion": {
    "id": 55,
    "nombre": "Cliente con pedido activo solicita cambios",
    "prioridad": "alta"
  }
}
```

### Errores comunes

| Código | Motivo |
|--------|--------|
| `400` | Teléfono no coincide con la conversación |
| `404` | Conversación no encontrada |
| `409` | El usuario ya no tiene pedido activo en pendiente/en_camino |

### Estructura de `notificacion.datos`

```json
{
  "tipo": "modificacion_pedido_activo",
  "conversacionId": 42,
  "telefono": "5215512345678",
  "pedidoId": 123,
  "numeroPedido": "PED-2024-001",
  "estadoPedido": "en_camino",
  "textoBoton": "Cambiar dirección",
  "mensajeUsuario": "Quiero modificar mi pedido",
  "accion": {
    "tipo": "ir_conversacion",
    "conversacionId": 42,
    "ruta": "/conversaciones/42"
  }
}
```

El panel admin debe usar `datos.accion` para navegar al hacer clic en la notificación.

---

## Reactivar conversación (asesor)

Cuando el asesor termine de atender, reactivar manualmente:

**`PATCH /api/conversaciones/:id/status`**

```json
{
  "status": "activa"
}
```

---

## Ejemplo de secuencia en n8n

```
[Webhook WhatsApp]
    → [find-or-create conversación]
    → [IF status === 'pausada'] → STOP
    → [HTTP GET pedido-activo]
    → [IF tiene_pedido_activo]
         → true: [HTTP POST alerta-modificacion-pedido]
                 → [Enviar mensaje: "Un asesor te atenderá pronto"]
         → false: [Flujo normal del bot]
```

### Nodo HTTP — pedido activo

- Method: `GET`
- URL: `{{$env.API_BASE}}/api/n8n/pedido-activo?telefono={{ $('find-or-create').item.json.data.conversacion.from }}`
- Auth: Bearer token

### Nodo HTTP — alerta

- Method: `POST`
- URL: `{{$env.API_BASE}}/api/n8n/alerta-modificacion-pedido`
- Body:

```json
{
  "telefono": "{{ $('find-or-create').item.json.data.conversacion.from }}",
  "fkid_conversacion": {{ $('find-or-create').item.json.data.conversacion.id }},
  "texto_boton": "{{ $json.texto_boton || '' }}",
  "mensaje_usuario": "{{ $json.mensaje_usuario || '' }}",
  "pedido_id": {{ $('pedido-activo').item.json.pedido?.id || null }}
}
```
