const moment = require('moment-timezone');
const { City } = require('../models');

const DEFAULT_CITY_ID = 5;
const DEFAULT_TIMEZONE = 'America/Mexico_City';

const DAY_LABELS = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

function formatHour(hour) {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getCityTimezone(city) {
  return city?.timezone || DEFAULT_TIMEZONE;
}

/**
 * Resuelve la ciudad para evaluar horario de atención.
 * Prioridad: cliente de la conversación → pedido activo → ciudad 5 (Durango).
 *
 * @param {{ conversacion?: object, pedido?: object, pedidoWithCity?: object }} params
 * @returns {Promise<object|null>}
 */
async function resolveCityForConversation({ conversacion, pedido, pedidoWithCity } = {}) {
  const clienteCity = conversacion?.cliente?.ciudad;
  if (clienteCity) {
    return clienteCity;
  }

  const pedidoCity = pedidoWithCity?.ciudad || pedido?.ciudad;
  if (pedidoCity) {
    return pedidoCity;
  }

  if (pedido?.fkid_ciudad) {
    const cityFromPedidoId = await City.findByPk(pedido.fkid_ciudad);
    if (cityFromPedidoId) {
      return cityFromPedidoId;
    }
  }

  return City.findByPk(DEFAULT_CITY_ID);
}

/**
 * @param {object|null} city
 * @param {Date|string|moment.Moment} [now]
 * @returns {boolean}
 */
function isOutsideBusinessHours(city, now = new Date()) {
  if (!city) {
    return false;
  }

  const timezone = getCityTimezone(city);
  const local = moment(now).tz(timezone);
  const day = local.day();
  const diasTrabajo = typeof city.getDiasTrabajo === 'function'
    ? city.getDiasTrabajo()
    : (city.dias_trabajo || [0, 1, 2, 3, 4, 5, 6]);

  if (!diasTrabajo.includes(day)) {
    return true;
  }

  const { inicio, fin } = typeof city.getHorasEntregaParaDia === 'function'
    ? city.getHorasEntregaParaDia(day)
    : { inicio: 9, fin: 18 };

  const hourDecimal = local.hour() + local.minute() / 60 + local.second() / 3600;
  return hourDecimal < inicio || hourDecimal >= fin;
}

/**
 * @param {object|null} city
 * @returns {string}
 */
function buildScheduleLines(city) {
  if (!city) {
    return 'Consulta nuestro horario en la app.';
  }

  const diasTrabajo = typeof city.getDiasTrabajo === 'function'
    ? city.getDiasTrabajo()
    : (city.dias_trabajo || [0, 1, 2, 3, 4, 5, 6]);

  const sortedDays = [...diasTrabajo].sort((a, b) => a - b);

  return sortedDays
    .map((day) => {
      const { inicio, fin } = typeof city.getHorasEntregaParaDia === 'function'
        ? city.getHorasEntregaParaDia(day)
        : { inicio: 9, fin: 18 };
      const label = DAY_LABELS[day] || `Día ${day}`;
      return `${label}: ${formatHour(inicio)} - ${formatHour(fin)}`;
    })
    .join('\n');
}

/**
 * @param {object|null} city
 * @returns {string}
 */
function buildOutsideHoursMessage(city) {
  const schedule = buildScheduleLines(city);

  return (
    'Actualmente estamos fuera de horario de atención. Te atenderemos en el siguiente turno disponible.\n\n' +
    'Horario de atención:\n' +
    schedule
  );
}

module.exports = {
  DEFAULT_CITY_ID,
  DEFAULT_TIMEZONE,
  resolveCityForConversation,
  isOutsideBusinessHours,
  buildOutsideHoursMessage,
  buildScheduleLines,
  formatHour,
  getCityTimezone,
};
