jest.mock('../../models', () => ({
  City: {
    findByPk: jest.fn(),
    findByNameAndDepartment: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
  CityPointOfSale: {},
  Cliente: {},
  CityWhatsappProfile: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
}));
jest.mock('../../utils/cityMapper', () => ({
  mapCityNameToId: jest.fn(),
  validateAndGetCity: jest.fn(),
}));
jest.mock('../../config/database', () => ({ sequelize: { transaction: jest.fn() } }));
jest.mock('../../services/cityWhatsappService', () => ({ issueCityProfile: jest.fn() }));

const { City } = require('../../models');
const { mapCityNameToId } = require('../../utils/cityMapper');
const { sequelize } = require('../../config/database');
const controller = require('./controller');

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

beforeEach(() => jest.clearAllMocks());

test('errorDeRuta rechaza valores que no caben en la columna', () => {
  expect(controller.errorDeRuta({ prioridad_ruta: 'rapida' })).toBe('La prioridad de la ruta debe ser hora o distancia');
  expect(controller.errorDeRuta({ entregas_por_horario: 'si' })).toBe('entregas_por_horario debe ser verdadero o falso');
  expect(controller.errorDeRuta({ entregas_por_horario: false, prioridad_ruta: 'distancia' })).toBeNull();
  expect(controller.errorDeRuta({})).toBeNull();
});

test('aplicarRuta no inventa defaults y deja booleanos reales', () => {
  expect(controller.aplicarRuta({ entregas_por_horario: 0, prioridad_ruta: 'distancia' })).toEqual({
    entregas_por_horario: false,
    prioridad_ruta: 'distancia',
  });
  expect(controller.aplicarRuta({})).toEqual({});
});

test('createCity no persiste prioridad_ruta inválida', async () => {
  City.findByNameAndDepartment.mockResolvedValue(null);
  const res = mockRes();
  await controller.createCity({
    body: {
      nombre: 'Durango',
      departamento: 'Durango',
      direccion_operaciones: 'Calle Independencia 12',
      prioridad_ruta: 'rapida',
    },
  }, res, jest.fn());
  expect(res.statusCode).toBe(400);
  expect(sequelize.transaction).not.toHaveBeenCalled();
  expect(City.create).not.toHaveBeenCalled();
});

test('createCity no persiste entregas_por_horario inválido', async () => {
  City.findByNameAndDepartment.mockResolvedValue(null);
  const res = mockRes();
  await controller.createCity({
    body: {
      nombre: 'Durango',
      departamento: 'Durango',
      direccion_operaciones: 'Calle Independencia 12',
      entregas_por_horario: 'siempre',
    },
  }, res, jest.fn());
  expect(res.statusCode).toBe(400);
  expect(City.create).not.toHaveBeenCalled();
});

test('updateCity rechaza prioridad_ruta inválida y guarda hora o distancia', async () => {
  mapCityNameToId.mockResolvedValue(3);
  const city = { id: 3, update: jest.fn().mockResolvedValue(true) };
  City.findByPk.mockResolvedValue(city);

  const bad = mockRes();
  await controller.updateCity({
    params: { id: '3' },
    body: { prioridad_ruta: 'rapida' },
  }, bad, jest.fn());
  expect(bad.statusCode).toBe(400);
  expect(city.update).not.toHaveBeenCalled();

  const ok = mockRes();
  await controller.updateCity({
    params: { id: '3' },
    body: { entregas_por_horario: false, prioridad_ruta: 'distancia' },
  }, ok, jest.fn());
  expect(ok.statusCode).toBe(200);
  expect(city.update).toHaveBeenCalledWith(expect.objectContaining({
    entregas_por_horario: false,
    prioridad_ruta: 'distancia',
  }));
});
