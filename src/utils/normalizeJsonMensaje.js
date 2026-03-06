/**
 * Normaliza un JSON en texto que puede contener saltos de línea literales
 * dentro del valor del campo "mensaje", convirtiéndolos a \n para que
 * JSON.parse() pueda interpretarlo correctamente.
 * Útil cuando el cliente (ej. n8n, webhooks) envía payloads con newlines
 * sin escapar en el mensaje.
 *
 * @param {string} raw - JSON en texto (puede ser inválido por newlines en "mensaje")
 * @returns {string} JSON válido con newlines escapados en "mensaje"
 */
function normalizeJsonMensaje(raw) {
  if (typeof raw !== 'string') return raw;
  // Escapar saltos de línea literales dentro del valor de "mensaje"
  return raw.replace(
    /"mensaje"\s*:\s*"((?:[^"\\]|\\.)*)"/gs,
    (match, content) => {
      // Quitar espacios/tabs que vienen después de cada salto de línea (indentación del template)
      const sinIndent = content.replace(/(?:\r\n|\n|\r)[ \t]+/g, '\n');
      const escaped = sinIndent
        .replace(/\r\n/g, '\\n')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\n');
      return `"mensaje": "${escaped}"`;
    }
  );
}

module.exports = { normalizeJsonMensaje };
