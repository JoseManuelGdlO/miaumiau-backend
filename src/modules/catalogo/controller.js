const { City, Inventario, Paquete, ProductoPaquete, Proveedor } = require('../../models');
const { Op } = require('sequelize');

const META_CSV_HEADER = 'id,title,description,availability,condition,price,link,image_link,brand,google_product_category,fb_product_category,quantity_to_sell_on_facebook,sale_price,sale_price_effective_date,item_group_id,gender,color,size,age_group,material,pattern,shipping,shipping_weight,video[0].url,video[0].tag[0],gtin,product_tags[0],product_tags[1],style[0]';

const CURRENCY = 'MXN';
// URL base para links e image_link en el CSV (Meta). Prioridad: IMAGE_BASE_URL > BASE_URL > PUBLIC_URL
const BASE_URL = (process.env.IMAGE_BASE_URL || process.env.BASE_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '');

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function priceFormat(num) {
  if (num === null || num === undefined) return '';
  const n = parseFloat(num);
  if (isNaN(n)) return '';
  return `${n.toFixed(2)} ${CURRENCY}`;
}

function buildProductRow(p, baseUrl) {
  const base = baseUrl || BASE_URL || '';
  const link = base ? `${base}/` : '';
  const imageLink = (p.imagen_url && (p.imagen_url.startsWith('http') ? p.imagen_url : `${base}${p.imagen_url.startsWith('/') ? '' : '/'}${p.imagen_url}`)) || '';
  const brand = (p.proveedor && p.proveedor.nombre) ? String(p.proveedor.nombre).slice(0, 100) : 'Miaumiau';
  const availability = (p.stock_inicial > 0) ? 'in stock' : 'out of stock';
  return [
    csvEscape(p.sku),
    csvEscape((p.nombre || '').slice(0, 200)),
    csvEscape((p.descripcion || '').slice(0, 9999)),
    availability,
    'new',
    priceFormat(p.precio_venta),
    link,
    imageLink,
    csvEscape(brand),
    '', // google_product_category
    '', // fb_product_category
    p.stock_inicial > 0 ? String(Math.max(1, p.stock_inicial)) : '',
    '', // sale_price
    '', // sale_price_effective_date
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
  ].join(',');
}

function buildPaqueteRow(paq, baseUrl) {
  const base = baseUrl || BASE_URL || '';
  const link = base ? `${base}/` : '';
  const imageLink = (paq.imagen_url && (paq.imagen_url.startsWith('http') ? paq.imagen_url : `${base}${paq.imagen_url.startsWith('/') ? '' : '/'}${paq.imagen_url}`)) || '';
  const availability = 'in stock';
  const salePrice = (paq.descuento && parseFloat(paq.descuento) > 0) ? priceFormat(paq.precio_final) : '';
  return [
    csvEscape(`PAQ-${paq.id}`),
    csvEscape((paq.nombre || '').slice(0, 200)),
    csvEscape((paq.descripcion || '').slice(0, 9999)),
    availability,
    'new',
    priceFormat(paq.precio_final),
    link,
    imageLink,
    'Miaumiau',
    '',
    '',
    '',
    salePrice,
    '',
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
  ].join(',');
}

async function getCatalogByCitySlug(req, res, next) {
  try {
    const { ciudadSlug } = req.params;
    if (!ciudadSlug) {
      return res.status(400).send('Missing city slug');
    }

    const city = await City.findOne({
      where: { slug: ciudadSlug, baja_logica: false }
    });
    if (!city) {
      return res.status(404).send('City not found');
    }

    // URL base: env (IMAGE_BASE_URL/BASE_URL/PUBLIC_URL) o derivada del request (protocolo + host)
    const protocol = req.protocol || 'https';
    const host = req.get('host') || '';
    const baseUrl = (BASE_URL || (host ? `${protocol}://${host}` : '')).replace(/\/$/, '');

    const productos = await Inventario.findAll({
      where: { fkid_ciudad: city.id, baja_logica: false },
      include: [
        { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'], required: false }
      ]
    });

    const pps = await ProductoPaquete.findAll({
      attributes: ['fkid_paquete'],
      include: [{
        model: Inventario,
        as: 'producto',
        attributes: ['id'],
        where: { fkid_ciudad: city.id },
        required: true
      }],
      raw: true
    });
    const paqueteIdsWithCityProduct = [...new Set(pps.map(p => p.fkid_paquete))];

    const paquetes = paqueteIdsWithCityProduct.length > 0
      ? await Paquete.findAll({
          where: { id: { [Op.in]: paqueteIdsWithCityProduct }, is_active: true }
        })
      : [];

    const rows = [META_CSV_HEADER];
    for (const p of productos) {
      rows.push(buildProductRow(p, baseUrl));
    }
    for (const paq of paquetes) {
      rows.push(buildPaqueteRow(paq, baseUrl));
    }

    const csv = rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="catalogo.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCatalogByCitySlug
};
