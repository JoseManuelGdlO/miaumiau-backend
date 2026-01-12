const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const cron = require('node-cron');
require('dotenv').config();

const { sequelize } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const autoEntregarPedidos = require('./jobs/autoEntregarPedidos');

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
const pedidoRoutes = require('./modules/pedidos/routes');
const productoPedidoRoutes = require('./modules/productos-pedido/routes');
const mascotaRoutes = require('./modules/mascotas/routes');
const agenteRoutes = require('./modules/agentes/routes');
const repartidorRoutes = require('./modules/repartidores/routes');
const rutaRoutes = require('./modules/rutas/routes');
const notificacionRoutes = require('./modules/notificaciones/routes');
const paqueteRoutes = require('./modules/paquetes/routes');
const mapsRoutes = require('./modules/maps/routes');
const pagosRoutes = require('./modules/pagos/routes');

const app = express();

// Middlewares de seguridad
app.use(helmet());
app.use(compression());

// Rate limiting (más permisivo en desarrollo)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // más permisivo en desarrollo
  message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// CORS
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (como mobile apps o Postman)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://127.0.0.1:3000',
      'http://192.168.1.64:8080',
      'http://192.168.1.64:3000',
      'https://intelekia-miaumiau-front.vvggha.easypanel.host',
      'https://officina.miaumiau.com.mx',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
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
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
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
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/productos-pedido', productoPedidoRoutes);
app.use('/api/mascotas', mascotaRoutes);
app.use('/api/agentes', agenteRoutes);
app.use('/api/repartidores', repartidorRoutes);
app.use('/api/rutas', rutaRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/paquetes', paqueteRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/pagos', pagosRoutes);

// Ruta de salud
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Miaumiau API está funcionando correctamente',
    timestamp: new Date().toISOString()
  });
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
    console.log('✅ Conexión a la base de datos establecida correctamente.');
    
    // Sincronizar modelos (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      // await sequelize.sync({ alter: true });
      console.log('✅ Modelos sincronizados con la base de datos.');
    }
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });

    // Iniciar jobs programados
    // Job para auto-entregar pedidos: se ejecuta cada hora (al minuto 0 de cada hora)
    cron.schedule('0 * * * *', async () => {
      console.log(`[${new Date().toISOString()}] Ejecutando job: Auto-entregar pedidos...`);
      try {
        await autoEntregarPedidos();
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error ejecutando job auto-entregar pedidos:`, error);
      }
    }, {
      scheduled: true,
      timezone: "America/Mexico_City" // Ajusta según tu zona horaria
    });
    
    console.log('✅ Jobs programados iniciados: Auto-entregar pedidos (cada hora)');
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
