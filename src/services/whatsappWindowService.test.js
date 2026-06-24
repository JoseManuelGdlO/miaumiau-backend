jest.mock('../models', () => ({
  Conversacion: {},
  ConversacionChat: { findOne: jest.fn() },
  ConversacionLog: {},
  Cliente: {},
}));

jest.mock('../utils/whatsapp', () => ({
  sendWhatsAppMessage: jest.fn(),
  sendWhatsAppTemplate: jest.fn(),
  WHATSAPP_REOPEN_TEMPLATE_NAME: 'abrir_conv',
}));

jest.mock('../utils/conversationTimezone', () => ({
  getTimezoneForConversationId: jest.fn(),
}));

const { ConversacionChat } = require('../models');
const {
  findLastInboundClientMessageAt,
  isWhatsAppWindowOpen,
  TWENTY_FOUR_HOURS_MS,
} = require('./whatsappWindowService');

/** Simula instancia Sequelize con attributes: ['created_at'] (sin getter en la propiedad). */
function sequelizeInstanceWithCreatedAt(createdAt) {
  return {
    dataValues: { created_at: createdAt },
    getDataValue(key) {
      return this.dataValues[key];
    },
    created_at: undefined,
    createdAt: undefined,
  };
}

describe('whatsappWindowService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findLastInboundClientMessageAt', () => {
    it('lee created_at con getDataValue cuando la propiedad directa no existe', async () => {
      const recentDate = new Date('2026-06-24T18:46:01.000Z');
      const instance = sequelizeInstanceWithCreatedAt(recentDate);
      ConversacionChat.findOne.mockResolvedValue(instance);

      const result = await findLastInboundClientMessageAt(3);

      expect(result).toEqual(recentDate);
      expect(ConversacionChat.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            fkid_conversacion: 3,
            from: 'usuario',
            baja_logica: false,
          },
          attributes: ['created_at'],
        })
      );
    });

    it('retorna null si no hay mensajes del usuario', async () => {
      ConversacionChat.findOne.mockResolvedValue(null);

      expect(await findLastInboundClientMessageAt(99)).toBeNull();
    });
  });

  describe('isWhatsAppWindowOpen', () => {
    it('retorna true si el último mensaje del usuario fue hace menos de 24 h', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      ConversacionChat.findOne.mockResolvedValue(sequelizeInstanceWithCreatedAt(oneHourAgo));

      expect(await isWhatsAppWindowOpen(3)).toBe(true);
    });

    it('retorna false si el último mensaje del usuario fue hace más de 24 h', async () => {
      const over24hAgo = new Date(Date.now() - TWENTY_FOUR_HOURS_MS - 1000);
      ConversacionChat.findOne.mockResolvedValue(sequelizeInstanceWithCreatedAt(over24hAgo));

      expect(await isWhatsAppWindowOpen(3)).toBe(false);
    });

    it('retorna false si no hay mensajes del usuario', async () => {
      ConversacionChat.findOne.mockResolvedValue(null);

      expect(await isWhatsAppWindowOpen(3)).toBe(false);
    });

    it('no marca la ventana cerrada cuando created_at solo está en dataValues (regresión)', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      ConversacionChat.findOne.mockResolvedValue(sequelizeInstanceWithCreatedAt(fiveMinutesAgo));

      expect(await isWhatsAppWindowOpen(3)).toBe(true);
    });
  });
});
