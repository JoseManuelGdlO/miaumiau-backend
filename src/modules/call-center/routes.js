const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const controller = require('./controller');

const router = express.Router();
const guard = [authenticateToken, requireSuperAdminOrPermission('operar_call_center')];

router.get('/solicitudes', ...guard, controller.solicitudes);
router.get('/solicitudes/:id', ...guard, controller.solicitud);
router.post('/solicitudes/:id/aprobar', ...guard, controller.aprobar);
router.post('/solicitudes/:id/atender', ...guard, controller.atender);
router.get('/pedidos', ...guard, controller.pedidos);
router.patch('/pedidos/:id/estado', ...guard, controller.estado);
router.get('/repartidores', ...guard, controller.repartidores);
router.post('/pedidos/:id/reasignar', ...guard, controller.reasignar);

module.exports = router;
