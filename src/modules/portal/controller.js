const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { Cliente, Pedido, ClientePuntosMovimiento, City, sequelize } = require('../../models');
const { generatePortalToken } = require('../../utils/jwt');
const { normalizeTelefono } = require('../../utils/portalPhone');
const { apellidoMatchesPassword } = require('../../utils/portalPassword');
const { resumenDesdeLedger } = require('../../services/clientePuntosLedger');

const BCRYPT_ROUNDS = 10;

async function findClienteByTelefono(telefonoRaw) {
  const normalized = normalizeTelefono(telefonoRaw);
  if (!normalized || normalized.length < 7) return null;
  const last4 = normalized.slice(-4);
  const candidates = await Cliente.unscoped().findAll({
    where: {
      isActive: true,
      telefono: { [Op.like]: `%${last4}` }
    },
    limit: 100
  });
  const hit = candidates.find((c) => normalizeTelefono(c.telefono) === normalized);
  return hit || null;
}

class PortalController {
  async login(req, res, next) {
    try {
      const { telefono, password } = req.body;
      if (!telefono) {
        return res.status(400).json({
          success: false,
          message: 'Teléfono requerido'
        });
      }

      const cliente = await findClienteByTelefono(telefono);
      if (!cliente) {
        return res.status(401).json({
          success: false,
          message: 'Teléfono o contraseña incorrectos'
        });
      }

      const verificado = cliente.portal_pedido_verificado === true;

      if (!verificado) {
        const { numero_pedido: numeroPedidoRaw } = req.body;
        const numeroPedido = numeroPedidoRaw != null ? String(numeroPedidoRaw).trim() : '';
        if (!numeroPedido) {
          return res.status(400).json({
            success: false,
            code: 'PEDIDO_REQUERIDO',
            message:
              'Indica el número de pedido que te enviamos por WhatsApp (por ejemplo PED-…).'
          });
        }

        const numeroLower = numeroPedido.toLowerCase();
        const pedidoMatch = await Pedido.findOne({
          where: {
            fkid_cliente: cliente.id,
            baja_logica: false,
            estado: { [Op.ne]: 'cancelado' },
            [Op.and]: sequelize.where(
              sequelize.fn('LOWER', sequelize.col('numero_pedido')),
              numeroLower
            )
          }
        });

        if (!pedidoMatch) {
          const pedidosCount = await Pedido.count({
            where: {
              fkid_cliente: cliente.id,
              baja_logica: false,
              estado: { [Op.ne]: 'cancelado' }
            }
          });
          const message =
            pedidosCount === 0
              ? 'No encontramos pedidos activos asociados a tu cuenta. Si compraste por WhatsApp, contacta soporte.'
              : 'El número de pedido no coincide con ninguna de tus compras. Revísalo en el mensaje de WhatsApp.';
          return res.status(403).json({
            success: false,
            code: 'PEDIDO_NO_COINCIDE',
            message
          });
        }

        cliente.portal_pedido_verificado = true;
        await cliente.save();
      } else {
        if (!password || !String(password).trim()) {
          return res.status(400).json({
            success: false,
            message: 'Contraseña requerida'
          });
        }

        let valid = false;
        if (cliente.password_hash) {
          valid = await bcrypt.compare(password, cliente.password_hash);
        } else {
          valid = apellidoMatchesPassword(cliente.nombre_completo, password);
        }

        if (!valid) {
          return res.status(401).json({
            success: false,
            message: 'Teléfono o contraseña incorrectos'
          });
        }
      }

      const mustChangePassword = cliente.must_change_password === true;
      const token = generatePortalToken({
        clienteId: cliente.id,
        mustChangePassword
      });

      res.json({
        success: true,
        data: {
          token,
          mustChangePassword,
          cliente: {
            id: cliente.id,
            nombre_completo: cliente.nombre_completo,
            telefono: cliente.telefono
          }
        }
      });
    } catch (e) {
      next(e);
    }
  }

  async changePassword(req, res, next) {
    try {
      const clienteId = req.clientePortal.clienteId;
      const { currentPassword, newPassword } = req.body;

      if (!newPassword || String(newPassword).length < 6) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña debe tener al menos 6 caracteres'
        });
      }

      const cliente = await Cliente.unscoped().findByPk(clienteId);
      if (!cliente || !cliente.isActive) {
        return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
      }

      let currentOk = false;
      if (cliente.password_hash) {
        currentOk = currentPassword && (await bcrypt.compare(currentPassword, cliente.password_hash));
      } else if (currentPassword && String(currentPassword).trim()) {
        currentOk = apellidoMatchesPassword(cliente.nombre_completo, currentPassword);
      } else {
        currentOk = !cliente.password_hash && cliente.must_change_password === true;
      }

      if (!currentOk) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña actual no es correcta'
        });
      }

      const hash = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);
      cliente.password_hash = hash;
      cliente.must_change_password = false;
      await cliente.save();

      const token = generatePortalToken({
        clienteId: cliente.id,
        mustChangePassword: false
      });

      res.json({
        success: true,
        message: 'Contraseña actualizada',
        data: {
          token,
          mustChangePassword: false,
          cliente: {
            id: cliente.id,
            nombre_completo: cliente.nombre_completo,
            telefono: cliente.telefono
          }
        }
      });
    } catch (e) {
      next(e);
    }
  }

  async me(req, res, next) {
    try {
      const cliente = await Cliente.findByPk(req.clientePortal.clienteId, {
        attributes: [
          'id',
          'nombre_completo',
          'telefono',
          'email',
          'puntos_lealtad',
          'must_change_password',
          'direccion_entrega',
          'fkid_ciudad'
        ],
        include: [{ model: City, as: 'ciudad', attributes: ['id', 'nombre'] }]
      });
      if (!cliente || !cliente.isActive) {
        return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
      }

      res.json({
        success: true,
        data: {
          cliente: {
            id: cliente.id,
            nombre_completo: cliente.nombre_completo,
            telefono: cliente.telefono,
            email: cliente.email,
            puntos_lealtad: cliente.puntos_lealtad,
            must_change_password: cliente.must_change_password,
            direccion_entrega: cliente.direccion_entrega,
            ciudad: cliente.ciudad
          }
        }
      });
    } catch (e) {
      next(e);
    }
  }

  async listPedidos(req, res, next) {
    try {
      const clienteId = req.clientePortal.clienteId;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const offset = (page - 1) * limit;

      const { count, rows } = await Pedido.findAndCountAll({
        where: { fkid_cliente: clienteId },
        attributes: [
          'id',
          'numero_pedido',
          'estado',
          'fecha_pedido',
          'fecha_entrega_estimada',
          'fecha_entrega_real',
          'total',
          'subtotal',
          'direccion_entrega',
          'metodo_pago'
        ],
        order: [['fecha_pedido', 'DESC']],
        limit,
        offset
      });

      res.json({
        success: true,
        data: {
          pedidos: rows,
          pagination: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit)
          }
        }
      });
    } catch (e) {
      next(e);
    }
  }

  async listMovimientosPuntos(req, res, next) {
    try {
      const clienteId = req.clientePortal.clienteId;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const offset = (page - 1) * limit;

      const { count, rows } = await ClientePuntosMovimiento.findAndCountAll({
        where: { fkid_cliente: clienteId },
        order: [['created_at', 'DESC']],
        limit,
        offset
      });

      res.json({
        success: true,
        data: {
          movimientos: rows,
          pagination: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit)
          }
        }
      });
    } catch (e) {
      next(e);
    }
  }

  async resumenPuntos(req, res, next) {
    try {
      const clienteId = req.clientePortal.clienteId;
      const resumen = await resumenDesdeLedger(clienteId);
      if (!resumen) {
        return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
      }
      res.json({ success: true, data: resumen });
    } catch (e) {
      next(e);
    }
  }
}

module.exports = new PortalController();
