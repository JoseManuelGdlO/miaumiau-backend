const { Paquete } = require('../../models');
const { createStripePaymentLink } = require('../../services/stripePaymentLink');

class PagosController {
  /**
   * Genera un link de pago de Stripe
   * Recibe datos de productos y promociones, calcula el precio total,
   * crea un payment link en Stripe y retorna el formato específico para n8n
   */
  async generarLinkStripe(req, res, next) {
    try {
      
      const { telefono, productos = [], paquetes = [], promocion_aplicada } = req.body;

      const hasProductos = Array.isArray(productos) && productos.length > 0;
      const hasPaquetes = Array.isArray(paquetes) && paquetes.length > 0;

      if (!hasProductos && !hasPaquetes) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere al menos un producto o un paquete (productos o paquetes con al menos un elemento)'
        });
      }

      // --------------------
      // 1. Calcular total basado en productos
      // Los descuentos ya fueron aplicados a los productos antes de llegar aquí
      // mediante el endpoint /aplicarCodigo
      // Ignorar productos con es_regalo = true (no se cobran)
      // --------------------
      let total = 0;
      const productosProcesados = [];
      
      if (hasProductos) {
        for (const producto of productos) {
          // Ignorar productos regalo (es_regalo = true)
          if (producto?.es_regalo === true) {
            productosProcesados.push({
              id: producto?.id || null,
              nombre: producto?.nombre || 'Sin nombre',
              precio: 0,
              cantidad: Number(producto?.cantidad) || 0,
              subtotal: 0,
              es_regalo: true,
              nota: 'Producto regalo - no se incluye en el total'
            });
            continue; // No sumar al total
          }
          
          const precio = Number(producto?.precio ?? producto?.precio_unidad) || 0;
          const cantidad = Number(producto?.cantidad) || 0;
          const subtotalProducto = precio * cantidad;
          total += subtotalProducto;
          
          productosProcesados.push({
            id: producto?.id || null,
            nombre: producto?.nombre || 'Sin nombre',
            precio: precio,
            cantidad: cantidad,
            subtotal: Math.round(subtotalProducto)
          });
        }
      }

      // --------------------
      // 2. Calcular total basado en paquetes
      // precio_unidad en request o precio_final del paquete en BD
      // --------------------
      const paquetesProcesados = [];
      if (hasPaquetes) {
        for (const item of paquetes) {
          const fkid_paquete = item?.fkid_paquete;
          const cantidad = parseInt(item?.cantidad, 10) || 0;
          if (!fkid_paquete || cantidad < 1) {
            return res.status(400).json({
              success: false,
              message: `Cada paquete debe tener fkid_paquete (entero positivo) y cantidad (entero >= 1)`
            });
          }
          const paqueteData = await Paquete.findByPk(fkid_paquete);
          if (!paqueteData) {
            return res.status(400).json({
              success: false,
              message: `El paquete con ID ${fkid_paquete} no existe`
            });
          }
          if (!paqueteData.is_active) {
            return res.status(400).json({
              success: false,
              message: `El paquete con ID ${fkid_paquete} no está activo`
            });
          }
          const precioUnidad = Number(item?.precio_unidad) || parseFloat(paqueteData.precio_final) || 0;
          const subtotalPaquete = precioUnidad * cantidad;
          total += subtotalPaquete;
          paquetesProcesados.push({
            id: paqueteData.id,
            nombre: paqueteData.nombre || 'Paquete',
            precio_unidad: precioUnidad,
            cantidad,
            subtotal: Math.round(subtotalPaquete)
          });
        }
      }

      total = Math.max(0, Math.round(total));

      // Validar que el precio total sea mayor a 0
      if (total <= 0) {
        return res.status(400).json({
          success: false,
          message: 'El precio total debe ser mayor a 0 para generar un link de pago'
        });
      }

      // --------------------
      // 3. Generar payment link en Stripe
      // --------------------
      const unitAmount = total * 100;

      try {
        const { url: paymentLinkUrl, id: paymentLinkId } = await createStripePaymentLink({
          unitAmountCentavos: unitAmount,
          telefono,
          extraMetadata: {}
        });

        // --------------------
        // 4. Retornar formato específico para n8n con información de debug
        // --------------------
        const notaCalculo = hasPaquetes && hasProductos
          ? 'Total = productos + paquetes. Descuentos aplicados vía /aplicarCodigo en productos.'
          : hasPaquetes
            ? 'Total por paquetes (precio_unidad o precio_final del paquete).'
            : 'Los descuentos ya fueron aplicados a los precios de los productos mediante /aplicarCodigo';

        return res.json({
          precioTotal: total,
          url: paymentLinkUrl,
          stripe_link_id: paymentLinkId,
          debug: {
            calculo: {
              productos: productosProcesados,
              paquetes: paquetesProcesados,
              total: total,
              nota: notaCalculo
            },
            stripe: {
              unit_amount_centavos: unitAmount,
              currency: 'mxn'
            }
          }
        });
      } catch (stripeError) {
        const status = stripeError.statusCode || 500;
        const message = stripeError.message || 'Error al generar el link de pago en Stripe';

        if (status >= 500 || stripeError.code === 'STRIPE_NETWORK') {
          console.error('Error al generar link Stripe (pagos):', {
            status,
            code: stripeError.code,
            message
          });
        }

        return res.status(status).json({
          success: false,
          message
        });
      }

    } catch (error) {
      console.error('Error en generarLinkStripe:', error);
      next(error);
    }
  }
}

module.exports = new PagosController();
