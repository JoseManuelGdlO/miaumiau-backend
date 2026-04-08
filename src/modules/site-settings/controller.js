const { Op } = require('sequelize');
const { SiteSetting } = require('../../models');
const { extractYoutubeVideoId } = require('../../utils/youtubeVideoId');

const KEY_HERO_YOUTUBE = 'hero_youtube_video_id';
const DEFAULT_HERO_VIDEO_ID = 'h3u-4RAwZSA';

const KEY_SOCIAL_INSTAGRAM = 'social_instagram_url';
const KEY_SOCIAL_FACEBOOK = 'social_facebook_url';
const KEY_SOCIAL_TIKTOK = 'social_tiktok_url';
const KEY_MERCADOLIBRE = 'mercadolibre_url';

const PUBLIC_LINK_KEYS = [
  KEY_SOCIAL_INSTAGRAM,
  KEY_SOCIAL_FACEBOOK,
  KEY_SOCIAL_TIKTOK,
  KEY_MERCADOLIBRE,
];

function parseHttpUrlOrEmpty(raw) {
  const s = raw === undefined || raw === null ? '' : String(raw).trim();
  if (s === '') return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return null;
    }
    return u.href;
  } catch {
    return null;
  }
}

async function buildPublicData() {
  const allKeys = [KEY_HERO_YOUTUBE, ...PUBLIC_LINK_KEYS];
  const rows = await SiteSetting.findAll({
    where: { clave: { [Op.in]: allKeys } },
  });
  const byClave = Object.fromEntries(rows.map((r) => [r.clave, r.valor != null ? String(r.valor) : '']));

  let heroYoutubeVideoId = byClave[KEY_HERO_YOUTUBE] ? String(byClave[KEY_HERO_YOUTUBE]).trim() : DEFAULT_HERO_VIDEO_ID;
  if (!extractYoutubeVideoId(heroYoutubeVideoId)) {
    heroYoutubeVideoId = DEFAULT_HERO_VIDEO_ID;
  }

  const socialInstagramUrl = byClave[KEY_SOCIAL_INSTAGRAM] ? String(byClave[KEY_SOCIAL_INSTAGRAM]).trim() : '';
  const socialFacebookUrl = byClave[KEY_SOCIAL_FACEBOOK] ? String(byClave[KEY_SOCIAL_FACEBOOK]).trim() : '';
  const socialTiktokUrl = byClave[KEY_SOCIAL_TIKTOK] ? String(byClave[KEY_SOCIAL_TIKTOK]).trim() : '';
  const mercadolibreUrl = byClave[KEY_MERCADOLIBRE] ? String(byClave[KEY_MERCADOLIBRE]).trim() : '';

  return {
    heroYoutubeVideoId,
    socialInstagramUrl,
    socialFacebookUrl,
    socialTiktokUrl,
    mercadolibreUrl,
  };
}

async function upsertValor(clave, valor) {
  const [setting, created] = await SiteSetting.findOrCreate({
    where: { clave },
    defaults: { valor },
  });
  if (!created) {
    setting.valor = valor;
    await setting.save();
  }
}

const getPublic = async (req, res, next) => {
  try {
    const data = await buildPublicData();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

const updateHeroYoutubeVideoId = async (req, res, next) => {
  try {
    const hasVideoId = req.body && Object.prototype.hasOwnProperty.call(req.body, 'videoId');
    const hasHero = req.body && Object.prototype.hasOwnProperty.call(req.body, 'heroYoutubeVideoId');
    const raw = hasVideoId ? req.body.videoId : hasHero ? req.body.heroYoutubeVideoId : undefined;
    const parsed = extractYoutubeVideoId(raw);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: 'ID o URL de YouTube no válida. Usa el ID de 11 caracteres o un enlace válido.',
      });
    }

    await upsertValor(KEY_HERO_YOUTUBE, parsed);

    const data = await buildPublicData();
    res.json({
      success: true,
      data,
      message: 'Video del hero actualizado correctamente',
    });
  } catch (error) {
    next(error);
  }
};

const LINK_BODY_KEYS = [
  ['socialInstagramUrl', KEY_SOCIAL_INSTAGRAM],
  ['socialFacebookUrl', KEY_SOCIAL_FACEBOOK],
  ['socialTiktokUrl', KEY_SOCIAL_TIKTOK],
  ['mercadolibreUrl', KEY_MERCADOLIBRE],
];

const updatePublicLinks = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ success: false, message: 'Cuerpo JSON inválido.' });
    }

    for (const [camel] of LINK_BODY_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(req.body, camel)) {
        return res.status(400).json({
          success: false,
          message: `Falta el campo ${camel}.`,
        });
      }
    }

    for (const [camel, dbKey] of LINK_BODY_KEYS) {
      const parsed = parseHttpUrlOrEmpty(req.body[camel]);
      if (parsed === null) {
        return res.status(400).json({
          success: false,
          message: `URL no válida en ${camel}. Usa http:// o https://`,
        });
      }
      await upsertValor(dbKey, parsed);
    }

    const data = await buildPublicData();
    res.json({
      success: true,
      data,
      message: 'Enlaces públicos actualizados correctamente',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublic,
  updateHeroYoutubeVideoId,
  updatePublicLinks,
  KEY_HERO_YOUTUBE,
  DEFAULT_HERO_VIDEO_ID,
};
