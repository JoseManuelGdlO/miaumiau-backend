const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Normaliza entrada del usuario: ID de 11 caracteres o URL común de YouTube.
 * @param {unknown} input
 * @returns {string|null}
 */
function extractYoutubeVideoId(input) {
  if (input === undefined || input === null) return null;
  const str = String(input).trim();
  if (!str) return null;
  if (YOUTUBE_ID_RE.test(str)) return str;
  const watch = str.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return watch[1];
  const short = str.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return short[1];
  const embed = str.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embed) return embed[1];
  return null;
}

module.exports = {
  extractYoutubeVideoId,
  YOUTUBE_ID_RE,
};
