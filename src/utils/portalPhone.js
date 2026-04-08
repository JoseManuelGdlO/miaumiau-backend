/**
 * Normaliza teléfono para búsqueda: solo dígitos (últimos 10 para coincidir MX típico).
 */
function normalizeTelefono(input) {
  if (!input || typeof input !== 'string') return '';
  const digits = input.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

module.exports = { normalizeTelefono };
