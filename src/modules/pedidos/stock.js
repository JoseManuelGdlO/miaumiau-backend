function lineaPaquete(paqueteData, cantidad, descuento = 0) {
  const unidad = parseFloat(paqueteData?.precio_final) || 0;
  const n = parseInt(cantidad, 10) || 0;
  const bruto = unidad * n;
  const off = (bruto * (parseFloat(descuento) || 0)) / 100;
  return { precio_unidad: unidad, precio_total: bruto - off };
}

async function productosDePaquetes(db, paquetesArray, erroresStock = []) {
  const productosPorPaquete = {};

  if (!Array.isArray(paquetesArray) || paquetesArray.length === 0) {
    return productosPorPaquete;
  }

  for (const paqueteItem of paquetesArray) {
    if (!paqueteItem) continue;

    const paqueteId = paqueteItem.fkid_paquete ?? paqueteItem.id;
    const cantidadPaquetes = parseInt(paqueteItem.cantidad);

    if (!paqueteId || isNaN(cantidadPaquetes) || cantidadPaquetes <= 0) {
      continue;
    }

    const paqueteData = await db.Paquete.findByPk(paqueteId);
    if (!paqueteData) {
      erroresStock.push(`Paquete con ID ${paqueteId} no existe`);
      continue;
    }

    if (paqueteData.is_active === false) {
      erroresStock.push(`El paquete con ID ${paqueteId} no está activo`);
      continue;
    }

    const productosPaquete = await db.ProductoPaquete.findAll({
      where: { fkid_paquete: paqueteId },
    });

    if (productosPaquete.length === 0) {
      erroresStock.push(`El paquete con ID ${paqueteId} no tiene productos asociados`);
      continue;
    }

    for (const productoPaquete of productosPaquete) {
      const cantidadTotal = cantidadPaquetes * productoPaquete.cantidad;
      if (!productosPorPaquete[productoPaquete.fkid_producto]) {
        productosPorPaquete[productoPaquete.fkid_producto] = 0;
      }
      productosPorPaquete[productoPaquete.fkid_producto] += cantidadTotal;
    }
  }

  return productosPorPaquete;
}

async function calcularYValidarStock(db, { productos = [], paquetes = [] } = {}) {
  const erroresStock = [];

  const productosAProcesar = Array.isArray(productos)
    ? productos
        .map((producto, index) => {
          if (!producto) return null;

          const fkid_producto = producto.fkid_producto ?? producto.id;
          const cantidad = parseInt(producto.cantidad);

          if (!fkid_producto || isNaN(cantidad) || cantidad <= 0) {
            erroresStock.push(`Producto en la posición ${index} tiene datos inválidos`);
            return null;
          }

          return { fkid_producto, cantidad };
        })
        .filter(Boolean)
    : [];

  const productosPorPaquete = await productosDePaquetes(db, paquetes, erroresStock);

  const todosLosProductosIds = new Set([
    ...productosAProcesar.map((p) => p.fkid_producto),
    ...Object.keys(productosPorPaquete).map((k) => parseInt(k, 10)),
  ]);

  const esProductoUnicoEnCarrito = (productoId) =>
    todosLosProductosIds.size === 1 && todosLosProductosIds.has(productoId);

  for (const producto of productosAProcesar) {
    const productoInventario = await db.Inventario.findByPk(producto.fkid_producto);
    if (!productoInventario) {
      erroresStock.push(`Producto con ID ${producto.fkid_producto} no encontrado en inventario`);
      continue;
    }

    const cantidadDirecta = producto.cantidad;
    const cantidadDePaquetes = productosPorPaquete[producto.fkid_producto] || 0;
    const cantidadRequerida = cantidadDirecta + cantidadDePaquetes;

    if (productoInventario.stock_inicial < cantidadRequerida) {
      erroresStock.push(
        `Stock insuficiente para ${productoInventario.nombre} (SKU: ${productoInventario.sku}). Disponible: ${productoInventario.stock_inicial}, Requerido: ${cantidadRequerida}`
      );
    }

    const compraMinima = productoInventario.compra_minima;
    if (compraMinima != null && compraMinima >= 1 && esProductoUnicoEnCarrito(producto.fkid_producto)) {
      if (cantidadRequerida < compraMinima) {
        erroresStock.push(
          `Compra mínima no cumplida para ${productoInventario.nombre} (SKU: ${productoInventario.sku}). Mínimo: ${compraMinima}, solicitado: ${cantidadRequerida}`
        );
      }
    }
  }

  const productosDirectosIds = productosAProcesar.map((p) => p.fkid_producto);

  for (const [productoId, cantidadTotal] of Object.entries(productosPorPaquete)) {
    const productoIdInt = parseInt(productoId, 10);
    if (productosDirectosIds.includes(productoIdInt)) continue;

    const producto = await db.Inventario.findByPk(productoId);
    if (!producto) {
      erroresStock.push(`Producto con ID ${productoId} no encontrado en inventario`);
      continue;
    }

    if (producto.stock_inicial < cantidadTotal) {
      erroresStock.push(
        `Stock insuficiente para ${producto.nombre} (SKU: ${producto.sku}) en paquetes. Disponible: ${producto.stock_inicial}, Requerido: ${cantidadTotal}`
      );
    }
  }

  return {
    isValid: erroresStock.length === 0,
    erroresStock,
  };
}

module.exports = { lineaPaquete, calcularYValidarStock };
