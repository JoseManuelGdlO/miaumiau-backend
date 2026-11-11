const { groupRepartidorFiles, repartidoresFileFilter } = require('./uploadImages');

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
  expect(runFilter('image/jpg')).toEqual({ err: null, ok: true });
  expect(runFilter('image/pjpeg')).toEqual({ err: null, ok: true });
  const bad = runFilter('text/plain');
  expect(bad.err).toBeInstanceOf(Error);
  expect(bad.err.message).toMatch(/PDF/);
  expect(bad.ok).toBeUndefined();
});

test('groupRepartidorFiles acepta la póliza e ignora campos extra', () => {
  expect(groupRepartidorFiles([
    { fieldname: 'poliza_seguro_archivo', filename: 'poliza.jpeg' },
    { fieldname: 'foto', filename: 'x.jpg' },
    { fieldname: 'poliza_seguro_archivo', filename: 'otra.jpg' },
  ])).toEqual({
    poliza_seguro_archivo: [{ fieldname: 'poliza_seguro_archivo', filename: 'poliza.jpeg' }],
  });
});
