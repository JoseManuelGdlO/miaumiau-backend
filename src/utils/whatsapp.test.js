const { EventEmitter } = require('events');

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => Buffer.from('image')),
  writeFileSync: jest.fn()
}));
jest.mock('https', () => ({ request: jest.fn() }));
jest.mock('../services/whatsappAccessToken', () => ({
  accessTokenForSend: jest.fn()
}));

process.env.WHATSAPP_API_URL = 'https://graph.facebook.com/v23.0';
process.env.WHATSAPP_API_TOKEN = 'token-global';

const https = require('https');
const { accessTokenForSend } = require('../services/whatsappAccessToken');
const { uploadWhatsAppMedia } = require('./whatsapp');

beforeEach(() => {
  jest.clearAllMocks();
});

test('upload de media usa el mismo token de ciudad que el envío', async () => {
  accessTokenForSend.mockResolvedValue('token-ciudad');
  let requestOptions;
  https.request.mockImplementation((options, callback) => {
    requestOptions = options;
    const response = new EventEmitter();
    response.statusCode = 200;
    callback(response);
    process.nextTick(() => {
      response.emit('data', JSON.stringify({ id: 'media-1' }));
      response.emit('end');
    });
    return { on: jest.fn(), write: jest.fn(), end: jest.fn() };
  });

  await expect(uploadWhatsAppMedia('phone-1', 'image.jpg', 'image/jpeg'))
    .resolves.toMatchObject({ success: true, mediaId: 'media-1' });

  expect(accessTokenForSend).toHaveBeenCalledWith('phone-1');
  expect(requestOptions.headers.Authorization).toBe('Bearer token-ciudad');
});

test('si falla resolver el token, upload no llama a Meta', async () => {
  const error = Object.assign(new Error('token inválido'), { status: 503 });
  accessTokenForSend.mockRejectedValue(error);

  await expect(uploadWhatsAppMedia('phone-1', 'image.jpg', 'image/jpeg')).resolves.toEqual({
    success: false,
    status: 503,
    error: 'token inválido'
  });
  expect(https.request).not.toHaveBeenCalled();
});
