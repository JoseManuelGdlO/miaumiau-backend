const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { uploadComprobantes } = require('../../utils/uploadImages');
const controller = require('./controller');

const router = express.Router();
const guard = [authenticateToken, requireSuperAdminOrPermission('operar_call_center')];

router.get('/solicitudes', ...guard, controller.solicitudes);
router.get('/cargas-validadas', ...guard, controller.cargasValidadas);
router.get('/solicitudes/:id', ...guard, controller.solicitud);
router.post('/solicitudes/:id/aprobar', ...guard, controller.aprobar);
router.put('/solicitudes/:id/extras', ...guard, controller.extras);
router.get('/inventario', ...guard, controller.inventario);
router.post('/solicitudes/:id/atender', ...guard, controller.atender);
router.post('/solicitudes/:id/ayuda', ...guard, controller.resolverAyuda);
router.get('/pedidos', ...guard, controller.pedidos);
router.patch('/pedidos/:id/estado', ...guard, controller.estado);
router.get('/repartidores', ...guard, controller.repartidores);
router.post('/pedidos/:id/reasignar', ...guard, controller.reasignar);
router.post('/pedidos/:id/franja', ...guard, controller.cambiarFranja);
router.post('/pedidos/:id/orden', ...guard, controller.moverParada);
router.post('/pedidos/:id/liberar-siguiente', ...guard, controller.liberarSiguiente);
router.post('/pedidos/:id/cerrar-sin-codigo', ...guard, controller.cerrarSinCodigo);
router.get('/velocidad', ...guard, controller.velocidad);
router.get('/comprobantes', ...guard, controller.comprobantes);
router.post('/pedidos/:id/comprobante', ...guard, uploadComprobantes.single('comprobante'), controller.subirComprobante);
router.get('/depositos', ...guard, controller.depositos);
router.get('/actividades', ...guard, controller.actividades);
router.post('/actividades', ...guard, controller.asignarActividad);
router.post('/pedidos/:id/reagendar', ...guard, controller.reagendar);
router.post('/solicitudes/:id/liberar-cierre', ...guard, controller.liberarCierre);
router.get('/contactos', ...guard, controller.contactos);
router.put('/contactos/:usuarioId', ...guard, controller.guardarContacto);

module.exports = router;
