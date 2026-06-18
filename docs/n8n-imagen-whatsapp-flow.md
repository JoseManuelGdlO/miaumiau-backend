# Flujo n8n: imágenes de WhatsApp

Guía para procesar mensajes entrantes de tipo `image`, persistir la imagen en el backend y notificar al asesor. La orquestación completa vive en n8n; el backend expone un único endpoint que descarga la imagen de Meta y la guarda en la conversación.

## Resumen del flujo

1. Webhook recibe mensaje con `type: "image"`.
2. Nodo Code detecta imagen y extrae `imageMeta`.
3. `find-or-create` conversación (flujo existente).
4. `POST /api/n8n/whatsapp-imagen` → descarga de Meta, URL estable y mensaje de chat.
5. Enviar mensaje al usuario: *"Recibimos tu imagen, un asesor la revisará pronto."*
6. `POST /api/notificaciones` → avisar al asesor.
7. **STOP** — no continuar al flujo del bot/LLM.

## Autenticación

Mismo patrón JWT: `Authorization: Bearer <token>`.

| Endpoint | Permiso |
|----------|---------|
| `POST /api/n8n/whatsapp-imagen` | `ver_conversaciones_chat` |
| `POST /api/notificaciones` | `crear_notificaciones` |

---

## 1. Nodo Code — detectar imagen

Añadir antes del fallback `[unsupported_message_type]`:

```javascript
let imageMeta = null;

// ... ramas texto, botón, interactive, order ...

else if (message.type === 'image' && message.image) {
  messageType = 'image';
  messageIncoming = message.image.caption?.trim() || '[imagen]';
  imageMeta = {
    media_id: message.image.id ?? null,
    mime_type: message.image.mime_type ?? null,
    sha256: message.image.sha256 ?? null,
    caption: message.image.caption ?? null,
  };
}

if (!messageIncoming) {
  messageIncoming = '[unsupported_message_type]';
}

return {
  json: {
    sessionId,
    messageIncoming,
    idIncoming,
    contacts,
    phoneNumber,
    messageType,
    productos,
    imageMeta,
    rawMessage: message,
  },
};
```

---

## 2. Rama IF `messageType === 'image'`

### Paso A — Descargar imagen y guardar en conversación

- Method: `POST`
- URL: `{{$env.API_BASE}}/api/n8n/whatsapp-imagen`
- Auth: Bearer token
- Body:

```json
{
  "fkid_conversacion": {{ $('find-or-create').item.json.data.conversacion.id }},
  "media_id": "{{ $('Code').item.json.imageMeta.media_id }}",
  "mime_type": "{{ $('Code').item.json.imageMeta.mime_type }}",
  "mensaje": "{{ $('Code').item.json.messageIncoming }}",
  "whatsapp_message_id": "{{ $('Code').item.json.idIncoming }}",
  "caption": "{{ $('Code').item.json.imageMeta.caption }}"
}
```

Respuesta esperada (201):

```json
{
  "success": true,
  "message": "Imagen recibida y guardada en la conversación",
  "data": {
    "chat": { "id": 123, "tipo_mensaje": "imagen", "metadata": { "image_url": "..." } },
    "image_url": "https://.../uploads/conversaciones/abc.jpg",
    "filename": "abc.jpg",
    "mime_type": "image/jpeg",
    "size_bytes": 123456
  }
}
```

### Paso B — Responder al usuario

Usar el nodo existente de envío WhatsApp (texto):

> Recibimos tu imagen, un asesor la revisará pronto.

### Paso C — Notificar asesor

- Method: `POST`
- URL: `{{$env.API_BASE}}/api/notificaciones`
- Body:

```json
{
  "nombre": "Cliente envió una imagen",
  "descripcion": "{{ $('find-or-create').item.json.data.conversacion.from }} envió una imagen en la conversación #{{ $('find-or-create').item.json.data.conversacion.id }}",
  "prioridad": "media",
  "datos": {
    "tipo": "imagen_recibida",
    "conversacionId": {{ $('find-or-create').item.json.data.conversacion.id }},
    "telefono": "{{ $('find-or-create').item.json.data.conversacion.from }}",
    "accion": {
      "tipo": "ir_conversacion",
      "conversacionId": {{ $('find-or-create').item.json.data.conversacion.id }},
      "ruta": "/dashboard/conversations/{{ $('find-or-create').item.json.data.conversacion.id }}"
    }
  }
}
```

### Paso D — Fin de rama

No enrutar `messageIncoming` al flujo del bot ni al LLM.

---

## Diagrama

```
[Webhook WhatsApp]
    → [Code: parse message]
    → [IF messageType === 'image']
         → [find-or-create conversación]
         → [POST whatsapp-imagen]
         → [Enviar texto al usuario]
         → [POST notificaciones]
         → STOP
    → [ELSE flujo normal texto/bot]
```

---

## Errores comunes (whatsapp-imagen)

| Código | Motivo |
|--------|--------|
| `400` | `media_id` inválido, mime no soportado o campos obligatorios faltantes |
| `404` | Media expirada o no encontrada en Meta |
| `413` | Imagen mayor a 5 MB |
| `502` | Fallo al consultar o descargar desde Graph API |
| `500` | Error al persistir el chat (p. ej. `fkid_conversacion` inválido) |

**Nota:** La URL del webhook (`lookaside.fbsbx.com`) expira. Siempre usar `POST /api/n8n/whatsapp-imagen` para obtener una URL estable en `/uploads/conversaciones/` y el mensaje en la conversación en una sola petición.
