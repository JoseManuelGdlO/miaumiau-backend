const { createHub } = require('./hub');

const hub = createHub();

function getHub() {
  return hub;
}

module.exports = { getHub, createHub };
