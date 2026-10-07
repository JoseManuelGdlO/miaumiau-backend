-- Esquema PostgreSQL para el bot de n8n (Miaumiau)
-- Extraído del workflow botn8n.txt
--
-- Uso:
--   psql -U postgres -d TU_BASE -f scripts/postgres/init-n8n-tables.sql
--
-- Tablas:
--   1. steps            - estado del flujo conversacional por teléfono
--   2. pedido_sesion    - carrito y datos del pedido en curso
--   3. conversaciones   - deduplicación de mensajes WhatsApp entrantes
--   4. n8n_chat_histories - memoria de chat LangChain (Postgres Chat Memory)

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. steps
--    Nodos: findSession, InsertarSesisonStep, updateStep*, selectStep*
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS steps (
  sessionid  VARCHAR(50)  PRIMARY KEY,
  step       VARCHAR(100),
  substep    VARCHAR(100),
  laststep   VARCHAR(100),
  "order"    JSONB
);

COMMENT ON TABLE steps IS 'Estado del flujo del bot por session_id (teléfono WhatsApp)';
COMMENT ON COLUMN steps."order" IS 'JSON con datos temporales del pedido en construcción';

-- ---------------------------------------------------------------------------
-- 2. pedido_sesion
--    Nodos: confirmarProductos, findSession2, validar/aplicarCodigo (backend)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedido_sesion (
  id                              SERIAL PRIMARY KEY,
  session_id                      VARCHAR(50)  NOT NULL UNIQUE,
  productos                       JSONB,
  direccion                       JSONB,
  mensaje_confirmacion_direccion  BOOLEAN      DEFAULT FALSE,
  metodo_pago                     VARCHAR(50),
  codigo_promocional              BOOLEAN      DEFAULT FALSE,
  promocion_aplicada              JSONB,
  pago                            JSONB,
  fecha_creacion                  TIMESTAMPTZ  DEFAULT NOW(),
  fecha_actualizacion             TIMESTAMPTZ  DEFAULT NOW(),
  fecha_entrega                   JSONB,
  ciudad                          VARCHAR(100),
  cliente_nombre                  VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_pedido_sesion_session_id ON pedido_sesion (session_id);

COMMENT ON TABLE pedido_sesion IS 'Sesión de pedido activa por teléfono WhatsApp';
COMMENT ON COLUMN pedido_sesion.productos IS 'JSON: { productos: [...], paquetes: [...], ciudad?: string }';
COMMENT ON COLUMN pedido_sesion.direccion IS 'JSON: { complete_addres: string }';
COMMENT ON COLUMN pedido_sesion.pago IS 'JSON: { forma: string, promocion_aplicada?: object }';
COMMENT ON COLUMN pedido_sesion.fecha_entrega IS 'JSON: { fecha, manana, tarde, confirmado, mensaje_usuario }';

-- ---------------------------------------------------------------------------
-- 3. conversaciones (Postgres — dedup de mensajes, NO es la tabla MySQL)
--    Nodos: Messages, InsertarMensajes, Update rows in a table1
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversaciones (
  id_message  VARCHAR(255) PRIMARY KEY,
  procesado   BOOLEAN      NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE conversaciones IS 'Control de mensajes WhatsApp ya procesados (evita duplicados)';

-- ---------------------------------------------------------------------------
-- 4. n8n_chat_histories
--    Nodos: Postgres Chat Memory (LangChain)
--    n8n la crea automáticamente al primer uso; incluida por si acaso.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS n8n_chat_histories (
  id          SERIAL PRIMARY KEY,
  session_id  VARCHAR(255) NOT NULL,
  message     JSONB        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_n8n_chat_histories_session_id
  ON n8n_chat_histories (session_id);

COMMENT ON TABLE n8n_chat_histories IS 'Historial de conversación para agentes LangChain en n8n';

COMMIT;
