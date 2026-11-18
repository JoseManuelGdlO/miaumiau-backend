const TIPOS = ['general', 'veterinaria', 'distribuidor'];

function cuentaDe(body = {}, actual = {}) {
  const raw = body.tipo_cuenta ?? actual.tipo_cuenta;
  let tipo = TIPOS.includes(raw) ? raw : null;
  if (!tipo) {
    const flag = Object.prototype.hasOwnProperty.call(body, 'es_distribuidor')
      ? Boolean(body.es_distribuidor)
      : Boolean(actual.es_distribuidor);
    tipo = flag ? 'distribuidor' : 'general';
  }
  return { tipo_cuenta: tipo, es_distribuidor: tipo !== 'general' };
}

module.exports = { TIPOS, cuentaDe };
