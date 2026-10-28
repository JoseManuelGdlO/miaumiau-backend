const CORTE_TARDE = 14;

function horaDe(value) {
  if (value == null || value === '') return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return {
    hour,
    texto: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

function franjaDeHorario(value) {
  const hora = horaDe(value);
  if (!hora) return null;
  return hora.hour >= CORTE_TARDE ? 'tarde' : 'manana';
}

function horarioNormalizado(value) {
  if (value == null || value === '') return null;
  const hora = horaDe(value);
  return hora ? `${hora.texto}:00` : null;
}

function horarioDeEntrega(value) {
  if (value == null || String(value).trim() === '') return { ok: true, texto: null, franja: null };
  const hora = horaDe(value);
  if (!hora) return { ok: false, message: 'La hora de entrega no es válida' };
  const minutos = hora.hour * 60 + Number(hora.texto.slice(3));
  if (minutos < 9 * 60 || minutos > 21 * 60) {
    return { ok: false, message: 'La entrega solo puede ser entre las 9:00 y las 21:00' };
  }
  return {
    ok: true,
    texto: `${hora.texto}:00`,
    franja: hora.hour >= CORTE_TARDE ? 'tarde' : 'manana',
  };
}

module.exports = { CORTE_TARDE, franjaDeHorario, horarioNormalizado, horarioDeEntrega };
