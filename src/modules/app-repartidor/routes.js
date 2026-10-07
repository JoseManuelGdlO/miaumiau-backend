const express = require('express');
const router = express.Router();
const { authenticateRepartidor } = require('../../middleware/repartidorAuth');
const { uploadComprobantes } = require('../../utils/uploadImages');
const controller = require('./controller');

router.use(authenticateRepartidor);
router.get('/me', controller.me);
router.get('/jornada', controller.jornada);
router.put('/jornada/carga', controller.replaceCarga);
router.post('/jornada/solicitar-validacion', controller.solicitarValidacion);
router.get('/solicitudes/:notificacionId', controller.leerSolicitud);
router.get('/pedidos', controller.pedidos);
router.get('/pedidos/:id', controller.pedido);
router.post('/pedidos/:id/llegada', controller.llegada);
router.post('/pedidos/:id/solicitar-llamada', controller.solicitarLlamada);
router.post('/pedidos/:id/no-entregado', controller.noEntregar);
router.post('/pedidos/:id/codigo', controller.codigo);
router.put('/pedidos/:id/productos', controller.productos);
router.post('/pedidos/:id/entregar', uploadComprobantes.single('comprobante'), controller.entregar);
router.post('/caja', uploadComprobantes.single('comprobante'), controller.caja);
router.post('/soporte', controller.soporte);
router.get('/estadisticas', controller.estadisticas);
router.get('/logros', controller.logros);

module.exports = router;
