const { createCityWhatsappRepository } = require('./cityWhatsappRepository');

function fakeModel(initial = []) {
  let rows = initial.map((row) => ({ ...row }));
  let nextId = 1;
  return {
    rows: () => rows,
    async findOne({ where }) {
      return rows.find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) || null;
    },
    async findAll({ where }) {
      const value = where.city_id;
      const ids = Array.isArray(value) ? value : value[Object.getOwnPropertySymbols(value)[0]];
      return rows.filter((row) => ids.includes(row.city_id));
    },
    async create(row) {
      const created = { id: nextId++, ...row };
      rows.push(created);
      return created;
    },
    async update(patch, { where }) {
      const row = rows.find((item) => item.id === where.id);
      Object.assign(row, patch);
      return [1];
    },
    async destroy({ where }) {
      const before = rows.length;
      rows = rows.filter((row) => row.city_id !== where.city_id);
      return before - rows.length;
    }
  };
}

test('el repositorio busca por hash, número y ciudad, y borra por ciudad', async () => {
  const repo = createCityWhatsappRepository(fakeModel());
  const created = await repo.create({ city_id: 5, invite_token_hash: 'abc', phone_number_id: null });
  expect((await repo.findByCityId(5)).id).toBe(created.id);
  expect(await repo.findByInviteHash('abc')).toMatchObject({ city_id: 5 });
  await repo.update(created.id, { phone_number_id: 'phone-5' });
  expect((await repo.findByPhoneNumberId('phone-5')).city_id).toBe(5);
  expect(await repo.findByCityIds([5, 9])).toHaveLength(1);
  await repo.destroyByCityId(5);
  expect(await repo.findByCityId(5)).toBeNull();
});
