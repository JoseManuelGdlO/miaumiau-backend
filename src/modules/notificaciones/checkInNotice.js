function cleanName(nombre) {
  return typeof nombre === 'string' ? nombre.trim() : '';
}

function isPendingCheckIn(datos) {
  const parsed = typeof datos === 'string'
    ? (() => { try { return JSON.parse(datos); } catch { return {}; } })()
    : (datos || {});
  return parsed.tipo === 'check_in' && parsed.estado_solicitud !== 'cancelada';
}

function validacionCargaPath(id) {
  return `/dashboard/call-center?tab=validacion&solicitud=${id}`;
}

function noticeFromNombre(nombre) {
  const clean = cleanName(nombre);
  if (!clean) {
    return {
      nombre: 'Validar carga del repartidor',
      descripcion: null,
      repartidor_nombre: null,
    };
  }
  return {
    nombre: `Validar carga de ${clean}`.slice(0, 255),
    descripcion: clean,
    repartidor_nombre: clean,
  };
}

function readDatos(row) {
  const datos = row?.datos;
  if (!datos) return {};
  if (typeof datos === 'string') {
    try {
      return JSON.parse(datos);
    } catch {
      return {};
    }
  }
  return datos;
}

function decorateCheckIn(row, nombreLookup) {
  if (!row) return row;
  const datos = readDatos(row);
  if (datos.tipo !== 'check_in') return row;
  const lookedUp = nombreLookup ? nombreLookup(datos.repartidor_id) : null;
  const notice = noticeFromNombre(datos.repartidor_nombre || lookedUp);
  const nextDatos = {
    ...datos,
    actionUrl: datos.actionUrl || validacionCargaPath(row.id),
  };
  if (notice.repartidor_nombre) nextDatos.repartidor_nombre = notice.repartidor_nombre;
  const currentTitle = String(row.nombre || '');
  const title = notice.repartidor_nombre && !currentTitle.includes(notice.repartidor_nombre)
    ? notice.nombre
    : row.nombre;
  return {
    ...row,
    nombre: title,
    descripcion: row.descripcion || notice.descripcion,
    datos: nextDatos,
  };
}

async function presentNotificaciones(rows, findRepartidores) {
  const plain = (rows || []).map((row) => (typeof row.toJSON === 'function' ? row.toJSON() : { ...row }));
  const ids = [...new Set(
    plain
      .filter((row) => {
        const datos = readDatos(row);
        return datos.tipo === 'check_in' && datos.repartidor_id != null && !cleanName(datos.repartidor_nombre);
      })
      .map((row) => Number(readDatos(row).repartidor_id))
      .filter((id) => Number.isFinite(id))
  )];
  const names = new Map();
  if (ids.length && findRepartidores) {
    const drivers = await findRepartidores(ids);
    for (const driver of drivers || []) {
      names.set(Number(driver.id), driver.nombre_completo);
    }
  }
  return plain.map((row) => decorateCheckIn(row, (id) => names.get(Number(id))));
}

module.exports = {
  noticeFromNombre,
  validacionCargaPath,
  decorateCheckIn,
  presentNotificaciones,
  isPendingCheckIn,
};
