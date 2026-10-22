const { Op } = require('sequelize');
const { Logger } = require('../../utils/logger');

const log = new Logger('Historial');

function modelsOf(deps = {}) {
  return deps.models || require('../../models');
}

const VERBO = { POST: 'Creación', PUT: 'Edición', PATCH: 'Edición', DELETE: 'Eliminación' };

const RECURSOS = {
  pedidos: 'pedido',
  clientes: 'cliente',
  rutas: 'ruta',
  users: 'usuario',
  roles: 'rol',
  permissions: 'permiso',
  cities: 'ciudad',
  promotions: 'promoción',
  productos: 'producto',
  categorias: 'categoría',
  inventarios: 'inventario',
  repartidores: 'repartidor',
  paquetes: 'paquete',
  notificaciones: 'notificación',
  'call-center': 'pedido',
  jornadas: 'jornada',
};

const PASOS = {
  estado: (id, recurso) => ['Edición', `Cambio de estado del ${recurso}${id ? ` ${id}` : ''}`],
  reasignar: (id, recurso) => ['Reasignación', `Reasignación del repartidor en el ${recurso}${id ? ` ${id}` : ''}`],
  franja: (id, recurso) => ['Edición', `Cambio de horario del ${recurso}${id ? ` ${id}` : ''}`],
  orden: (id, recurso) => ['Edición', `Cambio del orden de entrega del ${recurso}${id ? ` ${id}` : ''}`],
  'liberar-siguiente': (id) => ['Liberación', `Liberación de la siguiente parada${id ? ` del pedido ${id}` : ''}`],
  'cerrar-sin-codigo': (id) => ['Cierre sin código', `Cierre del pedido${id ? ` ${id}` : ''} sin código del cliente`],
  aprobar: (id) => ['Aprobación', `Aprobación de la carga${id ? ` ${id}` : ''}`],
  'liberar-cierre': () => ['Liberación', 'Liberación del cierre del día'],
  extras: (id) => ['Edición', `Producto extra en la carga${id ? ` ${id}` : ''}`],
  pedidos: (id, recurso) => ['Edición', `Pedidos agregados a la ${recurso}${id ? ` ${id}` : ''}`],
};

const ACCION_VISIBLE = {
  post: 'Creación',
  put: 'Edición',
  patch: 'Edición',
  delete: 'Eliminación',
  cerrar_sin_codigo: 'Cierre sin código',
};

const ACCION_FILTRO = {
  creacion: ['post', 'Creación'],
  edicion: ['put', 'patch', 'Edición'],
  eliminacion: ['delete', 'Eliminación'],
  cierre_sin_codigo: ['cerrar_sin_codigo', 'Cierre sin código'],
};

function describirCambio(method, ruta) {
  const verbo = VERBO[String(method || '').toUpperCase()] || 'Cambio';
  const partes = String(ruta || '').split('?')[0].split('/').filter(Boolean);
  const recurso = RECURSOS[partes[1]] || String(partes[1] || 'registro').replace(/-/g, ' ');
  const id = partes.find((parte) => /^\d+$/.test(parte)) || '';
  const paso = [...partes].reverse().find((parte) => PASOS[parte] && partes.indexOf(parte) > 1);
  if (paso) {
    const [accion, detalle] = PASOS[paso](id, recurso);
    return { accion, entidad: recurso, detalle };
  }
  let detalle;
  if (verbo === 'Creación') detalle = `Creación de ${recurso}${id ? ` ${id}` : ''}`;
  else if (verbo === 'Eliminación') detalle = `Eliminación de ${recurso}${id ? ` ${id}` : ''}`;
  else detalle = `Edición de ${recurso}${id ? ` ${id}` : ''}`;
  return { accion: verbo, entidad: recurso, detalle };
}

function detalleVisible(detalle) {
  const texto = String(detalle || '');
  const match = texto.match(/^(POST|PUT|PATCH|DELETE)\s+(\S+)/i);
  if (!match) return texto;
  return describirCambio(match[1], match[2]).detalle;
}

async function registrarCambio(deps = {}) {
  const detalle = String(deps.detalle || '').trim();
  if (!detalle) return null;
  const db = modelsOf(deps);
  if (typeof db.HistorialCambio?.create !== 'function') return null;
  try {
    return await db.HistorialCambio.create({
      fkid_usuario: deps.usuarioId || null,
      accion: String(deps.accion || 'cambio').slice(0, 80),
      entidad: String(deps.entidad || 'sistema').slice(0, 80),
      entidad_id: deps.entidadId == null ? null : String(deps.entidadId).slice(0, 40),
      detalle: detalle.slice(0, 2000),
    });
  } catch (error) {
    log.warn('No se pudo guardar el historial', { message: error.message });
    return null;
  }
}

async function listar(deps = {}) {
  const db = modelsOf(deps);
  const where = {};
  const search = String(deps.search || '').trim();
  if (search) {
    where[Op.or] = [
      { detalle: { [Op.like]: `%${search}%` } },
      { accion: { [Op.like]: `%${search}%` } },
      { entidad: { [Op.like]: `%${search}%` } },
    ];
  }
  if (deps.accion && deps.accion !== 'all') {
    const grupo = ACCION_FILTRO[deps.accion];
    where.accion = grupo ? { [Op.in]: grupo } : deps.accion;
  }
  const rows = await db.HistorialCambio.findAll({
    where,
    include: db.User ? [{
      model: db.User,
      as: 'usuario',
      attributes: ['id', 'nombre_completo', 'correo_electronico'],
      required: false,
      include: db.Role ? [{
        model: db.Role,
        as: 'rol',
        attributes: ['nombre'],
        required: false,
      }] : [],
    }] : [],
    order: [['created_at', 'DESC']],
    limit: Math.min(Number(deps.limit) || 50, 100),
  });
  return rows.map((row) => ({
    id: row.id,
    accion: ACCION_VISIBLE[row.accion] || row.accion,
    entidad: row.entidad,
    entidad_id: row.entidad_id,
    detalle: detalleVisible(row.detalle),
    creado_en: row.created_at || row.createdAt,
    usuario: row.usuario ? {
      id: row.usuario.id,
      nombre: row.usuario.nombre_completo,
      correo: row.usuario.correo_electronico,
      rol: row.usuario.rol?.nombre || null,
    } : null,
  }));
}

module.exports = { registrarCambio, listar, describirCambio };
