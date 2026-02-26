/**
 * Parsea una fecha de entrega estimada en formato ISO (YYYY-MM-DD...) o en formato México (DD-MM-YYYY o DD-MM-YYYYT...).
 * @param {string|Date|null|undefined} value
 * @returns {Date|null} Objeto Date válido o null si no se puede parsear.
 */
function parseFechaEntregaEstimada(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const s = String(value).trim();
  if (!s) return null;

  // ISO: YYYY-MM-DD (con o sin hora)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Formato México: DD-MM-YYYY o DD-MM-YYYYT...
  const match = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:T(.+))?$/);
  if (match) {
    const [, dd, mm, yyyy, timePart] = match;
    const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}${timePart ? 'T' + timePart : ''}`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

module.exports = { parseFechaEntregaEstimada };
