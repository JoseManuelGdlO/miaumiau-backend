/**
 * Última palabra del nombre completo (apellido esperado en primer acceso).
 */
function apellidoFromNombreCompleto(nombreCompleto) {
  if (!nombreCompleto || typeof nombreCompleto !== 'string') return '';
  const parts = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

/** Compara contraseña inicial sin importar mayúsculas/acentos. */
function normalizeForCompare(str) {
  if (str == null || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function apellidoMatchesPassword(nombreCompleto, passwordPlain) {
  const apellido = apellidoFromNombreCompleto(nombreCompleto);
  if (!apellido || passwordPlain == null) return false;
  return normalizeForCompare(apellido) === normalizeForCompare(passwordPlain);
}

module.exports = {
  apellidoFromNombreCompleto,
  normalizeForCompare,
  apellidoMatchesPassword
};
