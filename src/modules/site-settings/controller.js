const { SiteSetting } = require('../../models');
const { extractYoutubeVideoId } = require('../../utils/youtubeVideoId');

const KEY_HERO_YOUTUBE = 'hero_youtube_video_id';
const DEFAULT_HERO_VIDEO_ID = 'h3u-4RAwZSA';

const getPublic = async (req, res, next) => {
  try {
    const row = await SiteSetting.findOne({ where: { clave: KEY_HERO_YOUTUBE } });
    let heroYoutubeVideoId = row && row.valor ? String(row.valor).trim() : DEFAULT_HERO_VIDEO_ID;
    if (!extractYoutubeVideoId(heroYoutubeVideoId)) {
      heroYoutubeVideoId = DEFAULT_HERO_VIDEO_ID;
    }
    res.json({
      success: true,
      data: { heroYoutubeVideoId },
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

    const [setting, created] = await SiteSetting.findOrCreate({
      where: { clave: KEY_HERO_YOUTUBE },
      defaults: { valor: parsed },
    });

    if (!created) {
      setting.valor = parsed;
      await setting.save();
    }

    res.json({
      success: true,
      data: { heroYoutubeVideoId: parsed },
      message: 'Video del hero actualizado correctamente',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublic,
  updateHeroYoutubeVideoId,
  KEY_HERO_YOUTUBE,
  DEFAULT_HERO_VIDEO_ID,
};
