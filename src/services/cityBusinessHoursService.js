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

const DAY_PLURALS = {
  0: 'Domingos',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábados',
};

function formatTime12(hour24, { compact = true } = {}) {
  let h = hour24 > 12 ? hour24 - 12 : hour24;
  if (h === 0) h = 12;
  const ampm = hour24 >= 12 ? 'pm' : 'am';
  if (compact) {
    return `${h}${ampm}`;
  }
  return `${h}:00 ${ampm}`;
}

function formatDaysArray(days) {
  const joined = days.join(',');

  if (joined === '1,2,3,4,5') return 'Lunes a viernes';
  if (joined === '1,2,3,4,5,6') return 'Lunes a sábado';

  const isConsecutive = days.length > 1 && days.every((val, i, arr) => i === 0 || val === arr[i - 1] + 1);
  if (isConsecutive) {
    return `${DAY_LABELS[days[0]]} a ${DAY_LABELS[days[days.length - 1]].toLowerCase()}`;
  }

  if (days.length === 1) return DAY_PLURALS[days[0]];

  const mappedNames = days.map((d) => DAY_LABELS[d]);
  const last = mappedNames.pop();
  return `${mappedNames.join(', ')} y ${last.toLowerCase()}`;
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

  if (!diasTrabajo || diasTrabajo.length === 0) {
    return 'Horario no disponible en este momento.';
  }

  const scheduleGroups = {};
  const sortedDays = [...diasTrabajo].sort((a, b) => a - b);

  sortedDays.forEach((dayNum) => {
    const { inicio, fin } = typeof city.getHorasEntregaParaDia === 'function'
      ? city.getHorasEntregaParaDia(dayNum)
      : { inicio: 9, fin: 18 };
    const timeStr = `${formatTime12(inicio)} a ${formatTime12(fin)}`;
    if (!scheduleGroups[timeStr]) {
      scheduleGroups[timeStr] = [];
    }
    scheduleGroups[timeStr].push(dayNum);
  });

  return Object.entries(scheduleGroups)
    .map(([timeStr, days]) => `- ${formatDaysArray(days)} de ${timeStr}`)
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
  formatTime12,
  formatDaysArray,
  getCityTimezone,
};
