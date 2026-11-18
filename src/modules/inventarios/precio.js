function precioLista(inv, { es_distribuidor, cantidad } = {}) {
  const venta = Number(inv?.precio_venta) || 0;
  const dist = Number(inv?.precio_distribuidor) || venta;
  if (es_distribuidor) return dist;
  const umbral = Number(inv?.umbral_mayoreo) || 0;
  if (umbral > 0 && Number(cantidad) >= umbral) return dist;
  return venta;
}

module.exports = { precioLista };
