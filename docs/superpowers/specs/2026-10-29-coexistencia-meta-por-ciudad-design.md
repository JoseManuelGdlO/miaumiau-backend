# Diseño: coexistencia de WhatsApp por ciudad

Fecha: 2026-10-29. Alcance: un perfil de vinculación con Meta por ciudad, en `miaumiau-back` y en el panel `catmate-control-center`. El flujo de Embedded Signup y de coexistencia es el de `asistente-openai`.

## Objetivo

Cada ciudad tiene un WhatsApp propio. Al crearla nace un perfil pendiente y un link de 14 días. Quien abre el link conecta el WhatsApp Business de esa ciudad con coexistencia. A partir de ahí, los mensajes de ese `phone_number_id` se envían con el token de la ciudad. Hasta que conecte, la ciudad sigue en la línea global (`WHATSAPP_API_TOKEN`).

Las ciudades que ya existen reciben el mismo perfil pendiente en una migración. Su link se copia desde Editar ciudad.

## Fuera de alcance

Varios números por ciudad. Reescribir n8n o el bot de pedidos. Mover el manejo de imágenes fuera de n8n. Cambiar la tabla `whatsapp_phone_numbers`. Cambiar los permisos de alta, edición y baja de ciudades que ya existen.

## Decisiones cerradas

- El perfil es una fila propia, una por ciudad. La ciudad sigue guardando horarios, zonas y puntos de venta.
- El token de Meta y el link en claro se guardan cifrados. El listado de ciudades no los incluye.
- El link dura 14 días. La página pública valida el hash y la fecha.
- La página `/vincular/:token` la sirve `miaumiau-back`. Quien conecta no entra al panel.
- Un `phone_number_id` pertenece como máximo a una ciudad.
- Si la vinculación falla antes de terminar, el perfil sigue pendiente y el link anterior sigue sirviendo.
- Si al enviar el número es de una ciudad conectada y el token no se puede leer, ese envío falla. No sale por la línea global.
- La baja lógica de la ciudad quita el perfil. Restaurar la ciudad crea un perfil pendiente nuevo y no recupera el WABA anterior.
- El webhook sigue siendo `GET` y `POST /api/mensajeria/webhook/whatsapp`. La app de Meta de este Embedded Signup debe entregar ahí.

## Datos

Tabla `city_whatsapp_profiles`.

| Columna | Regla |
| --- | --- |
| `city_id` | Entero, único, clave foránea a `cities.id`. Si la fila de la ciudad se borra de verdad, el perfil se borra en cascada. |
| `invite_token_hash` | SHA-256 hex del link, único, obligatorio. |
| `invite_token_encrypted` | Link en claro, cifrado, obligatorio mientras el perfil exista. |
| `invite_expires_at` | Obligatorio. |
| `invite_used_at` | Nulo hasta que la vinculación termina. |
| `waba_id`, `phone_number_id`, `business_id`, `display_phone` | Nulos hasta conectar. `phone_number_id` es único entre los no nulos. |
| `access_token_encrypted` | Nulo hasta conectar. |
| `coexistence_enabled` | Booleano, por defecto falso. |
| `coexistence_sync_error` | Nulo si no hubo sync o si la sync terminó. Texto si la sync de coexistencia falló y la conexión sí se guardó. |

`created_at` y `updated_at` como el resto de tablas.

El estado se calcula, no se guarda:

- Hay `phone_number_id`: `connected`.
- El link venció: `expired`.
- Hay `invite_used_at` y no hay número: `used`.
- En cualquier otro caso: `pending`.

El objeto público `whatsapp`, el único que viaja en el listado y en el detalle de la ciudad, tiene `connected`, `inviteStatus`, `displayPhone`, `coexistenceEnabled`, `expiresAt`. No incluye token, hash ni link.

## Cifrado

AES-256-GCM, igual que `asistente-openai`. La llave es `CREDENTIALS_ENCRYPTION_KEY`. Si falta, no se guarda nada en claro: alta de ciudad, migración, regenerar link y completar vinculación responden 503 y no escriben el perfil. En el alta, la ciudad y el perfil van en la misma transacción, así que un 503 no deja ciudad sin perfil.

## Alta, migración y baja

`POST /api/cities` crea la ciudad y el perfil en una transacción. La respuesta incluye `data.whatsapp.inviteUrl` y `data.whatsapp.expiresAt` además del estado público. El resto de campos de la ciudad no cambia.

La migración recorre las ciudades sin perfil, incluidas las de baja lógica, y crea un perfil pendiente. No imprime links. Si la llave falta, la migración aborta.

`deleteCity` sigue siendo baja lógica. Marca `baja_logica` y, si el perfil está conectado, intenta desuscribir el WABA. Si Meta no responde, el fallo queda en el log. Después borra la fila del perfil. `restoreCity` crea un perfil pendiente nuevo, con link nuevo, si esa ciudad no tiene perfil. La migración ya les crea perfil a las ciudades dadas de baja, así que restaurar una de esas no genera un segundo link.

## API de administración

Quien tiene `ver_ciudades` ve el objeto `whatsapp` en `GET /api/cities` y `GET /api/cities/:id`.

Estas rutas exigen `editar_ciudades`:

- `GET /api/cities/:id/whatsapp`. Si el estado es `pending`, incluye `inviteUrl`. Si está vencido, conectado o usado, no incluye link.
- `POST /api/cities/:id/whatsapp/invite`. Genera otro link de 14 días e invalida el anterior. Si la ciudad está conectada, responde 409 y no cambia nada. El mensaje pide desconectar primero.
- `POST /api/cities/:id/whatsapp/disconnect`. Si no hay `phone_number_id`, responde 404. Si lo hay, desuscribe el WABA, borra WABA, número, negocio, teléfono visible, token, `coexistence_enabled` y `coexistence_sync_error`, y deja un link nuevo. Un fallo de Meta al desuscribir queda en el log y la desconexión local sigue. La respuesta incluye `inviteUrl`.

El link es `{PUBLIC_BASE_URL}/vincular/{token}`. Sin `PUBLIC_BASE_URL`, se arma con el host de la petición.

## Página pública

`GET /vincular/:token` entrega el HTML. Ese HTML llama:

- `GET /api/public/meta/invite/:token`
- `POST /api/public/meta/signup`

No piden sesión. El Embedded Signup usa `featureType = whatsapp_business_app_onboarding` y `sessionInfoVersion = 3`.

`GET` del invite:

- Sin perfil para ese hash: 404, «El link de vinculación no es válido.»
- Conectado o usado: 410, «Este número ya está vinculado. Pide un link nuevo si necesitas reconectar.»
- Vencido: 410, «Este link ya venció. Pide uno nuevo a quien administra la ciudad.»
- Pendiente: 200, con el nombre de la ciudad, `configured` y la config pública (`appId`, `configId`, `graphVersion`, `featureType`, `sessionInfoVersion`). Sin secretos.

Si `configured` es falso, la página lista `META_APP_ID`, `META_APP_SECRET` y `META_EMBEDDED_SIGNUP_CONFIG_ID`. No abre Facebook y no marca la ciudad como conectada.

Si la persona cancela el login, o Meta no devuelve código, WABA o número, el perfil no cambia y el link sigue pendiente.

`POST /api/public/meta/signup` recibe `token`, `code`, `wabaId`, `phoneNumberId`, `businessId` y `event`. El orden es el de `asistente-openai`:

1. Validar el link.
2. Canjear el código por un access token.
3. Suscribir la app al WABA.
4. Dar de alta el WABA en el portafolio de la plataforma cuando `META_BUSINESS_ID` y el token de sistema existan. Si faltan, ese paso se omite y la vinculación sigue.
5. Resolver el número. Si el `phone_number_id` ya está en otra ciudad, 409 y no se escribe ninguna de las dos.
6. Coexistencia si el evento es `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`, o si el número tiene `is_on_biz_app` y `platform_type = CLOUD_API`.
7. Si hay coexistencia, lanzar `smb_app_state_sync`. Si esa llamada falla, se guarda la conexión y `coexistence_sync_error` con el mensaje. `coexistence_enabled` queda en verdadero.
8. Guardar WABA, número, negocio, teléfono visible, token cifrado, coexistencia y `invite_used_at`.

La config pública sale de `META_APP_ID`, `META_APP_SECRET`, `META_EMBEDDED_SIGNUP_CONFIG_ID` y `META_GRAPH_VERSION` (por defecto `v22.0`). El portafolio usa `META_BUSINESS_ID`, `META_SYSTEM_USER_ID` y `META_SYSTEM_USER_TOKEN`. La verificación del webhook no cambia: sigue en `WHATSAPP_VERIFY_TOKEN`.

## Envío y recepción

`src/utils/whatsapp.js` resuelve el token con el `phone_number_id` del envío:

- Hay perfil conectado para ese id y el token se descifra: se usa ese token.
- Hay perfil conectado y el token no se descifra: el envío falla. No se usa `WHATSAPP_API_TOKEN`.
- No hay perfil conectado para ese id: se usa `WHATSAPP_API_TOKEN`, como hoy.

Esa resolución mira el `phone_number_id` del envío. Conectar una ciudad no cambia `elegirLinea` ni `whatsapp_phone_numbers`. Un envío que sigue pasando el id de la línea global usa el token global. Un mensaje que Meta entrega al número conectado trae el `phone_number_id` de esa ciudad, y la respuesta sale con el token de esa ciudad.

El webhook ya lee `metadata.phone_number_id` y lo pasa a las respuestas. Esas respuestas caen en la misma resolución de token. No se agrega otro callback.

## Panel

En `catmate-control-center`, la tabla de Ciudades gana una columna WhatsApp. Muestra pendiente, link vencido o conectado. Si está conectado, muestra el número y, cuando aplique, que la coexistencia está activa.

El modal de crear ciudad, después de un alta correcta, muestra el link y un botón de copiar antes de cerrar.

Editar ciudad tiene un bloque WhatsApp para quien tiene `editar_ciudades`:

- Pendiente: link, vencimiento y Copiar link. Generar link nuevo pide confirmación.
- Vencido: solo Generar link nuevo.
- Conectado: número, coexistencia y Desconectar. Desconectar pide confirmación. Al terminar muestra el link nuevo. Hasta una conexión nueva, esa ciudad envía por la línea global.
- Quien solo tiene `ver_ciudades` ve el estado y no ve el link ni los botones.

## Errores que no cambian el perfil

Cancelar el login, código ausente, WABA ausente, número ausente, número repetido, llave de cifrado ausente, o regenerar un link de una ciudad conectada. En todos esos casos la fila queda como estaba.

Desuscribir un WABA al desconectar o al dar de baja es best-effort. El estado local sí cambia y el fallo queda en el log.

Un error al procesar el webhook de mensajes sigue respondiendo 200, como hoy, para que Meta no reintente en ráfaga. La verificación `GET` fallida sigue respondiendo 400.

## Pruebas

En `miaumiau-back`, con Jest y el cliente de Graph sustituido:

- Estado del link: pending, expired, used, connected.
- Cifrado y descifrado del token y del link.
- Alta de ciudad: una transacción, respuesta con `inviteUrl`, y rollback si el perfil no se puede crear.
- Invite público: 200, 404 y los dos 410.
- Signup: guarda número, token cifrado y coexistencia. Un número repetido responde 409 y no pisa el otro perfil. Una sync fallida guarda la conexión y `coexistence_sync_error`.
- Regenerar un perfil conectado responde 409. Desconectar borra credenciales y devuelve un link nuevo. Desconectar sin número responde 404.
- Resolución de token: ciudad conectada usa el suyo; ciudad pendiente o número desconocido usa el global; token ilegible no usa el global.
- La migración, sobre ciudades ya insertadas, deja un perfil pendiente por ciudad.

En el panel, con el backend local: crear una ciudad, copiar el link, ver la columna WhatsApp y, en editar, regenerar y desconectar. Quien no puede editar ciudades no ve el link.
