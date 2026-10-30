const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
require('dotenv').config();

const BACKEND_VERSION = process.env.BACKEND_VERSION || '1.0.0';

const { ensureUploadsDirs } = require('./utils/uploadImages');

const { sequelize } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const requestLogger = require('./middleware/requestLogger');
const { Logger } = require('./utils/logger');
const { attachRealtime } = require('./modules/realtime/attach');
const { verifyRepartidorToken } = require('./modules/realtime/auth');
const { getHub } = require('./modules/realtime');

const log = new Logger('App');
const autoEntregarPedidos = require('./jobs/autoEntregarPedidos');
const reencolarAyer = require('./jobs/reencolarNoEntregados');

// Importar rutas
const authRoutes = require('./modules/auth/routes');
const userRoutes = require('./modules/users/routes');
const permissionRoutes = require('./modules/permissions/routes');
const roleRoutes = require('./modules/roles/routes');
const cityRoutes = require('./modules/cities/routes');
const promotionRoutes = require('./modules/promotions/routes');
const pesoRoutes = require('./modules/pesos/routes');
const categoriaProductoRoutes = require('./modules/categorias-producto/routes');
const clienteRoutes = require('./modules/clientes/routes');
const proveedorRoutes = require('./modules/proveedores/routes');
const inventarioRoutes = require('./modules/inventarios/routes');
const conversacionRoutes = require('./modules/conversaciones/routes');
const conversacionChatRoutes = require('./modules/conversaciones-chat/routes');
const conversacionLogRoutes = require('./modules/conversaciones-logs/routes');
const conversacionFlagRoutes = require('./modules/conversaciones-flags/routes');
const pedidoRoutes = require('./modules/pedidos/routes');
const productoPedidoRoutes = require('./modules/productos-pedido/routes');
const mascotaRoutes = require('./modules/mascotas/routes');
const agenteRoutes = require('./modules/agentes/routes');
const repartidorRoutes = require('./modules/repartidores/routes');
const rutaRoutes = require('./modules/rutas/routes');
const notificacionRoutes = require('./modules/notificaciones/routes');
const paqueteRoutes = require('./modules/paquetes/routes');
const historialRoutes = require('./modules/historial/routes');
const { registrarCambio, describirCambio } = require('./modules/historial/service');
const mensajeriaRoutes = require('./modules/mensajeria/routes');
const mapsRoutes = require('./modules/maps/routes');
const pagosRoutes = require('./modules/pagos/routes');
const catalogoRoutes = require('./modules/catalogo/routes');
const {
  publicSiteSettingsRoutes,
  siteSettingsRoutes,
} = require('./modules/site-settings/routes');
const portalClienteRoutes = require('./modules/portal/routes');
const n8nRoutes = require('./modules/n8n/routes');
const pushRoutes = require('./modules/push/routes');
const { metaPublicRoutes } = require('./modules/meta/publicRoutes');

const app = express();

/** Coincide con el header Origin del navegador (sin barra final). */
function normalizeCorsOrigin(url) {
  if (!url || typeof url !== 'string') return null;
  const t = url.trim();
  if (!t) return null;
  return t.replace(/\/$/, '');
}

function getAllowedCorsOriginsSet() {
  const set = new Set();
  const add = (u) => {
    const n = normalizeCorsOrigin(u);
    if (n) set.add(n);
  };
  [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'capacitor://localhost',
    'http://localhost',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://192.168.1.64:8080',
    'http://192.168.1.64:3000',
    'https://intelekia-miaumiau-front.vvggha.easypanel.host',
    'https://officina.miaumiau.com.mx',
    'https://miaumiau.com.mx',
    process.env.FRONTEND_URL,
    process.env.PUBLIC_WEB_URL,
    process.env.MARKETING_URL,
    ...(process.env.CORS_EXTRA_ORIGINS || '').split(',')
  ].forEach(add);
  return set;
}

// Configurar trust proxy para funcionar detrás de proxy reverso (EasyPanel, nginx, etc.)
// Esto permite que Express confíe en los headers X-Forwarded-* del proxy
app.set('trust proxy', true);

// Middlewares de seguridad
app.use(helmet({
  // El portal y la app del repartidor viven en otro origen. same-origin bloquea esas respuestas.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(compression({
  filter: (req, res) => {
    const accept = req.headers.accept || '';
    if (accept.includes('text/event-stream')) return false;
    return compression.filter(req, res);
  },
}));

// CORS va antes del límite: si no, el 429 sale sin Access-Control-Allow-Origin
// y el navegador lo muestra como un fallo de CORS en cada reintento.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  next();
});

// CORS — el Origin es la URL de la página (no la del API). Añade dominios en
// PUBLIC_WEB_URL / FRONTEND_URL o CORS_EXTRA_ORIGINS (coma-separado, sin espacios extra).
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (como mobile apps o Postman)
    if (!origin) return callback(null, true);

    const allowed = getAllowedCorsOriginsSet();
    const norm = normalizeCorsOrigin(origin);
    if (norm && allowed.has(norm)) {
      callback(null, true);
    } else {
      log.warn('CORS blocked origin', { origin });
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200 // Para legacy browser support
}));

// Manejar preflight requests explícitamente
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  if (origin) res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Private-Network', 'true');
  res.sendStatus(200);
});

// Rate limiting (más permisivo en desarrollo). Call Center refresca varias
// listas cada pocos segundos; 1000 por IP se agota y el resto falla en bloque.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'development' ? 10000 : 300,
  message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
  // trust proxy está activo por el proxy de producción. Sin esto el límite
  // tira en cada request y la respuesta sale sin cabeceras de CORS.
  validate: { trustProxy: false },
});
app.use(limiter);

app.use(requestLogger);

// Body parsing: POST /api/conversaciones-chat puede enviar JSON con saltos de línea literales
// en "mensaje"; los normalizamos antes de parsear para aceptar esos payloads.
const { normalizeJsonMensaje } = require('./utils/normalizeJsonMensaje');
app.use((req, res, next) => {
  const isConversacionesChatPost = req.method === 'POST' && req.path === '/api/conversaciones-chat';
  const isJson = req.is('application/json');
  if (isConversacionesChatPost && isJson) {
    const chunks = [];
    req.setEncoding('utf8');
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = chunks.join('');
      try {
        req.body = JSON.parse(normalizeJsonMensaje(raw));
        next();
      } catch (e) {
        res.status(400).json({
          success: false,
          message: 'JSON inválido',
          error: e.message
        });
      }
    });
  } else {
    next();
  }
});
app.use(express.json({
  limit: '10mb',
  type: (req) => {
    if (req.method === 'POST' && req.path === '/api/conversaciones-chat') return false;
    if (req.is('multipart/form-data')) return false;
    return true;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const SIN_HISTORIAL = ['/api/auth', '/api/app-repartidor', '/api/portal', '/api/public', '/api/n8n', '/api/push', '/api/conversaciones-chat'];
app.use((req, res, next) => {
  res.on('finish', () => {
    if (!req.user?.id || res.statusCode >= 400) return;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
    const ruta = req.originalUrl.split('?')[0];
    if (SIN_HISTORIAL.some((prefix) => ruta.startsWith(prefix))) return;
    if (ruta.includes('/cerrar-sin-codigo')) return;
    const escrito = describirCambio(req.method, ruta);
    const cuerpo = req.body && typeof req.body === 'object' ? { ...req.body } : {};
    for (const clave of ['contrasena', 'password', 'token', 'authorization', 'refreshToken']) delete cuerpo[clave];
    const contexto = JSON.stringify({
      ip: req.headers['x-forwarded-for'] || req.ip || null,
      ruta,
      metodo: req.method,
      usuario: req.user.nombre_completo || req.user.id,
      body: cuerpo,
    }).slice(0, 1500);
    void registrarCambio({
      usuarioId: req.user.id,
      accion: escrito.accion,
      entidad: escrito.entidad,
      entidadId: req.params?.id || null,
      detalle: `${escrito.detalle}\n${contexto}`,
    });
  });
  next();
});

// Carpeta de uploads (imágenes de productos y combos) y ruta estática
// CORS explícito para /uploads: el frontend puede estar en otro origen (puerto) y cargar imágenes
ensureUploadsDirs();
app.use('/uploads', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Catálogo público por ciudad (CSV para Meta) - sin /api, sin auth
app.use('/catalogo', catalogoRoutes);

// Portal de clientes (tienda web)
app.use('/api/portal', portalClienteRoutes);

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/historial', historialRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/cities', cityRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/pesos', pesoRoutes);
app.use('/api/categorias-producto', categoriaProductoRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/proveedores', proveedorRoutes);
app.use('/api/inventarios', inventarioRoutes);
app.use('/api/conversaciones', conversacionRoutes);
app.use('/api/conversaciones-chat', conversacionChatRoutes);
app.use('/api/conversaciones-logs', conversacionLogRoutes);
app.use('/api/conversaciones-flags', conversacionFlagRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/productos-pedido', productoPedidoRoutes);
app.use('/api/mascotas', mascotaRoutes);
app.use('/api/agentes', agenteRoutes);
app.use('/api/repartidores', repartidorRoutes);
const appRepartidorRoutes = require('./modules/app-repartidor/routes');
app.use('/api/app-repartidor', appRepartidorRoutes);
const callCenterRoutes = require('./modules/call-center/routes');
app.use('/api/call-center', callCenterRoutes);
app.use('/api/rutas', rutaRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/paquetes', paqueteRoutes);
app.use('/api/mensajeria', mensajeriaRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/n8n', n8nRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/public/meta', metaPublicRoutes);
app.use('/api/public', publicSiteSettingsRoutes);
app.use('/api/site-settings', siteSettingsRoutes);

// Ruta de salud
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Miaumiau API está funcionando correctamente',
    version: BACKEND_VERSION,
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

app.get('/vincular.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/vincular.js'));
});
app.get('/vincular/:token', (req, res) => {
  res.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' https://connect.facebook.net",
    "frame-src https://www.facebook.com https://web.facebook.com",
    "connect-src 'self' https://www.facebook.com https://graph.facebook.com https://connect.facebook.net",
    "style-src 'self' 'unsafe-inline'"
  ].join('; '));
  res.sendFile(path.join(__dirname, '../public/vincular.html'));
});

// Middlewares de error
app.use(notFound);
app.use(errorHandler);

// Inicializar base de datos y servidor
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Conectar a la base de datos
    await sequelize.authenticate();
    log.info('Conexión a la base de datos establecida correctamente.');
    
    // Sincronizar modelos (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      // await sequelize.sync({ alter: true });
      log.info('Modelos sincronizados con la base de datos.');
    }
    
    // Iniciar servidor
    const server = http.createServer(app);
    attachRealtime(server, {
      hub: getHub(),
      verifyToken: (token) => verifyRepartidorToken(token),
    });
    server.listen(PORT, () => {
      log.info(`Servidor Miaumiau v${BACKEND_VERSION} corriendo en puerto ${PORT}`);
      log.info(`Health check: http://localhost:${PORT}/health`);
    });

    // Iniciar jobs programados
    // Job para auto-entregar pedidos: se ejecuta cada hora (al minuto 0 de cada hora)
    cron.schedule('0 * * * *', async () => {
      log.info('Ejecutando job: Auto-entregar pedidos');
      try {
        await autoEntregarPedidos();
      } catch (error) {
        log.error('Error ejecutando job auto-entregar pedidos', { message: error.message, stack: error.stack });
      }
    }, {
      scheduled: true,
      timezone: "America/Mexico_City" // Ajusta según tu zona horaria
    });
    
    cron.schedule('5 0 * * *', async () => {
      log.info('Ejecutando job: Re-encolar no entregados');
      try {
        const moved = await reencolarAyer();
        log.info('Pedidos no entregados vueltos a la cola', { moved });
      } catch (error) {
        log.error('Error re-encolando no entregados', { message: error.message, stack: error.stack });
      }
    }, {
      scheduled: true,
      timezone: 'America/Mexico_City',
    });

    log.info('Jobs programados iniciados: Auto-entregar pedidos (cada hora), re-encolar no entregados (00:05)');
  } catch (error) {
    log.error('Error al iniciar el servidor', { message: error.message, stack: error.stack });
    process.exit(1);
  }
};

startServer();

module.exports = app;
