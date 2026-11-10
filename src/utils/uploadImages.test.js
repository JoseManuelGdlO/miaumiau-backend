const { repartidoresFileFilter } = require('./uploadImages');

function runFilter(mimetype) {
  let result;
  repartidoresFileFilter({}, { mimetype }, (err, ok) => {
    result = { err, ok };
  });
  return result;
}

test('repartidoresFileFilter acepta imagen y PDF y rechaza el resto', () => {
  expect(runFilter('application/pdf')).toEqual({ err: null, ok: true });
  expect(runFilter('image/jpeg')).toEqual({ err: null, ok: true });
  const bad = runFilter('text/plain');
  expect(bad.err).toBeInstanceOf(Error);
  expect(bad.err.message).toMatch(/PDF/);
  expect(bad.ok).toBeUndefined();
});
