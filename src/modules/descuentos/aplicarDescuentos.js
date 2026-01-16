/**
 * Módulo para aplicar lógica de descuentos y promociones a productos
 */

/**
 * Verifica si un producto coincide con alguna de las keywords
 * @param {Object} producto - Producto a verificar
 * @param {Array<string>} keywords - Array de keywords a buscar
 * @returns {boolean} - true si el producto coincide con alguna keyword
 */
function productoCoincideConKeywords(producto, keywords) {
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return false;
  }
  const nombreLower = producto.nombre.toLowerCase();
  return keywords.some(keyword => 
    nombreLower.includes(keyword.toLowerCase())
  );
}

/**
 * Calcula el total del carrito
 * @param {Array<Object>} productos - Array de productos
 * @returns {number} - Total del carrito
 */
function calcularTotalCarrito(productos) {
  return productos.reduce((total, p) => 
    total + (Number(p.precio) || 0) * (Number(p.cantidad) || 0), 0
  );
}

/**
 * Aplica descuento global al carrito
 * @param {Array<Object>} productos - Array de productos
 * @param {Object} logica - Lógica de aplicación del descuento
 * @returns {Object} - Resultado de la aplicación
 */
function aplicarDescuentoGlobal(productos, logica) {
  const { valor, unidad_valor, condiciones } = logica;
  const totalCarrito = calcularTotalCarrito(productos);
  
  // Validar monto mínimo
  if (condiciones.monto_minimo_carrito && totalCarrito < condiciones.monto_minimo_carrito) {
    return {
      aplicado: false,
      mensaje: `El monto mínimo del carrito debe ser $${condiciones.monto_minimo_carrito}. Tu carrito actual es $${totalCarrito}`,
      productos: productos
    };
  }

  let descuentoTotal = 0;
  if (unidad_valor === 'porcentaje') {
    descuentoTotal = Math.round(totalCarrito * (valor / 100) * 100) / 100;
  } else if (unidad_valor === 'monto') {
    descuentoTotal = Math.min(valor, totalCarrito);
  }

  // Distribuir descuento proporcionalmente con algoritmo que asegura suma exacta
  // Primero calcular descuentos sin redondear
  const descuentosCalculados = productos.map(producto => {
    const precioOriginal = Number(producto.precio) || 0;
    const cantidad = Number(producto.cantidad) || 0;
    const subtotalProducto = precioOriginal * cantidad;
    const proporcion = totalCarrito > 0 ? subtotalProducto / totalCarrito : 0;
    const descuentoProducto = descuentoTotal * proporcion;
    
    return {
      producto,
      precioOriginal,
      cantidad,
      subtotalProducto,
      descuentoProducto,
      descuentoProductoRedondeado: 0 // Se calculará después
    };
  });

  // Calcular descuentos redondeados y ajustar el último para que la suma sea exacta
  const descuentosRedondeados = descuentosCalculados.map(item => ({
    ...item,
    descuentoProductoRedondeado: Math.round(item.descuentoProducto * 100) / 100
  }));

  // Calcular diferencia entre suma de redondeados y descuento total
  const sumaRedondeados = descuentosRedondeados.reduce((sum, item) => 
    sum + item.descuentoProductoRedondeado, 0
  );
  const diferencia = Math.round((descuentoTotal - sumaRedondeados) * 100) / 100;

  // Ajustar el último producto con mayor descuento para que la suma sea exacta
  if (Math.abs(diferencia) > 0.01) {
    // Encontrar el producto con mayor descuento (en valor absoluto)
    const indiceAjustar = descuentosRedondeados.reduce((maxIdx, item, idx) => {
      return Math.abs(item.descuentoProducto) > Math.abs(descuentosRedondeados[maxIdx].descuentoProducto) 
        ? idx 
        : maxIdx;
    }, 0);
    
    descuentosRedondeados[indiceAjustar].descuentoProductoRedondeado = 
      Math.round((descuentosRedondeados[indiceAjustar].descuentoProductoRedondeado + diferencia) * 100) / 100;
  }

  // Aplicar descuentos a productos
  const productosModificados = descuentosRedondeados.map(item => {
    const descuentoProducto = item.descuentoProductoRedondeado;
    const nuevoPrecio = item.cantidad > 0 
      ? Math.max(0, item.precioOriginal - (descuentoProducto / item.cantidad)) 
      : item.precioOriginal;
    
    return {
      ...item.producto,
      precio_original: item.precioOriginal,
      precio: Math.round(nuevoPrecio * 100) / 100,
      descuento_aplicado: Math.round(descuentoProducto * 100) / 100
    };
  });

  // Verificar que el total sea exacto
  const totalDespues = calcularTotalCarrito(productosModificados);
  const descuentoReal = totalCarrito - totalDespues;

  return {
    aplicado: true,
    productos: productosModificados,
    descuento_total: Math.round(descuentoReal * 100) / 100
  };
}

/**
 * Aplica descuento a productos específicos
 * @param {Array<Object>} productos - Array de productos
 * @param {Object} logica - Lógica de aplicación del descuento
 * @returns {Object} - Resultado de la aplicación
 */
function aplicarDescuentoProducto(productos, logica) {
  const { valor, unidad_valor, condiciones, efecto } = logica;
  const totalCarrito = calcularTotalCarrito(productos);
  
  // Validar monto mínimo
  if (condiciones.monto_minimo_carrito && totalCarrito < condiciones.monto_minimo_carrito) {
    return {
      aplicado: false,
      mensaje: `El monto mínimo del carrito debe ser $${condiciones.monto_minimo_carrito}. Tu carrito actual es $${totalCarrito}`,
      productos: productos
    };
  }

  const keywords = efecto.producto_target_keywords || [];
  if (keywords.length === 0) {
    return {
      aplicado: false,
      mensaje: 'No se especificaron productos objetivo para el descuento',
      productos: productos
    };
  }

  // Validar cantidad trigger si existe
  if (condiciones.cantidad_trigger) {
    const productosTrigger = productos.filter(p => 
      productoCoincideConKeywords(p, condiciones.producto_trigger_keywords || [])
    );
    const cantidadTotal = productosTrigger.reduce((sum, p) => sum + (Number(p.cantidad) || 0), 0);
    
    if (cantidadTotal < condiciones.cantidad_trigger) {
      return {
        aplicado: false,
        mensaje: `Se requiere un mínimo de ${condiciones.cantidad_trigger} unidades del producto trigger`,
        productos: productos
      };
    }
  }

  let descuentoTotal = 0;
  const productosModificados = productos.map(producto => {
    if (productoCoincideConKeywords(producto, keywords)) {
      const precioOriginal = Number(producto.precio) || 0;
      let nuevoPrecio = precioOriginal;
      let descuentoProducto = 0;

      if (unidad_valor === 'porcentaje') {
        nuevoPrecio = precioOriginal * (1 - valor / 100);
        descuentoProducto = precioOriginal * (valor / 100) * (Number(producto.cantidad) || 0);
      } else if (unidad_valor === 'monto') {
        nuevoPrecio = Math.max(0, precioOriginal - valor);
        descuentoProducto = Math.min(valor, precioOriginal) * (Number(producto.cantidad) || 0);
      }

      nuevoPrecio = Math.round(nuevoPrecio * 100) / 100;
      descuentoProducto = Math.round(descuentoProducto * 100) / 100;
      descuentoTotal += descuentoProducto;

      return {
        ...producto,
        precio_original: precioOriginal,
        precio: nuevoPrecio,
        descuento_aplicado: descuentoProducto
      };
    }
    return {
      ...producto,
      precio_original: Number(producto.precio) || 0
    };
  });

  return {
    aplicado: true,
    productos: productosModificados,
    descuento_total: Math.round(descuentoTotal * 100) / 100
  };
}

/**
 * Aplica descuento a la segunda unidad
 * @param {Array<Object>} productos - Array de productos
 * @param {Object} logica - Lógica de aplicación del descuento
 * @returns {Object} - Resultado de la aplicación
 */
function aplicarSegundaUnidad(productos, logica) {
  const { valor, unidad_valor, condiciones } = logica;
  const keywords = condiciones.producto_trigger_keywords || [];
  
  if (keywords.length === 0) {
    return {
      aplicado: false,
      mensaje: 'No se especificaron productos trigger',
      productos: productos
    };
  }

  // Validar cantidad trigger
  if (condiciones.cantidad_trigger) {
    const productosTrigger = productos.filter(p => 
      productoCoincideConKeywords(p, keywords)
    );
    const cantidadTotal = productosTrigger.reduce((sum, p) => sum + (Number(p.cantidad) || 0), 0);
    
    if (cantidadTotal < condiciones.cantidad_trigger) {
      return {
        aplicado: false,
        mensaje: `Se requiere un mínimo de ${condiciones.cantidad_trigger} unidades`,
        productos: productos
      };
    }
  }

  let descuentoTotal = 0;
  const productosModificados = productos.map(producto => {
    if (productoCoincideConKeywords(producto, keywords)) {
      const cantidad = Number(producto.cantidad) || 0;
      const precioOriginal = Number(producto.precio) || 0;
      
      if (cantidad >= 2) {
        // Aplicar descuento a la segunda unidad
        let descuentoUnidad = 0;
        if (unidad_valor === 'porcentaje') {
          descuentoUnidad = precioOriginal * (valor / 100);
        } else if (unidad_valor === 'monto') {
          descuentoUnidad = Math.min(valor, precioOriginal);
        }
        
        descuentoUnidad = Math.round(descuentoUnidad * 100) / 100;
        descuentoTotal += descuentoUnidad;

        // Calcular nuevo precio promedio
        const totalOriginal = precioOriginal * cantidad;
        const totalConDescuento = totalOriginal - descuentoUnidad;
        const nuevoPrecio = cantidad > 0 ? totalConDescuento / cantidad : precioOriginal;

        return {
          ...producto,
          precio_original: precioOriginal,
          precio: Math.round(nuevoPrecio * 100) / 100,
          descuento_segunda_unidad: Math.round(descuentoUnidad * 100) / 100
        };
      }
    }
    return {
      ...producto,
      precio_original: Number(producto.precio) || 0
    };
  });

  return {
    aplicado: true,
    productos: productosModificados,
    descuento_total: Math.round(descuentoTotal * 100) / 100
  };
}

/**
 * Agrega un producto regalo
 * @param {Array<Object>} productos - Array de productos
 * @param {Object} logica - Lógica de aplicación del descuento
 * @returns {Object} - Resultado de la aplicación
 */
function aplicarProductoRegalo(productos, logica) {
  const { condiciones, efecto } = logica;
  const keywordsTrigger = condiciones.producto_trigger_keywords || [];
  const keywordsTarget = efecto.producto_target_keywords || [];
  
  if (keywordsTrigger.length === 0) {
    return {
      aplicado: false,
      mensaje: 'No se especificaron productos trigger',
      productos: productos
    };
  }

  if (keywordsTarget.length === 0) {
    return {
      aplicado: false,
      mensaje: 'No se especificó el producto regalo',
      productos: productos
    };
  }

  // Validar cantidad trigger
  if (condiciones.cantidad_trigger) {
    const productosTrigger = productos.filter(p => 
      productoCoincideConKeywords(p, keywordsTrigger)
    );
    const cantidadTotal = productosTrigger.reduce((sum, p) => sum + (Number(p.cantidad) || 0), 0);
    
    if (cantidadTotal < condiciones.cantidad_trigger) {
      return {
        aplicado: false,
        mensaje: `Se requiere un mínimo de ${condiciones.cantidad_trigger} unidades del producto trigger`,
        productos: productos
      };
    }
  }

  // Verificar si el producto regalo ya existe en el carrito
  const productoRegaloExistente = productos.find(p => 
    productoCoincideConKeywords(p, keywordsTarget)
  );

  if (productoRegaloExistente) {
    // Si ya existe, marcar como regalo (precio 0)
    // IMPORTANTE: Preservar TODAS las propiedades originales, especialmente el ID
    const productosModificados = productos.map(producto => {
      if (productoCoincideConKeywords(producto, keywordsTarget)) {
        // Este es el producto regalo - marcar como regalo pero preservar ID original
        return {
          ...producto,
          precio_original: Number(producto.precio) || 0,
          precio: 0,
          es_regalo: true
          // El ID se preserva automáticamente con el spread operator
        };
      }
      // Para productos que NO son el regalo, NO modificar nada excepto precio_original
      return {
        ...producto,
        precio_original: Number(producto.precio) || 0
        // Todas las demás propiedades (incluyendo ID) se preservan con el spread
      };
    });

    return {
      aplicado: true,
      productos: productosModificados,
      producto_agregado: false
    };
  } else {
    // Agregar nuevo producto regalo
    // Necesitamos obtener información del producto desde inventarios
    // Por ahora, creamos un placeholder con el nombre del keyword
    const nombreProducto = keywordsTarget[0];
    const nuevoProducto = {
      id: null, // Se asignará cuando se consulte inventarios
      nombre: nombreProducto,
      precio: 0,
      precio_original: 0,
      cantidad: 1,
      es_regalo: true
    };

    // IMPORTANTE: Preservar TODAS las propiedades de los productos originales, especialmente el ID
    const productosConPrecioOriginal = productos.map(p => ({
      ...p,
      precio_original: Number(p.precio) || 0
      // Todas las demás propiedades (incluyendo ID) se preservan con el spread
    }));

    return {
      aplicado: true,
      productos: [...productosConPrecioOriginal, nuevoProducto],
      producto_agregado: true
    };
  }
}

/**
 * Aplica la lógica de descuento según el tipo de acción
 * @param {Array<Object>} productos - Array de productos
 * @param {Object} logica_aplicar - Lógica de aplicación completa
 * @returns {Object} - Resultado de la aplicación
 */
function aplicarLogicaDescuento(productos, logica_aplicar) {
  const { tipo_accion } = logica_aplicar;

  switch (tipo_accion) {
    case 'descuento_global':
      return aplicarDescuentoGlobal(productos, logica_aplicar);
    case 'descuento_producto':
      return aplicarDescuentoProducto(productos, logica_aplicar);
    case 'segunda_unidad':
      return aplicarSegundaUnidad(productos, logica_aplicar);
    case 'producto_regalo':
      return aplicarProductoRegalo(productos, logica_aplicar);
    default:
      return {
        aplicado: false,
        mensaje: `Tipo de acción no soportado: ${tipo_accion}`,
        productos: productos
      };
  }
}

module.exports = {
  productoCoincideConKeywords,
  calcularTotalCarrito,
  aplicarDescuentoGlobal,
  aplicarDescuentoProducto,
  aplicarSegundaUnidad,
  aplicarProductoRegalo,
  aplicarLogicaDescuento
};
