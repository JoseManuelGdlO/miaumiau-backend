const CORTE_TARDE = 12;
const MINUTOS_MANANA = 150;
const MINUTOS_ENTREGA = 10;

function minutosViaje(a, b) {
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return MINUTOS_ENTREGA + 15;
  const kmLat = (lat2 - lat1) * 111;
  const kmLng = (lng2 - lng1) * 111 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return MINUTOS_ENTREGA + Math.round((Math.hypot(kmLat, kmLng) / 30) * 60);
}

// shortcut: 30 km/h y 150 min de mañana; subir cuando la asignación use la matriz de Google.
function idsExcedentesManana(paradas) {
  const manana = (paradas || [])
    .filter((parada) => parada && parada.franja !== 'tarde')
    .slice()
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
  let usados = 0;
  let previo = null;
  const sobran = [];
  for (const parada of manana) {
    const costo = previo ? minutosViaje(previo, parada) : MINUTOS_ENTREGA;
    if (usados > 0 && usados + costo > MINUTOS_MANANA) sobran.push(parada.id);
    else {
      usados += costo;
      previo = parada;
    }
  }
  return sobran;
}

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

const VENTANAS = {
  manana: { texto: '09:30:00', franja: 'manana' },
  tarde: { texto: '12:00:00', franja: 'tarde' },
  cualquiera: { texto: null, franja: null },
};

function ventanaDeHorario(value) {
  if (value === 'manana' || value === 'tarde' || value === 'cualquiera') return value;
  const hora = horaDe(value);
  if (!hora) return 'cualquiera';
  return hora.hour >= CORTE_TARDE ? 'tarde' : 'manana';
}

function franjaDeHorario(value) {
  const ventana = value === 'manana' || value === 'tarde' || value === 'cualquiera'
    ? value
    : ventanaDeHorario(value);
  if (ventana === 'cualquiera') return null;
  return ventana;
}

function horarioNormalizado(value) {
  if (value == null || value === '') return null;
  const hora = horaDe(value);
  return hora ? `${hora.texto}:00` : null;
}

const AVISO_HORARIO = 'La entrega es de 9:30 a 17:00.';

function prioridadRutaDeCiudad(city) {
  if (!city || city.entregas_por_horario === false || city.entregas_por_horario === 0) return 'distancia';
  return city.prioridad_ruta === 'distancia' ? 'distancia' : 'hora';
}

function horarioDeEntrega(value, ventana, city) {
  if (city && (city.entregas_por_horario === false || city.entregas_por_horario === 0)) {
    return { ok: true, texto: null, franja: null, ajustado: false, aviso: AVISO_HORARIO, ventana: 'cualquiera' };
  }
  const clave = ventana === 'manana' || ventana === 'tarde' || ventana === 'cualquiera' ? ventana : null;
  if (clave) {
    const canon = VENTANAS[clave];
    return { ok: true, texto: canon.texto, franja: canon.franja, ajustado: false, aviso: AVISO_HORARIO, ventana: clave };
  }
  if (value == null || String(value).trim() === '') {
    return { ok: true, texto: null, franja: null, ajustado: false, aviso: AVISO_HORARIO, ventana: 'cualquiera' };
  }
  const hora = horaDe(value);
  if (!hora) return { ok: false, message: 'La hora de entrega no es válida' };
  let minutos = hora.hour * 60 + Number(hora.texto.slice(3));
  let ajustado = false;
  if (minutos < 9 * 60 + 30) {
    minutos = 9 * 60 + 30;
    ajustado = true;
  } else if (minutos > 17 * 60) {
    minutos = 17 * 60;
    ajustado = true;
  }
  const hour = Math.floor(minutos / 60);
  const texto = `${String(hour).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
  const franja = hour >= CORTE_TARDE ? 'tarde' : 'manana';
  return {
    ok: true,
    texto: `${texto}:00`,
    franja,
    ajustado,
    aviso: AVISO_HORARIO,
    ventana: franja,
  };
}

module.exports = { CORTE_TARDE, AVISO_HORARIO, VENTANAS, ventanaDeHorario, franjaDeHorario, horarioNormalizado, horarioDeEntrega, idsExcedentesManana, prioridadRutaDeCiudad };
