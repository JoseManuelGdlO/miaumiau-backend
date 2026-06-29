jest.mock('../models', () => ({
  City: {
    findByPk: jest.fn(),
  },
}));

const { City } = require('../models');
const {
  resolveCityForConversation,
  isOutsideBusinessHours,
  buildOutsideHoursMessage,
  buildScheduleLines,
} = require('./cityBusinessHoursService');

function createMockCity(overrides = {}) {
  const diasTrabajo = overrides.dias_trabajo ?? [1, 2, 3, 4, 5];
  const horarioPorDia = overrides.horario_por_dia ?? {
    '1': { inicio: 9, fin: 18 },
    '2': { inicio: 9, fin: 18 },
    '3': { inicio: 9, fin: 18 },
    '4': { inicio: 9, fin: 18 },
    '5': { inicio: 9, fin: 18 },
  };

  return {
    id: overrides.id ?? 1,
    nombre: overrides.nombre ?? 'Test City',
    timezone: overrides.timezone ?? 'America/Mexico_City',
    dias_trabajo: diasTrabajo,
    horario_por_dia: horarioPorDia,
    getDiasTrabajo() {
      return this.dias_trabajo;
    },
    getHorasEntrega() {
      return { inicio: 9, fin: 18 };
    },
    getHorasEntregaParaDia(diaSemana) {
      const slot = this.horario_por_dia[String(diaSemana)];
      if (slot) return slot;
      return this.getHorasEntrega();
    },
    ...overrides,
  };
}

describe('cityBusinessHoursService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveCityForConversation', () => {
    it('usa la ciudad del cliente cuando está disponible', async () => {
      const clienteCity = createMockCity({ id: 10, nombre: 'Cliente City' });
      const pedidoCity = createMockCity({ id: 20, nombre: 'Pedido City' });

      const city = await resolveCityForConversation({
        conversacion: { cliente: { ciudad: clienteCity } },
        pedido: { ciudad: pedidoCity },
      });

      expect(city.id).toBe(10);
      expect(City.findByPk).not.toHaveBeenCalled();
    });

    it('usa la ciudad del pedido si el cliente no tiene ciudad', async () => {
      const pedidoCity = createMockCity({ id: 20, nombre: 'Pedido City' });

      const city = await resolveCityForConversation({
        conversacion: { cliente: null },
        pedido: { ciudad: pedidoCity },
      });

      expect(city.id).toBe(20);
    });

    it('carga la ciudad por fkid_ciudad del pedido si no viene incluida', async () => {
      const pedidoCity = createMockCity({ id: 30, nombre: 'Pedido FK' });
      City.findByPk.mockResolvedValue(pedidoCity);

      const city = await resolveCityForConversation({
        conversacion: {},
        pedido: { fkid_ciudad: 30 },
      });

      expect(City.findByPk).toHaveBeenCalledWith(30);
      expect(city.id).toBe(30);
    });

    it('usa ciudad 5 (Durango) como fallback', async () => {
      const durango = createMockCity({ id: 5, nombre: 'Durango' });
      City.findByPk.mockResolvedValue(durango);

      const city = await resolveCityForConversation({
        conversacion: {},
        pedido: {},
      });

      expect(City.findByPk).toHaveBeenCalledWith(5);
      expect(city.nombre).toBe('Durango');
    });
  });

  describe('isOutsideBusinessHours', () => {
    const city = createMockCity();

    it('retorna false dentro del horario en día laboral', () => {
      const monday10am = '2026-06-29T16:00:00.000Z'; // 10:00 CDMX (lunes)
      expect(isOutsideBusinessHours(city, monday10am)).toBe(false);
    });

    it('retorna true fuera del horario en día laboral', () => {
      const monday8pm = '2026-06-30T02:00:00.000Z'; // 20:00 CDMX (lunes)
      expect(isOutsideBusinessHours(city, monday8pm)).toBe(true);
    });

    it('retorna true en día no laboral', () => {
      const sunday10am = '2026-06-28T16:00:00.000Z'; // domingo 10:00 CDMX
      expect(isOutsideBusinessHours(city, sunday10am)).toBe(true);
    });

    it('retorna false si no hay ciudad', () => {
      expect(isOutsideBusinessHours(null)).toBe(false);
    });
  });

  describe('buildOutsideHoursMessage', () => {
    it('incluye horario por día laboral', () => {
      const city = createMockCity();
      const message = buildOutsideHoursMessage(city);

      expect(message).toContain('fuera de horario de atención');
      expect(message).toContain('siguiente turno disponible');
      expect(message).toContain('Lunes: 09:00 - 18:00');
      expect(buildScheduleLines(city)).toContain('Viernes: 09:00 - 18:00');
    });
  });
});
