function idsPromo(promo) {
  let raw = promo?.productos_ids;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { raw = []; }
  }
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

function basePromo(promo, lineas, subtotal) {
  const ids = idsPromo(promo);
  const min = Number(promo?.unidades_minimas) || 0;
  const todas = lineas || [];
  const aplicables = ids.length
    ? todas.filter((linea) => ids.includes(Number(linea.fkid_producto)))
    : todas;
  if (min > 0) {
    const unidades = aplicables.reduce((sum, linea) => sum + (Number(linea.cantidad) || 0), 0);
    if (unidades < min) return 0;
  }
  if (!ids.length) return Number(subtotal) || 0;
  return Math.round(aplicables.reduce((sum, linea) => sum + (Number(linea.precio_total) || 0), 0) * 100) / 100;
}

function montoDescuento(promo, subtotal) {
  const total = Number(subtotal) || 0;
  if (!promo || total <= 0) return 0;
  const min = Number(promo.compra_minima) || 0;
  if (min > 0 && total < min) return 0;
  const tipo = String(promo.tipo_promocion || '');
  const valor = Number(promo.valor_descuento) || 0;
  const cap = Number(promo.descuento_maximo) || 0;
  let monto = 0;
  if (tipo === 'porcentaje' || tipo === 'descuento_especial') monto = total * (valor / 100);
  else if (tipo === 'monto_fijo') monto = valor;
  else return 0;
  if (cap > 0) monto = Math.min(monto, cap);
  return Math.round(Math.min(monto, total) * 100) / 100;
}

function logicaDesdePromo(promo) {
  if (!promo) return null;
  const tipo = String(promo.tipo_promocion || '');
  const valor = Number(promo.valor_descuento) || 0;
  const condiciones = Number(promo.compra_minima) > 0
    ? { monto_minimo_carrito: Number(promo.compra_minima) }
    : undefined;
  if (tipo === 'porcentaje' || tipo === 'descuento_especial') {
    return { tipo_accion: 'descuento_global', valor, unidad_valor: 'porcentaje', condiciones };
  }
  if (tipo === 'monto_fijo') {
    return { tipo_accion: 'descuento_global', valor, unidad_valor: 'monto', condiciones };
  }
  return null;
}

function aplicaACliente(promo, esDistribuidor) {
  const audiencia = promo?.aplica_a || 'todos';
  if (audiencia === 'distribuidor') return Boolean(esDistribuidor);
  if (audiencia === 'retail') return !esDistribuidor;
  return true;
}

function promoParaCliente(promos, { es_distribuidor, fkid_ciudad } = {}) {
  const ciudadId = Number(fkid_ciudad);
  const matches = (promos || []).filter((promo) => {
    if (!aplicaACliente(promo, Boolean(es_distribuidor))) return false;
    const ciudades = promo.ciudades || [];
    if (!ciudades.length) return true;
    return ciudades.some((city) => Number(city.id) === ciudadId);
  });
  return matches.find((promo) => promo.aplica_a === 'distribuidor') || matches[0] || null;
}

module.exports = { montoDescuento, basePromo, logicaDesdePromo, aplicaACliente, promoParaCliente };
