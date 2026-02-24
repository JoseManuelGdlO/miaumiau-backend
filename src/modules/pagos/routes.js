const express = require('express');
const router = express.Router();
const pagosController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones para generar link de Stripe
const validateGenerarLinkStripe = [
  body('telefono')
    .notEmpty()
    .withMessage('El teléfono es requerido')
    .isString()
    .withMessage('El teléfono debe ser una cadena de texto')
    .trim()
    .isLength({ min: 7, max: 20 })
    .withMessage('El teléfono debe tener entre 7 y 20 caracteres')
    .matches(/^[\+]?[0-9\s\-\(\)]+$/)
    .withMessage('El teléfono solo puede contener números, espacios, guiones, paréntesis y +'),
  
  body('productos')
    .optional()
    .isArray()
    .withMessage('Los productos deben ser un array'),
  
  body('paquetes')
    .optional()
    .isArray()
    .withMessage('Los paquetes deben ser un array'),
  
  body()
    .custom((value, { req }) => {
      const productos = req.body.productos;
      const paquetes = req.body.paquetes;
      const hasProductos = Array.isArray(productos) && productos.length > 0;
      const hasPaquetes = Array.isArray(paquetes) && paquetes.length > 0;
      if (!hasProductos && !hasPaquetes) {
        throw new Error('Se requiere al menos un producto o un paquete (productos o paquetes con al menos un elemento)');
      }
      if (hasProductos) {
        for (let i = 0; i < productos.length; i++) {
          const p = productos[i];
          if (p?.es_regalo) continue;
          const precio = Number(p?.precio ?? p?.precio_unidad);
          const cantidad = parseInt(p?.cantidad, 10);
          if (isNaN(precio) || precio < 0) {
            throw new Error(`Producto en posición ${i}: debe tener precio o precio_unidad >= 0`);
          }
          if (isNaN(cantidad) || cantidad < 1) {
            throw new Error(`Producto en posición ${i}: cantidad debe ser un entero >= 1`);
          }
        }
      }
      if (hasPaquetes) {
        for (let i = 0; i < paquetes.length; i++) {
          const pk = paquetes[i];
          const id = parseInt(pk?.fkid_paquete, 10);
          const cantidad = parseInt(pk?.cantidad, 10);
          if (isNaN(id) || id < 1) {
            throw new Error(`Paquete en posición ${i}: fkid_paquete debe ser un entero positivo`);
          }
          if (isNaN(cantidad) || cantidad < 1) {
            throw new Error(`Paquete en posición ${i}: cantidad debe ser un entero >= 1`);
          }
        }
      }
      return true;
    }),
  
  body('productos.*.id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID del producto debe ser un número entero positivo'),
  
  body('productos.*.nombre')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('El nombre del producto debe tener entre 1 y 200 caracteres'),
  
  body('productos.*.precio')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El precio del producto debe ser un número positivo'),
  
  body('productos.*.precio_unidad')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El precio unitario del producto debe ser un número positivo'),
  
  body('productos.*.cantidad')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La cantidad del producto debe ser un número entero positivo'),
  
  body('paquetes.*.fkid_paquete')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID del paquete debe ser un número entero positivo'),
  
  body('paquetes.*.cantidad')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La cantidad del paquete debe ser un número entero positivo'),
  
  body('paquetes.*.precio_unidad')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El precio unitario del paquete debe ser un número positivo'),
  
  body('codigo_promocion')
    .optional()
    .custom((value) => {
      // Aceptar boolean, string o null
      return typeof value === 'boolean' || typeof value === 'string' || value === null;
    })
    .withMessage('El código de promoción debe ser un booleano, string o null'),
  
  body('promocion_aplicada')
    .optional()
    .isObject()
    .withMessage('La promoción aplicada debe ser un objeto'),
  
  body('promocion_aplicada.valido')
    .optional()
    .isBoolean()
    .withMessage('El campo valido de la promoción debe ser un booleano'),
  
  // Validar estructura anidada detalle_promocion
  body('promocion_aplicada.detalle_promocion')
    .optional()
    .isObject()
    .withMessage('El detalle de la promoción debe ser un objeto'),
  
  body('promocion_aplicada.detalle_promocion.tipo_promocion')
    .optional()
    .isIn(['porcentaje', 'monto_fijo', 'envio_gratis','descuento_especial'])
    .withMessage('El tipo de promoción debe ser "porcentaje" o "monto_fijo" o "envio_gratis" o "descuento_especial"'),
  
  body('promocion_aplicada.detalle_promocion.valor_descuento')
    .optional()
    .custom((value) => {
      const numValue = parseFloat(value);
      return !isNaN(numValue) && numValue >= 0;
    })
    .withMessage('El valor de descuento debe ser un número positivo'),
  
  // También aceptar estructura plana (para compatibilidad)
  body('promocion_aplicada.tipo_promocion')
    .optional()
    .isIn(['porcentaje', 'monto_fijo', 'envio_gratis','descuento_especial'])
    .withMessage('El tipo de promoción debe ser "porcentaje" o "monto_fijo" o "envio_gratis" o "descuento_especial"'),
  
  body('promocion_aplicada.valor_descuento')
    .optional()
    .custom((value) => {
      const numValue = parseFloat(value);
      return !isNaN(numValue) && numValue >= 0;
    })
    .withMessage('El valor de descuento debe ser un número positivo'),
  
  handleValidationErrors
];

// Ruta para generar link de pago de Stripe
router.post('/generar-link-stripe',
  authenticateToken,
  requireSuperAdminOrPermission('ver_pedidos'), // Usar permiso existente o crear uno nuevo
  validateGenerarLinkStripe,
  pagosController.generarLinkStripe
);

module.exports = router;
