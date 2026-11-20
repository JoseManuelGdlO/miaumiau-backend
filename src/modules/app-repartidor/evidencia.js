const crypto = require('crypto');
const fs = require('fs');
const { z } = require('zod');

const POLITICA_BASE = {
  montoMin: 798,
  montoMax: 802,
  toleranciaOdometroKm: 1,
  toleranciaTiempoMs: 10 * 60 * 1000,
  toleranciaMathMxn: 1.5,
};

const confianza = z.enum(['alta', 'media', 'baja']).nullable();

const Lectura = z.object({
  legible: z.boolean(),
  motivo: z.string(),
  kilometraje: z.number().nullable(),
  odometro_tablero: z.number().nullable(),
  odometro_ticket: z.number().nullable(),
  costo_mxn: z.number().nullable(),
  litros: z.number().nullable(),
  fecha_hora_ticket: z.string().nullable(),
  precio_litro: z.number().nullable(),
  estacion: z.string().nullable(),
  folio: z.string().nullable(),
  confianza: z.object({
    kilometraje: confianza,
    odometro_tablero: confianza,
    odometro_ticket: confianza,
    costo_mxn: confianza,
    litros: confianza,
    fecha_hora_ticket: confianza,
    precio_litro: confianza,
    estacion: confianza,
    folio: confianza,
  }),
});

const CONFIANZA_SCHEMA = {
  type: ['string', 'null'],
  enum: ['alta', 'media', 'baja', null],
};

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'legible', 'motivo', 'kilometraje', 'odometro_tablero', 'odometro_ticket',
    'costo_mxn', 'litros', 'fecha_hora_ticket', 'precio_litro', 'estacion', 'folio', 'confianza',
  ],
  properties: {
    legible: { type: 'boolean' },
    motivo: { type: 'string' },
    kilometraje: { type: ['number', 'null'] },
    odometro_tablero: { type: ['number', 'null'] },
    odometro_ticket: { type: ['number', 'null'] },
    costo_mxn: { type: ['number', 'null'] },
    litros: { type: ['number', 'null'] },
    fecha_hora_ticket: { type: ['string', 'null'] },
    precio_litro: { type: ['number', 'null'] },
    estacion: { type: ['string', 'null'] },
    folio: { type: ['string', 'null'] },
    confianza: {
      type: 'object',
      additionalProperties: false,
      required: [
        'kilometraje', 'odometro_tablero', 'odometro_ticket', 'costo_mxn', 'litros',
        'fecha_hora_ticket', 'precio_litro', 'estacion', 'folio',
      ],
      properties: {
        kilometraje: CONFIANZA_SCHEMA,
        odometro_tablero: CONFIANZA_SCHEMA,
        odometro_ticket: CONFIANZA_SCHEMA,
        costo_mxn: CONFIANZA_SCHEMA,
        litros: CONFIANZA_SCHEMA,
        fecha_hora_ticket: CONFIANZA_SCHEMA,
        precio_litro: CONFIANZA_SCHEMA,
        estacion: CONFIANZA_SCHEMA,
        folio: CONFIANZA_SCHEMA,
      },
    },
  },
};

function normalizarTipo(tipo) {
  if (tipo === 'odometro' || tipo === 'inicio') return 'odometro';
  if (tipo === 'combustible') return 'combustible';
  const err = new Error('Tipo de foto inválido');
  err.status = 422;
  throw err;
}

function politicaDe(entrada) {
  const src = entrada && typeof entrada === 'object' ? entrada : {};
  const out = { ...POLITICA_BASE };
  for (const key of Object.keys(POLITICA_BASE)) {
    const n = Number(src[key]);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

function textoONull(valor) {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio || null;
}

function horaTicket(valor) {
  const texto = textoONull(valor);
  if (!texto) return null;
  const parsed = new Date(texto);
  return Number.isNaN(parsed.getTime()) ? texto : parsed.toISOString();
}

function marcasDeTiempo({ fechaCaptura, ahora = new Date() } = {}) {
  const fechaRecepcion = ahora.toISOString();
  const cruda = typeof fechaCaptura === 'string' ? fechaCaptura.trim() : '';
  const parsed = cruda ? new Date(cruda) : null;
  const capturaValida = Boolean(parsed && !Number.isNaN(parsed.getTime()));
  return {
    fechaCaptura: capturaValida ? parsed.toISOString() : fechaRecepcion,
    fechaRecepcion,
    fechaCapturaOrigen: capturaValida ? 'cliente' : 'recepcion',
  };
}

function datosDe(tipo, lectura) {
  const extra = {
    fecha_hora_ticket: horaTicket(lectura.fecha_hora_ticket),
    precio_litro: lectura.precio_litro,
    estacion: textoONull(lectura.estacion),
    folio: textoONull(lectura.folio),
  };
  if (tipo === 'odometro') {
    const km = lectura.kilometraje ?? lectura.odometro_tablero;
    return {
      kilometraje: km,
      odometro_tablero: km,
      odometro_ticket: null,
      costo_mxn: null,
      litros: null,
      ...extra,
      fecha_hora_ticket: null,
      precio_litro: null,
      estacion: null,
      folio: null,
    };
  }
  const tablero = lectura.odometro_tablero ?? lectura.kilometraje;
  const ticket = lectura.odometro_ticket;
  return {
    kilometraje: tablero ?? ticket,
    odometro_tablero: tablero,
    odometro_ticket: ticket,
    costo_mxn: lectura.costo_mxn,
    litros: lectura.litros,
    ...extra,
  };
}

function incompletaDe(tipo, datos) {
  if (tipo === 'odometro') return datos.kilometraje == null;
  return datos.fecha_hora_ticket == null || datos.costo_mxn == null || datos.kilometraje == null;
}

function hayAlgo(datos) {
  return [
    datos.kilometraje, datos.odometro_tablero, datos.odometro_ticket,
    datos.costo_mxn, datos.litros, datos.precio_litro,
    datos.fecha_hora_ticket, datos.estacion, datos.folio,
  ].some((valor) => valor != null);
}

function mismaClave(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function alertasDe(tipo, datos, marcas, opciones = {}) {
  const politica = politicaDe(opciones.politica);
  const historial = opciones.historial || {};
  const alertas = [];
  const incompleta = incompletaDe(tipo, datos);
  if (incompleta) {
    alertas.push({
      codigo: 'UNREADABLE',
      mensaje: incompleta ? 'Falta un dato que no se pudo leer.' : 'La foto no se lee por completo.',
    });
  }
  if (
    tipo === 'combustible'
    && datos.odometro_tablero != null
    && datos.odometro_ticket != null
    && Math.abs(datos.odometro_tablero - datos.odometro_ticket) > politica.toleranciaOdometroKm
  ) {
    alertas.push({ codigo: 'ODOMETER_MISMATCH', mensaje: 'El odómetro del tablero y el del ticket no coinciden.' });
  }
  if (tipo === 'combustible' && datos.costo_mxn != null && datos.costo_mxn < politica.montoMin) {
    alertas.push({ codigo: 'FUEL_BELOW_MIN', mensaje: `El monto está debajo de $${politica.montoMin.toFixed(2)} MXN.` });
  }
  if (tipo === 'combustible' && datos.costo_mxn != null && datos.costo_mxn > politica.montoMax) {
    alertas.push({ codigo: 'FUEL_ABOVE_MAX', mensaje: `El monto está arriba de $${politica.montoMax.toFixed(2)} MXN.` });
  }
  if (tipo === 'combustible' && datos.litros != null && datos.precio_litro != null && datos.costo_mxn != null) {
    const esperado = datos.litros * datos.precio_litro;
    if (Math.abs(esperado - datos.costo_mxn) > politica.toleranciaMathMxn) {
      alertas.push({ codigo: 'MATH_MISMATCH', mensaje: 'Litros por precio por litro no cuadra con el total.' });
    }
  }
  if (tipo === 'combustible' && marcas?.fechaRecepcion) {
    const recepcion = new Date(marcas.fechaRecepcion).getTime();
    const ticket = datos.fecha_hora_ticket ? new Date(datos.fecha_hora_ticket).getTime() : NaN;
    const ticketMal = Number.isFinite(ticket) && (ticket > recepcion || recepcion - ticket > politica.toleranciaTiempoMs);
    const capturaMal = marcas.fechaCapturaOrigen === 'cliente'
      && marcas.fechaCaptura
      && Math.abs(new Date(marcas.fechaCaptura).getTime() - recepcion) > politica.toleranciaTiempoMs;
    if (ticketMal || capturaMal) {
      alertas.push({
        codigo: 'TICKET_TIME_MISMATCH',
        mensaje: 'La hora del ticket o de la captura no cuadra con la recepción.',
      });
    }
  }
  const km = datos.kilometraje;
  const previos = Array.isArray(historial.kilometrajes) ? historial.kilometrajes.map(Number) : [];
  if (km != null && previos.some((previo) => previo === km)) {
    alertas.push({ codigo: 'REPEATED_ODOMETER', mensaje: 'Ese kilometraje ya estaba registrado.' });
  }
  if (km != null && historial.ultimoKilometraje != null && km < Number(historial.ultimoKilometraje)) {
    alertas.push({ codigo: 'ODOMETER_REGRESSION', mensaje: 'El odómetro es menor que el último registrado.' });
  }
  if (tipo === 'combustible' && datos.folio && datos.estacion && datos.costo_mxn != null && datos.litros != null) {
    const repetido = (historial.recibos || []).some((recibo) => (
      mismaClave(recibo.folio, datos.folio)
      && mismaClave(recibo.estacion, datos.estacion)
      && Number(recibo.costo_mxn) === Number(datos.costo_mxn)
      && Number(recibo.litros) === Number(datos.litros)
    ));
    if (repetido) {
      alertas.push({ codigo: 'DUPLICATE_RECEIPT', mensaje: 'Ese folio, estación, monto y litros ya estaban registrados.' });
    }
  }
  if (opciones.imagenHash && (historial.hashes || []).includes(opciones.imagenHash)) {
    alertas.push({ codigo: 'REUSED_IMAGE', mensaje: 'Esta imagen ya se había enviado.' });
  }
  return alertas;
}

function historialDesde(filas) {
  const eventos = [];
  for (const fila of filas || []) {
    const evidencias = fila?.evidencias;
    if (!evidencias || typeof evidencias !== 'object') continue;
    for (const tipo of ['odometro', 'combustible']) {
      if (fila.excluirTipo === tipo) continue;
      const row = evidencias[tipo];
      if (!row || typeof row !== 'object') continue;
      eventos.push({ ...row, _cuando: row.fechaRecepcion || String(fila.fecha || '') });
    }
  }
  eventos.sort((a, b) => String(b._cuando).localeCompare(String(a._cuando)));
  const kilometrajes = [];
  let ultimoKilometraje = null;
  const recibos = [];
  const hashes = [];
  for (const ev of eventos) {
    if (ev.kilometraje != null && Number.isFinite(Number(ev.kilometraje))) {
      const km = Number(ev.kilometraje);
      kilometrajes.push(km);
      if (ultimoKilometraje == null) ultimoKilometraje = km;
    }
    if (ev.imagenHash) hashes.push(String(ev.imagenHash));
    if (ev.folio && ev.estacion && ev.costo_mxn != null && ev.litros != null) {
      recibos.push({
        folio: String(ev.folio),
        estacion: String(ev.estacion),
        costo_mxn: Number(ev.costo_mxn),
        litros: Number(ev.litros),
      });
    }
  }
  return { kilometrajes, ultimoKilometraje, recibos, hashes };
}

function decidirLectura(tipo, raw, marcas, opciones = {}) {
  const normalizado = normalizarTipo(tipo);
  const parsed = Lectura.safeParse(raw);
  const vacia = {
    estado: 'rechazada',
    motivo: 'La foto no se lee. Vuelve a tomarla.',
    alertas: [{ codigo: 'UNREADABLE', mensaje: 'La lectura no tiene el formato esperado.' }],
    kilometraje: null,
    odometro_tablero: null,
    odometro_ticket: null,
    costo_mxn: null,
    litros: null,
    fecha_hora_ticket: null,
    precio_litro: null,
    estacion: null,
    folio: null,
    confianza: null,
  };
  if (!parsed.success) return vacia;
  const datos = datosDe(normalizado, parsed.data);
  const incompleta = incompletaDe(normalizado, datos);
  const alertas = alertasDe(normalizado, datos, marcas, {
    ...opciones,
    legible: parsed.data.legible,
  });
  let estado = 'validada';
  if (incompleta) {
    estado = hayAlgo(datos) ? 'revision' : 'rechazada';
  }
  return {
    estado,
    motivo: estado === 'validada' ? null : (parsed.data.motivo.trim() || vacia.motivo),
    alertas,
    ...datos,
    confianza: hayAlgo(datos) ? parsed.data.confianza : null,
  };
}

function fotoUrl(pathValue) {
  const raw = String(pathValue || '').trim();
  if (!raw) return null;
  const relative = raw.replace(/^\/+/, '');
  const withUploads = relative.startsWith('uploads/') ? relative : `uploads/${relative}`;
  return `/${withUploads}`;
}

function resumenEvidencias(stored) {
  const src = stored && typeof stored === 'object' ? stored : {};
  const uno = (tipo) => {
    const row = src[tipo];
    if (!row || !['validada', 'rechazada', 'revision'].includes(row.estado)) return null;
    return {
      estado: row.estado,
      motivo: row.motivo || null,
      alertas: Array.isArray(row.alertas) ? row.alertas : [],
      usuario: row.usuario || null,
      vehiculoId: row.vehiculoId ?? null,
      origen: row.origen || null,
      fechaCaptura: row.fechaCaptura || null,
      fechaRecepcion: row.fechaRecepcion || null,
      fechaCapturaOrigen: row.fechaCapturaOrigen || null,
      kilometraje: row.kilometraje ?? null,
      odometro_tablero: row.odometro_tablero ?? null,
      odometro_ticket: row.odometro_ticket ?? null,
      costo_mxn: row.costo_mxn ?? null,
      litros: row.litros ?? null,
      fecha_hora_ticket: row.fecha_hora_ticket || null,
      precio_litro: row.precio_litro ?? null,
      estacion: row.estacion || null,
      folio: row.folio || null,
      confianza: row.confianza || null,
      url: fotoUrl(row.path),
    };
  };
  return { odometro: uno('odometro'), combustible: uno('combustible') };
}

async function analizarFoto({
  tipo,
  filePath,
  mime,
  fetchImpl = fetch,
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL,
}) {
  const normalizado = normalizarTipo(tipo);
  if (!apiKey) {
    const err = new Error('Falta OPENAI_API_KEY');
    err.status = 503;
    throw err;
  }
  if (!model) {
    const err = new Error('Falta OPENAI_MODEL');
    err.status = 503;
    throw err;
  }
  const bytes = await fs.promises.readFile(filePath);
  const imagenHash = crypto.createHash('sha256').update(bytes).digest('hex');
  const dataUrl = `data:${mime || 'image/jpeg'};base64,${bytes.toString('base64')}`;
  const pide = normalizado === 'combustible'
    ? 'La foto puede ser el ticket de la bomba o solo el voucher. Obligatorios: fecha_hora_ticket (ISO 8601), costo_mxn y kilometraje (el del tablero, o el del ticket si el tablero no está; odometro_tablero y odometro_ticket van por separado si constan). litros y precio_litro son opcionales: null si el voucher no los trae. Extrae también estacion y folio si se leen.'
    : 'La foto es el odómetro al inicio de la jornada. kilometraje y odometro_tablero son el mismo número. odometro_ticket, costo_mxn, litros, fecha_hora_ticket, precio_litro, estacion y folio van null.';
  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${pide} Si un dato no se lee, no lo inventes: ese campo null y su confianza null. Llena los campos que sí se lean aunque otros fallen. legible=false solo si falta fecha_hora_ticket, costo_mxn o kilometraje, con motivo en una frase corta. No marques ilegible solo porque falten litros o precio por litro. Confianza de cada campo leído: alta, media o baja.`,
          },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'lectura_evidencia', strict: true, schema: JSON_SCHEMA },
      },
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(body?.error?.message || 'No se pudo analizar la foto');
    err.status = 502;
    throw err;
  }
  const text = body?.choices?.[0]?.message?.content;
  return { lectura: JSON.parse(text), imagenHash };
}

module.exports = {
  Lectura,
  POLITICA_BASE,
  normalizarTipo,
  politicaDe,
  marcasDeTiempo,
  historialDesde,
  decidirLectura,
  resumenEvidencias,
  analizarFoto,
};
