const { noticeFromNombre, decorateCheckIn, presentNotificaciones, validacionCargaPath, isPendingCheckIn } = require('./checkInNotice');

test('un check-in abierto no se puede cerrar marcándolo como leído', () => {
  expect(isPendingCheckIn({ tipo: 'check_in', estado_solicitud: 'abierta' })).toBe(true);
  expect(isPendingCheckIn({ tipo: 'check_in', estado_solicitud: 'cancelada' })).toBe(false);
  expect(isPendingCheckIn({ tipo: 'soporte', estado_solicitud: 'abierta' })).toBe(false);
});

test('noticeFromNombre pone el nombre del repartidor en el título y la descripción', () => {
  expect(noticeFromNombre('  Ana Ruiz  ')).toEqual({
    nombre: 'Validar carga de Ana Ruiz',
    descripcion: 'Ana Ruiz',
    repartidor_nombre: 'Ana Ruiz',
  });
});

test('decorateCheckIn completa nombre y destino de un check-in ya guardado', () => {
  const row = decorateCheckIn({
    id: 9,
    nombre: 'Validar carga del repartidor',
    descripcion: null,
    datos: { tipo: 'check_in', estado_solicitud: 'abierta', repartidor_id: 1, jornada_id: 3 },
  }, () => 'Ana Ruiz');

  expect(row.nombre).toBe('Validar carga de Ana Ruiz');
  expect(row.descripcion).toBe('Ana Ruiz');
  expect(row.datos.repartidor_nombre).toBe('Ana Ruiz');
  expect(row.datos.actionUrl).toBe(validacionCargaPath(9));
});

test('presentNotificaciones busca el nombre solo de los check-in que no lo traen', async () => {
  const seen = [];
  const rows = await presentNotificaciones([
    {
      id: 9,
      nombre: 'Validar carga del repartidor',
      descripcion: null,
      datos: { tipo: 'check_in', repartidor_id: 4, jornada_id: 3 },
    },
    {
      id: 2,
      nombre: 'Otra alerta',
      descripcion: 'Sigue igual',
      datos: { tipo: 'stock' },
    },
  ], async (ids) => {
    seen.push(...ids);
    return [{ id: 4, nombre_completo: 'Luis Pérez' }];
  });

  expect(seen).toEqual([4]);
  expect(rows[0].nombre).toBe('Validar carga de Luis Pérez');
  expect(rows[0].descripcion).toBe('Luis Pérez');
  expect(rows[0].datos.actionUrl).toBe('/dashboard/call-center?tab=validacion&solicitud=9');
  expect(rows[1]).toMatchObject({ nombre: 'Otra alerta', descripcion: 'Sigue igual' });
});
