const { createHub } = require('./hub');
const { crearFiltro } = require('./telemetria');

const hub = createHub();
const filtroGps = crearFiltro();

function getHub() {
  return hub;
}

function getFiltroGps() {
  return filtroGps;
}

module.exports = { getHub, createHub, getFiltroGps, crearFiltro };
