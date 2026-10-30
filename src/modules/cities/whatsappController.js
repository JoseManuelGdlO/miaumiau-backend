const { CityWhatsappProfile } = require('../../models');
const {
  regenerateCityInvite,
  disconnectCityWhatsapp
} = require('../../services/cityWhatsappService');
const {
  describeWhatsapp,
  inviteUrlFor,
  readInviteToken,
  inviteStatus
} = require('../../services/cityWhatsappInvite');
const { createCityWhatsappRepository } = require('../../services/cityWhatsappRepository');
const graphClient = require('../../services/metaGraphClient');
const { decryptMetaAccessToken } = require('../../utils/credentialsCrypto');

function presentCity(city, profile) {
  const plain = typeof city?.toJSON === 'function' ? city.toJSON() : { ...city };
  delete plain.invite_token_encrypted;
  delete plain.access_token_encrypted;
  delete plain.invite_token_hash;
  plain.whatsapp = describeWhatsapp(profile);
  return plain;
}

function whatsappWithInvite(req, profile, invite) {
  const whatsapp = describeWhatsapp(profile);
  return {
    ...whatsapp,
    inviteUrl: inviteUrlFor(req, invite.token),
    expiresAt: invite.expiresAt
  };
}

async function removeProfileOnDelete({ profile, graph, destroy }) {
  if (profile?.phone_number_id) {
    try {
      const token = decryptMetaAccessToken(profile.access_token_encrypted);
      await graph.unsubscribeWabaApp(profile.waba_id, token);
    } catch (error) {
      console.warn('delete city: no se pudo desuscribir el WABA', error.message);
    }
  }
  await destroy();
}

function createWhatsappHandlers({ repo, graph }) {
  function handleError(error, res, next) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message
      });
    }
    return next(error);
  }

  return {
    async show(req, res, next) {
      try {
        const profile = await repo.findByCityId(Number(req.params.id));
        if (!profile) {
          return res.status(404).json({
            success: false,
            message: 'Perfil no encontrado'
          });
        }
        const whatsapp = describeWhatsapp(profile);
        if (inviteStatus(profile) === 'pending') {
          whatsapp.inviteUrl = inviteUrlFor(req, readInviteToken(profile));
        }
        return res.json({
          success: true,
          message: 'Perfil de WhatsApp obtenido exitosamente',
          data: { whatsapp }
        });
      } catch (error) {
        return handleError(error, res, next);
      }
    },

    async regenerate(req, res, next) {
      try {
        const issued = await regenerateCityInvite({
          repo,
          cityId: Number(req.params.id)
        });
        return res.json({
          success: true,
          message: 'Link de vinculación regenerado exitosamente',
          data: {
            whatsapp: whatsappWithInvite(req, issued.profile, issued.invite)
          }
        });
      } catch (error) {
        return handleError(error, res, next);
      }
    },

    async disconnect(req, res, next) {
      try {
        const issued = await disconnectCityWhatsapp({
          repo,
          graph,
          cityId: Number(req.params.id)
        });
        return res.json({
          success: true,
          message: 'WhatsApp desconectado exitosamente',
          data: {
            whatsapp: whatsappWithInvite(req, issued.profile, issued.invite)
          }
        });
      } catch (error) {
        return handleError(error, res, next);
      }
    }
  };
}

const repo = createCityWhatsappRepository(CityWhatsappProfile);

module.exports = {
  ...createWhatsappHandlers({ repo, graph: graphClient }),
  createWhatsappHandlers,
  presentCity,
  removeProfileOnDelete
};
