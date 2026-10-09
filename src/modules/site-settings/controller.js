const { Op } = require('sequelize');
const { SiteSetting } = require('../../models');
const { extractYoutubeVideoId } = require('../../utils/youtubeVideoId');
const { Logger } = require('../../utils/logger');

const log = new Logger('SiteSettings');

const KEY_HERO_YOUTUBE = 'hero_youtube_video_id';
const DEFAULT_HERO_VIDEO_ID = 'h3u-4RAwZSA';

const KEY_SOCIAL_INSTAGRAM = 'social_instagram_url';
const KEY_SOCIAL_FACEBOOK = 'social_facebook_url';
const KEY_SOCIAL_TIKTOK = 'social_tiktok_url';
const KEY_MERCADOLIBRE = 'mercadolibre_url';
const KEY_QR_ACTIONS = 'qr_actions';
const KEY_MAINTENANCE_PLACEHOLDER = 'maintenance_placeholder';

const QR_ACTION_IDS = ['whatsapp', 'catalog', 'packages', 'promotions', 'mercadolibre', 'social', 'customLink'];

function defaultQrActions() {
  return {
    whatsapp: true,
    catalog: true,
    packages: true,
    promotions: true,
    mercadolibre: true,
    social: true,
    customLink: false,
    customLinkUrl: '',
    customLinkLabel: '',
    links: [],
    linksHtml: '',
    linksPanelColor: '#fff7ed',
    linksBubbleColor: '#16a34a',
    linksBubbleTextColor: '#1c1917',
    linksTextColor: '#1c1917',
  };
}

function parseHexColor(raw, fallback) {
  if (typeof raw !== 'string') return fallback;
  const value = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [r, g, b] = value.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

const ALLOWED_FONT_FACES = new Set([
  'Fredoka',
  'Nunito',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Trebuchet MS',
  'Courier New',
]);

function safeCssColor(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [r, g, b] = trimmed.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const rgb = trimmed.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (!rgb) return '';
  const parts = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  if (parts.some((part) => part > 255)) return '';
  return `#${parts.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

function sanitizeFontTag(attrs) {
  const faceMatch = String(attrs).match(/\bface\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const face = faceMatch ? (faceMatch[2] || faceMatch[3] || faceMatch[4] || '') : '';
  const sizeMatch = String(attrs).match(/\bsize\s*=\s*"?([1-7])"?/i);
  const colorMatch = String(attrs).match(/\bcolor\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const color = safeCssColor(colorMatch ? (colorMatch[2] || colorMatch[3] || colorMatch[4] || '') : '');
  let tag = '<font';
  if (ALLOWED_FONT_FACES.has(face)) tag += ` face="${face}"`;
  if (sizeMatch) tag += ` size="${sizeMatch[1]}"`;
  if (color) tag += ` color="${color}"`;
  return `${tag}>`;
}

function sanitizeBlockTag(tagName, attrs) {
  const alignMatch = String(attrs).match(/\balign\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const alignRaw = (alignMatch ? (alignMatch[2] || alignMatch[3] || alignMatch[4] || '') : '').toLowerCase();
  const styleMatch = String(attrs).match(/\bstyle\s*=\s*("([^"]*)"|'([^']*)')/i);
  const style = styleMatch ? (styleMatch[2] || styleMatch[3] || '') : '';
  const styleAlign = style.match(/text-align\s*:\s*(left|center|right)/i);
  const align = ['left', 'center', 'right'].includes(alignRaw)
    ? alignRaw
    : (styleAlign ? styleAlign[1].toLowerCase() : '');
  if (!align) return `<${tagName}>`;
  return `<${tagName} style="text-align: ${align}">`;
}

function isAllowedQrImageSrc(src) {
  if (typeof src !== 'string') return false;
  const value = src.trim();
  const pathOnly = (() => {
    if (value.startsWith('/uploads/qr/')) return value;
    try {
      const url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      return url.pathname;
    } catch {
      return '';
    }
  })();
  return /^\/uploads\/qr\/[a-zA-Z0-9._-]+$/.test(pathOnly);
}

function sanitizeImgTag(attrs) {
  const srcMatch = String(attrs).match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const src = srcMatch ? (srcMatch[2] || srcMatch[3] || srcMatch[4] || '').trim() : '';
  if (!isAllowedQrImageSrc(src)) return '';
  const altMatch = String(attrs).match(/\balt\s*=\s*("([^"]*)"|'([^']*)')/i);
  const alt = (altMatch ? (altMatch[2] || altMatch[3] || '') : '')
    .replace(/[<>"']/g, '')
    .slice(0, 120);
  return `<img src="${src}" alt="${alt}">`;
}

function sanitizeSpanTag(attrs) {
  const styleMatch = String(attrs).match(/\bstyle\s*=\s*("([^"]*)"|'([^']*)')/i);
  const style = styleMatch ? (styleMatch[2] || styleMatch[3] || '') : '';
  const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
  const color = safeCssColor(colorMatch ? colorMatch[1] : '');
  if (!color) return '<span>';
  return `<span style="color: ${color}">`;
}

function sanitizeLinksHtml(raw) {
  if (typeof raw !== 'string') return '';
  let html = raw.slice(0, 20000);
  html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<\/?(?!p\b|br\b|strong\b|b\b|em\b|i\b|u\b|s\b|strike\b|ul\b|ol\b|li\b|a\b|h2\b|h3\b|span\b|div\b|font\b|img\b)[a-z0-9]+[^>]*>/gi, '');
  html = html.replace(/<img\b([^>]*)>/gi, (_, attrs) => sanitizeImgTag(attrs));
  html = html.replace(/<font\b([^>]*)>/gi, (_, attrs) => sanitizeFontTag(attrs));
  html = html.replace(/<span\b([^>]*)>/gi, (_, attrs) => sanitizeSpanTag(attrs));
  html = html.replace(/<(div|p|h2|h3)\b([^>]*)>/gi, (_, tagName, attrs) => sanitizeBlockTag(tagName, attrs));
  html = html.replace(/<(a|b|strong|em|i|u|s|strike|li|ul|ol)\b([^>]*)>/gi, (full) =>
    full.replace(/\sstyle\s*=\s*(['"])[\s\S]*?\1/i, '')
  );
  html = html.replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, '');
  html = html.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  html = html.replace(/href\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, 'href="#"');
  return html.trim();
}

function parseQrLinks(raw) {
  if (!Array.isArray(raw)) return [];
  const links = [];
  for (const item of raw.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue;
    const name = typeof item.name === 'string' ? item.name.trim().slice(0, 80) : '';
    const url = parseHttpUrlOrEmpty(item.url);
    if (!name || !url) continue;
    const id = typeof item.id === 'string' && item.id.trim()
      ? item.id.trim().slice(0, 40)
      : `link-${links.length + 1}`;
    links.push({ id, name, url });
  }
  return links;
}

function parseQrActions(raw) {
  const result = defaultQrActions();
  if (raw == null || raw === '') return result;

  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return result;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return result;

  for (const id of QR_ACTION_IDS) {
    if (typeof parsed[id] === 'boolean') {
      result[id] = parsed[id];
    }
  }

  const customLinkUrl = parseHttpUrlOrEmpty(parsed.customLinkUrl);
  result.customLinkUrl = customLinkUrl || '';
  result.customLinkLabel = typeof parsed.customLinkLabel === 'string'
    ? parsed.customLinkLabel.trim().slice(0, 80)
    : '';
  result.links = parseQrLinks(parsed.links);
  if (result.links.length === 0 && result.customLink && result.customLinkUrl) {
    result.links = [{
      id: 'legacy',
      name: result.customLinkLabel || 'Enlace',
      url: result.customLinkUrl,
    }];
  }
  result.linksHtml = sanitizeLinksHtml(parsed.linksHtml);
  const defaults = defaultQrActions();
  result.linksPanelColor = parseHexColor(parsed.linksPanelColor, defaults.linksPanelColor);
  result.linksBubbleColor = parseHexColor(parsed.linksBubbleColor, defaults.linksBubbleColor);
  result.linksBubbleTextColor = parseHexColor(parsed.linksBubbleTextColor, defaults.linksBubbleTextColor);
  result.linksTextColor = parseHexColor(parsed.linksTextColor, defaults.linksTextColor);
  return result;
}

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
  const allKeys = [KEY_HERO_YOUTUBE, KEY_QR_ACTIONS, KEY_MAINTENANCE_PLACEHOLDER, ...PUBLIC_LINK_KEYS];
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
  const qrActions = parseQrActions(byClave[KEY_QR_ACTIONS]);
  const maintenanceRaw = byClave[KEY_MAINTENANCE_PLACEHOLDER];
  const maintenancePlaceholder = maintenanceRaw == null || maintenanceRaw === ''
    ? true
    : !['false', '0'].includes(String(maintenanceRaw).trim().toLowerCase());

  return {
    heroYoutubeVideoId,
    socialInstagramUrl,
    socialFacebookUrl,
    socialTiktokUrl,
    mercadolibreUrl,
    qrActions,
    maintenancePlaceholder,
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
    log.error('getPublic falló', { message: error.message });
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
      log.warn('updateHeroYoutubeVideoId rechazado', { status: 400, reason: 'ID o URL de YouTube no válida' });
      return res.status(400).json({
        success: false,
        message: 'ID o URL de YouTube no válida. Usa el ID de 11 caracteres o un enlace válido.',
      });
    }

    await upsertValor(KEY_HERO_YOUTUBE, parsed);

    log.info('updateHeroYoutubeVideoId');
    const data = await buildPublicData();
    res.json({
      success: true,
      data,
      message: 'Video del hero actualizado correctamente',
    });
  } catch (error) {
    log.error('updateHeroYoutubeVideoId falló', { message: error.message });
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
      log.warn('ajuste rechazado', { status: 400, reason: 'Cuerpo JSON inválido.' });
      return res.status(400).json({ success: false, message: 'Cuerpo JSON inválido.' });
    }

    for (const [camel] of LINK_BODY_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(req.body, camel)) {
        log.warn('ajuste rechazado', { status: 400, reason: `Falta el campo ${camel}.` });
        return res.status(400).json({
          success: false,
          message: `Falta el campo ${camel}.`,
        });
      }
    }

    for (const [camel, dbKey] of LINK_BODY_KEYS) {
      const parsed = parseHttpUrlOrEmpty(req.body[camel]);
      if (parsed === null) {
        log.warn('ajuste rechazado', { status: 400, reason: `URL no válida en ${camel}. Usa http:// o https://` });
        return res.status(400).json({
          success: false,
          message: `URL no válida en ${camel}. Usa http:// o https://`,
        });
      }
      await upsertValor(dbKey, parsed);
    }

    log.info('updatePublicLinks');
    const data = await buildPublicData();
    res.json({
      success: true,
      data,
      message: 'Enlaces públicos actualizados correctamente',
    });
  } catch (error) {
    log.error('updatePublicLinks falló', { message: error.message });
    next(error);
  }
};

const updateMaintenancePlaceholder = async (req, res, next) => {
  try {
    const enabled = req.body && req.body.maintenancePlaceholder;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Indica si el aviso de «estamos trabajando» está activo.',
      });
    }
    await upsertValor(KEY_MAINTENANCE_PLACEHOLDER, enabled ? 'true' : 'false');
    const data = await buildPublicData();
    res.json({
      success: true,
      data,
      message: enabled
        ? 'La página principal muestra el aviso de estamos trabajando'
        : 'La página principal muestra el sitio normal',
    });
  } catch (error) {
    next(error);
  }
};

const updateQrActions = async (req, res, next) => {
  try {
    const incoming = req.body && req.body.qrActions;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      log.warn('ajuste rechazado', { status: 400, reason: 'Indica qrActions con las acciones que se muestran al entrar al QR.' });
      return res.status(400).json({
        success: false,
        message: 'Indica qrActions con las acciones que se muestran al entrar al QR.',
      });
    }

    for (const id of QR_ACTION_IDS) {
      if (typeof incoming[id] !== 'boolean') {
        log.warn('ajuste rechazado', { status: 400, reason: `La acción ${id} debe ser verdadero o falso.` });
        return res.status(400).json({
          success: false,
          message: `La acción ${id} debe ser verdadero o falso.`,
        });
      }
    }

    const customLinkUrl = parseHttpUrlOrEmpty(incoming.customLinkUrl);
    if (customLinkUrl === null || (incoming.customLink && customLinkUrl === '')) {
      log.warn('ajuste rechazado', { status: 400, reason: 'Escribe un enlace http:// o https:// para la opción de otro link.' });
      return res.status(400).json({
        success: false,
        message: 'Escribe un enlace http:// o https:// para la opción de otro link.',
      });
    }
    if (incoming.customLinkLabel != null && typeof incoming.customLinkLabel !== 'string') {
      log.warn('ajuste rechazado', { status: 400, reason: 'El texto del botón debe ser una cadena.' });
      return res.status(400).json({
        success: false,
        message: 'El texto del botón debe ser una cadena.',
      });
    }

    if (incoming.linksHtml != null && typeof incoming.linksHtml !== 'string') {
      log.warn('ajuste rechazado', { status: 400, reason: 'El texto de la sección de enlaces no es válido.' });
      return res.status(400).json({
        success: false,
        message: 'El texto de la sección de enlaces no es válido.',
      });
    }

    if (incoming.links != null && !Array.isArray(incoming.links)) {
      log.warn('ajuste rechazado', { status: 400, reason: 'Los enlaces del QR deben enviarse como una lista.' });
      return res.status(400).json({
        success: false,
        message: 'Los enlaces del QR deben enviarse como una lista.',
      });
    }
    const incomingLinks = Array.isArray(incoming.links) ? incoming.links : [];
    if (incomingLinks.length > 20) {
      log.warn('ajuste rechazado', { status: 400, reason: 'Puedes agregar hasta 20 enlaces.' });
      return res.status(400).json({
        success: false,
        message: 'Puedes agregar hasta 20 enlaces.',
      });
    }
    for (const item of incomingLinks) {
      const name = item && typeof item.name === 'string' ? item.name.trim() : '';
      const url = item ? parseHttpUrlOrEmpty(item.url) : null;
      if (!name) {
        log.warn('ajuste rechazado', { status: 400, reason: 'Cada enlace necesita un nombre.' });
        return res.status(400).json({
          success: false,
          message: 'Cada enlace necesita un nombre.',
        });
      }
      if (!url) {
        log.warn('ajuste rechazado', { status: 400, reason: `El enlace "${name}" debe ser una URL http:// o https://` });
        return res.status(400).json({
          success: false,
          message: `El enlace "${name}" debe ser una URL http:// o https://`,
        });
      }
    }

    const qrActions = parseQrActions(incoming);
    await upsertValor(KEY_QR_ACTIONS, JSON.stringify(qrActions));

    log.info('updateQrActions');
    const data = await buildPublicData();
    res.json({
      success: true,
      data,
      message: 'Acciones del QR actualizadas correctamente',
    });
  } catch (error) {
    log.error('updateQrActions falló', { message: error.message });
    next(error);
  }
};

const uploadQrImage = async (req, res, next) => {
  try {
    if (!req.file || !req.file.filename) {
      return res.status(400).json({
        success: false,
        message: 'No se recibió ninguna imagen. Envía el archivo en el campo "imagen".',
      });
    }
    const configured = (process.env.IMAGE_BASE_URL || process.env.BASE_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '');
    const baseUrl = configured || `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/qr/${req.file.filename}`;
    res.json({
      success: true,
      data: { url },
      message: 'Imagen subida correctamente',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublic,
  updateHeroYoutubeVideoId,
  updatePublicLinks,
  updateQrActions,
  updateMaintenancePlaceholder,
  uploadQrImage,
  KEY_HERO_YOUTUBE,
  DEFAULT_HERO_VIDEO_ID,
};
