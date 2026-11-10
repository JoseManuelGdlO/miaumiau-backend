function mapaMetricas(rows) {
  const map = {};
  for (const row of rows || []) {
    const id = Number(row.id);
    if (!id) continue;
    const calif = row.calificacion_promedio;
    map[id] = {
      total_entregas: Number(row.total_entregas) || 0,
      fecha_ultima_entrega: row.fecha_ultima_entrega || null,
      calificacion_promedio:
        calif == null || calif === '' ? null : Math.round(Number(calif) * 10) / 10,
    };
  }
  return map;
}

function aplicarMetricas(repartidores, rows) {
  const map = mapaMetricas(rows);
  return (repartidores || []).map((row) => {
    const json = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
    const m = map[json.id];
    json.total_entregas = m ? m.total_entregas : 0;
    json.fecha_ultima_entrega = m ? m.fecha_ultima_entrega : null;
    json.calificacion_promedio = m && m.calificacion_promedio != null ? m.calificacion_promedio : null;
    return json;
  });
}

async function fetchMetricas(sequelize, ids) {
  const clean = [...new Set((ids || []).map(Number).filter((id) => id > 0))];
  if (!clean.length || !sequelize?.query) return [];
  const [rows] = await sequelize.query(`
    SELECT r.fkid_repartidor AS id,
           COUNT(DISTINCT p.id) AS total_entregas,
           MAX(p.fecha_entrega_real) AS fecha_ultima_entrega,
           AVG(CASE
             WHEN p.notas REGEXP 'Calificación del servicio: [1-5]'
             THEN CAST(SUBSTRING(p.notas, LOCATE('Calificación del servicio: ', p.notas) + CHAR_LENGTH('Calificación del servicio: '), 1) AS DECIMAL(3,1))
           END) AS calificacion_promedio
    FROM rutas r
    INNER JOIN rutas_pedidos rp ON rp.fkid_ruta = r.id
    INNER JOIN pedidos p ON p.id = rp.fkid_pedido
    WHERE p.estado = 'entregado' AND p.baja_logica = 0
      AND r.fkid_repartidor IN (${clean.join(',')})
    GROUP BY r.fkid_repartidor
  `);
  return rows || [];
}

module.exports = { mapaMetricas, aplicarMetricas, fetchMetricas };
