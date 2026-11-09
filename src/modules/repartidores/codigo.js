const crypto = require('crypto');

const CLAVES = {
  aguascalientes: 'AGS',
  'baja california': 'BC',
  'baja california sur': 'BCS',
  campeche: 'CAM',
  chiapas: 'CHP',
  chihuahua: 'CHH',
  'ciudad de mexico': 'CDMX',
  cdmx: 'CDMX',
  coahuila: 'COA',
  'coahuila de zaragoza': 'COA',
  colima: 'COL',
  durango: 'DGO',
  guanajuato: 'GTO',
  guerrero: 'GRO',
  hidalgo: 'HGO',
  jalisco: 'JAL',
  mexico: 'MEX',
  'estado de mexico': 'MEX',
  michoacan: 'MIC',
  'michoacan de ocampo': 'MIC',
  morelos: 'MOR',
  nayarit: 'NAY',
  'nuevo leon': 'NL',
  oaxaca: 'OAX',
  puebla: 'PUE',
  queretaro: 'QRO',
  'quintana roo': 'ROO',
  'san luis potosi': 'SLP',
  sinaloa: 'SIN',
  sonora: 'SON',
  tabasco: 'TAB',
  tamaulipas: 'TAM',
  tlaxcala: 'TLA',
  veracruz: 'VER',
  'veracruz de ignacio de la llave': 'VER',
  yucatan: 'YUC',
  zacatecas: 'ZAC',
};

function normalizarEstado(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tagDe(texto) {
  const key = normalizarEstado(texto);
  if (!key) return '';
  if (CLAVES[key]) return CLAVES[key];
  const letters = key.replace(/ /g, '').slice(0, 3).toUpperCase();
  return letters.length >= 2 ? letters : '';
}

function claveEstado(departamento) {
  return tagDe(departamento) || 'MX';
}

function partesCodigo(nombre, departamento) {
  const nom = normalizarEstado(nombre);
  const dep = normalizarEstado(departamento);
  const estadoNombre = CLAVES[nom] || '';
  const estadoDep = CLAVES[dep] || '';
  const estado = estadoNombre || estadoDep || tagDe(nombre) || tagDe(departamento) || 'MX';
  let sitio = '';
  if (estadoNombre && dep && dep !== nom && !estadoDep) sitio = tagDe(departamento);
  else if (estadoDep && nom && nom !== dep && !estadoNombre) sitio = tagDe(nombre);
  else if (!estadoNombre && !estadoDep && dep && dep !== nom) sitio = tagDe(departamento);
  if (sitio === estado) sitio = '';
  return { estado, sitio };
}

function armarCodigo(nombre, departamento) {
  const { estado, sitio } = partesCodigo(nombre, departamento);
  const sufijo = crypto.randomBytes(sitio ? 2 : 3).toString('hex');
  return (sitio ? `REP-${estado}-${sitio}-${sufijo}` : `REP-${estado}-${sufijo}`).slice(0, 20);
}

async function codigoLibre(Repartidor, propuesto, nombre, departamento) {
  const texto = String(propuesto || '').trim();
  if (texto.length >= 3 && texto.length <= 20) {
    const ocupado = await Repartidor.findOne({ where: { codigo_repartidor: texto }, attributes: ['id'] });
    if (!ocupado) return texto;
  }
  for (let i = 0; i < 8; i += 1) {
    const codigo = armarCodigo(nombre, departamento);
    const ocupado = await Repartidor.findOne({ where: { codigo_repartidor: codigo }, attributes: ['id'] });
    if (!ocupado) return codigo;
  }
  const error = new Error('No se pudo generar un código único de repartidor');
  error.status = 500;
  throw error;
}

module.exports = { armarCodigo, claveEstado, codigoLibre, partesCodigo };
