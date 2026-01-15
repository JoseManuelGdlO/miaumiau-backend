const axios = require('axios');

class PagosController {
  /**
   * Genera un link de pago de Stripe
   * Recibe datos de productos y promociones, calcula el precio total,
   * crea un payment link en Stripe y retorna el formato específico para n8n
   */
  async generarLinkStripe(req, res, next) {
    try {
      
      const { telefono, productos, promocion_aplicada } = req.body;

      // Validar que productos existan y tengan estructura correcta
      if (!productos || !Array.isArray(productos) || productos.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Los productos son requeridos y deben ser un array con al menos un elemento'
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
        
        const precio = Number(producto?.precio) || 0;
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
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        return res.status(500).json({
          success: false,
          message: 'Stripe API key no configurada en el servidor'
        });
      }

      // Convertir precio total a centavos (Stripe requiere el monto en la unidad más pequeña)
      const unitAmount = total * 100;

      // Preparar datos para Stripe API (form-urlencoded)
      // Stripe requiere form-urlencoded para la API REST tradicional
      const stripeData = new URLSearchParams();
      stripeData.append('line_items[0][price_data][currency]', 'mxn');
      stripeData.append('line_items[0][price_data][product_data][name]', 'Miau Miau Pago servicios');
      stripeData.append('line_items[0][price_data][unit_amount]', unitAmount.toString());
      stripeData.append('line_items[0][quantity]', '1');
      stripeData.append('metadata[telefono]', telefono);

      try {
        const stripeResponse = await axios.post(
          'https://api.stripe.com/v1/payment_links',
          stripeData.toString(),
          {
            headers: {
              'Authorization': `Bearer ${stripeSecretKey}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );

        // Extraer URL y ID del payment link
        const paymentLinkUrl = stripeResponse.data.url;
        const paymentLinkId = stripeResponse.data.id;

        if (!paymentLinkUrl || !paymentLinkId) {
          return res.status(500).json({
            success: false,
            message: 'Error al generar el link de pago: respuesta inválida de Stripe'
          });
        }

        // --------------------
        // 4. Retornar formato específico para n8n con información de debug
        // --------------------
        return res.json({
          precioTotal: total,
          url: paymentLinkUrl,
          stripe_link_id: paymentLinkId,
          debug: {
            calculo: {
              productos: productosProcesados,
              total: total,
              nota: 'Los descuentos ya fueron aplicados a los precios de los productos mediante /aplicarCodigo'
            },
            stripe: {
              unit_amount_centavos: unitAmount,
              currency: 'mxn'
            }
          }
        });

      } catch (stripeError) {
        // Manejar errores de Stripe API
        let errorMessage = 'Error al generar el link de pago en Stripe';
        
        if (stripeError.response) {
          // Error de respuesta de Stripe
          const stripeErrorData = stripeError.response.data;
          errorMessage = stripeErrorData?.error?.message || errorMessage;
          
          console.error('Error de Stripe API:', {
            status: stripeError.response.status,
            error: stripeErrorData
          });

          return res.status(stripeError.response.status || 500).json({
            success: false,
            message: errorMessage
          });
        } else if (stripeError.request) {
          // Error de red
          console.error('Error de red al conectar con Stripe:', stripeError.message);
          return res.status(503).json({
            success: false,
            message: 'Error de conexión con Stripe. Por favor, intenta de nuevo más tarde.'
          });
        } else {
          // Error desconocido
          console.error('Error desconocido al llamar a Stripe:', stripeError.message);
          return res.status(500).json({
            success: false,
            message: errorMessage
          });
        }
      }

    } catch (error) {
      console.error('Error en generarLinkStripe:', error);
      next(error);
    }
  }
}

module.exports = new PagosController();
