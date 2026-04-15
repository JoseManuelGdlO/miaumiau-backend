const axios = require('axios');

const STRIPE_PAYMENT_LINKS_URL = 'https://api.stripe.com/v1/payment_links';
const LINE_NAME = 'Miau Miau Pago servicios';

/**
 * @param {object} opts
 * @param {number} opts.unitAmountCentavos - Entero, monto en centavos (ej. MXN * 100)
 * @param {string} [opts.telefono] - Valor para metadata[telefono]
 * @param {Record<string, string|number>} [opts.extraMetadata] - Claves planas (Stripe metadata)
 * @returns {Promise<{ url: string, id: string }>}
 */
async function createStripePaymentLink({ unitAmountCentavos, telefono = '', extraMetadata = {} }) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    const err = new Error('Stripe API key no configurada en el servidor');
    err.statusCode = 500;
    err.code = 'STRIPE_KEY_MISSING';
    throw err;
  }

  if (!Number.isInteger(unitAmountCentavos) || unitAmountCentavos < 1) {
    const err = new Error('Monto inválido para generar link de pago');
    err.statusCode = 400;
    err.code = 'INVALID_AMOUNT';
    throw err;
  }

  const stripeData = new URLSearchParams();
  stripeData.append('line_items[0][price_data][currency]', 'mxn');
  stripeData.append('line_items[0][price_data][product_data][name]', LINE_NAME);
  stripeData.append('line_items[0][price_data][unit_amount]', String(unitAmountCentavos));
  stripeData.append('line_items[0][quantity]', '1');
  stripeData.append('metadata[telefono]', String(telefono || '').slice(0, 500));

  for (const [key, rawVal] of Object.entries(extraMetadata)) {
    if (rawVal == null || key == null) continue;
    const safeKey = String(key).replace(/[^\w\-]/g, '_').slice(0, 40);
    if (!safeKey) continue;
    stripeData.append(`metadata[${safeKey}]`, String(rawVal).slice(0, 500));
  }

  try {
    const stripeResponse = await axios.post(STRIPE_PAYMENT_LINKS_URL, stripeData.toString(), {
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const paymentLinkUrl = stripeResponse.data?.url;
    const paymentLinkId = stripeResponse.data?.id;

    if (!paymentLinkUrl || !paymentLinkId) {
      const err = new Error('Error al generar el link de pago: respuesta inválida de Stripe');
      err.statusCode = 500;
      err.code = 'STRIPE_INVALID_RESPONSE';
      throw err;
    }

    return { url: paymentLinkUrl, id: paymentLinkId };
  } catch (e) {
    if (e.statusCode && e.code) throw e;
    throw normalizeStripeRequestError(e);
  }
}

/**
 * Convierte error de axios/Stripe en Error con statusCode para respuestas HTTP.
 * @param {unknown} stripeError
 * @returns {Error & { statusCode?: number, code?: string }}
 */
function normalizeStripeRequestError(stripeError) {
  const fallback = new Error('Error al generar el link de pago en Stripe');
  fallback.statusCode = 500;
  fallback.code = 'STRIPE_ERROR';

  if (!stripeError || typeof stripeError !== 'object') {
    return fallback;
  }

  if (stripeError.response) {
    const stripeErrorData = stripeError.response.data;
    const msg = stripeErrorData?.error?.message || fallback.message;
    const err = new Error(msg);
    err.statusCode = stripeError.response.status || 500;
    err.code = 'STRIPE_API_ERROR';
    return err;
  }

  if (stripeError.request) {
    const err = new Error('Error de conexión con Stripe. Por favor, intenta de nuevo más tarde.');
    err.statusCode = 503;
    err.code = 'STRIPE_NETWORK';
    return err;
  }

  const err = new Error(stripeError.message || fallback.message);
  err.statusCode = 500;
  err.code = 'STRIPE_ERROR';
  return err;
}

module.exports = {
  createStripePaymentLink,
  normalizeStripeRequestError
};
