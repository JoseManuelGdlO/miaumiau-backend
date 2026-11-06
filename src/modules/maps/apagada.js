const KEY_MAPS_API_APAGADA = 'maps_api_apagada';

const cache = { at: 0, value: false };

function valorApagado(valor) {
  return ['true', '1', 'si', 'sí'].includes(String(valor || '').trim().toLowerCase());
}

async function mapsApagada(deps = {}) {
  if (typeof deps.mapsApagada === 'boolean') return deps.mapsApagada;
  if (Date.now() - cache.at < 3000) return cache.value;
  try {
    const SiteSetting = deps.SiteSetting || require('../../models').SiteSetting;
    const row = await SiteSetting.findOne({ where: { clave: KEY_MAPS_API_APAGADA } });
    cache.at = Date.now();
    cache.value = valorApagado(row?.valor);
    return cache.value;
  } catch {
    cache.at = Date.now();
    cache.value = false;
    return false;
  }
}

function invalidarMapsApagada() {
  cache.at = 0;
  cache.value = false;
}

module.exports = {
  KEY_MAPS_API_APAGADA,
  mapsApagada,
  invalidarMapsApagada,
  valorApagado,
};
