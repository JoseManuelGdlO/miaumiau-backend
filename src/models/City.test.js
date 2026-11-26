const { DataTypes } = require('sequelize');
const CityFactory = require('./City');
const migration = require('../../migrations/20261125150001-city-horario-y-prioridad-ruta');

function cityModel() {
  const Model = function City() {};
  Model.prototype = {};
  Model.addScope = () => {};
  const sequelize = {
    define(_name, attrs) {
      Model.rawAttributes = attrs;
      return Model;
    },
  };
  return CityFactory(sequelize, DataTypes);
}

test('City define entregas_por_horario y prioridad_ruta hora|distancia', () => {
  const City = cityModel();
  expect(City.rawAttributes.entregas_por_horario.defaultValue).toBe(true);
  expect(City.rawAttributes.entregas_por_horario.allowNull).toBe(false);
  expect(City.rawAttributes.prioridad_ruta.defaultValue).toBe('hora');
  expect(City.rawAttributes.prioridad_ruta.validate.isIn[0]).toEqual(['hora', 'distancia']);
});

test('la migración agrega las dos columnas con esos defaults', async () => {
  const added = [];
  await migration.up({
    addColumn: async (table, col, def) => added.push({ table, col, def }),
  }, DataTypes);
  expect(added.map((row) => row.col)).toEqual(['entregas_por_horario', 'prioridad_ruta']);
  expect(added[0].def.defaultValue).toBe(true);
  expect(added[1].def.defaultValue).toBe('hora');
});
