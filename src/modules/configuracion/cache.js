const FLAG_OCULTAR_EVIDENCIAS = 'ocultar_evidencias_fotograficas';

let filas = [];

function normalizar(row) {
  return {
    identificador: row.identificador,
    nombre: row.nombre,
    descripcion: row.descripcion ?? null,
    activo: Boolean(row.activo),
  };
}

async function cargarConfiguracion(deps = {}) {
  const Configuracion = deps.Configuracion || require('../../models').Configuracion;
  const rows = await Configuracion.findAll({
    attributes: ['identificador', 'nombre', 'descripcion', 'activo'],
    raw: true,
  });
  filas = rows.map(normalizar);
  return filas;
}

function configuraciones() {
  return filas;
}

function flagActiva(identificador) {
  const row = filas.find((item) => item.identificador === identificador);
  return Boolean(row?.activo);
}

function evidenciasOcultas(deps = {}) {
  if (typeof deps.evidenciasOcultas === 'boolean') return deps.evidenciasOcultas;
  const row = filas.find((item) => item.identificador === FLAG_OCULTAR_EVIDENCIAS);
  // shortcut: sin la fila (migración pendiente o fallo al arrancar) las fotos no bloquean el check-in
  if (!row) return true;
  return row.activo;
}

module.exports = {
  FLAG_OCULTAR_EVIDENCIAS,
  cargarConfiguracion,
  configuraciones,
  flagActiva,
  evidenciasOcultas,
};
