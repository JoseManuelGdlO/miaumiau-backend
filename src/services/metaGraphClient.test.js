const { exchangeEmbeddedSignupCode } = require('./metaGraphClient');

beforeEach(() => {
  process.env.META_GRAPH_VERSION = 'v23.0';
  process.env.META_APP_ID = 'app';
  process.env.META_APP_SECRET = 'secret';
  global.fetch = jest.fn();
});

afterEach(() => {
  delete global.fetch;
});

test('una respuesta no JSON de Meta se reporta como 502', async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    status: 503,
    text: async () => '<html>unavailable</html>'
  });

  await expect(exchangeEmbeddedSignupCode('code-1')).rejects.toMatchObject({
    status: 502,
    message: 'No se pudo contactar la API de Meta.'
  });
});
