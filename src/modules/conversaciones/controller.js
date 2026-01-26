const { Conversacion, Cliente, ConversacionChat, ConversacionLog, Pedido, ProductoPedido, Inventario, WhatsAppPhoneNumber, ConversacionFlag, ConversacionFlagAsignacion } = require('../../models');
const { Op } = require('sequelize');
const { Sequelize } = require('sequelize');

const normalizePhone = (value) => {
  if (!value) return null;
  const normalized = String(value).replace(/\D/g, '');
  return normalized || null;
};

const extractPhone = (value) => {
  if (!value) return null;
  const match = String(value).match(/\+?\d+/);
  return match ? match[0] : null;
};

const resolvePhoneNumberId = async (rawPhone) => {
  const normalized = normalizePhone(rawPhone);
  if (!normalized) return null;
  const mapping = await WhatsAppPhoneNumber.findOne({
    where: { telefono: normalized }
  });
  return mapping?.phoneid || "990229367500305";
};

// Función helper para buscar cliente por teléfono
const findClienteByTelefono = async (telefonoRaw) => {
  if (!telefonoRaw) return null;
  
  // Normalizar el teléfono (extraer solo números)
  const telefonoNormalizado = normalizePhone(telefonoRaw);
  if (!telefonoNormalizado) return null;
  
  // Buscar cliente por teléfono normalizado
  const cliente = await Cliente.findOne({
    where: { 
      telefono: telefonoNormalizado,
      isActive: true // Solo clientes activos
    }
  });
  
  return cliente;
};

class ConversacionController {
  // Obtener todas las conversaciones
  async getAllConversaciones(req, res, next) {
    try {
      const { 
        status,
        tipo_usuario,
        id_cliente,
        from,
        activos = 'true',
        search,
        start_date,
        end_date,
        flags,
        page = 1,
        limit = 10
      } = req.query;
      
      let whereClause = {};
      
      // Filtrar por activos/inactivos
      if (activos === 'true') {
        whereClause.baja_logica = false;
      } else if (activos === 'false') {
        whereClause.baja_logica = true;
      }
      
      // Filtrar por status
      if (status) {
        whereClause.status = status;
      }
      
      // Filtrar por tipo de usuario
      if (tipo_usuario) {
        whereClause.tipo_usuario = tipo_usuario;
      }
      
      // Filtrar por cliente
      if (id_cliente) {
        whereClause.id_cliente = id_cliente;
      }

      // Filtrar por rango de fechas
      if (start_date && end_date) {
        whereClause.created_at = {
          [Op.between]: [new Date(start_date), new Date(end_date)]
        };
      }

      // Búsqueda mejorada: buscar en múltiples campos
      let searchConditions = [];
      let searchConversacionIds = null;
      
      if (search) {
        const searchTerm = search.trim();
        
        // Si es un número, buscar por ID de conversación
        if (/^\d+$/.test(searchTerm)) {
          const searchId = parseInt(searchTerm);
          searchConditions.push({
            id: searchId
          });
          
          // También buscar en teléfonos (from)
          const normalizedSearch = normalizePhone(searchTerm);
          if (normalizedSearch) {
            searchConditions.push({
              from: {
                [Op.iLike]: `%${normalizedSearch}%`
              }
            });
          }
        } else {
          // Es texto, buscar en from
          searchConditions.push({
            from: {
              [Op.iLike]: `%${searchTerm}%`
            }
          });
        }
        
        // Buscar conversaciones por cliente (nombre o teléfono)
        const normalizedSearch = normalizePhone(searchTerm);
        const clienteSearchConditions = [];
        
        if (!/^\d+$/.test(searchTerm)) {
          // Buscar por nombre del cliente
          clienteSearchConditions.push({
            nombre_completo: {
              [Op.iLike]: `%${searchTerm}%`
            }
          });
        }
        
        // Buscar por teléfono del cliente (siempre, incluso si es número)
        if (normalizedSearch) {
          clienteSearchConditions.push({
            telefono: {
              [Op.iLike]: `%${normalizedSearch}%`
            }
          });
        }
        
        // Si hay condiciones de búsqueda en cliente, buscar IDs de conversaciones
        if (clienteSearchConditions.length > 0) {
          const clientes = await Cliente.findAll({
            where: {
              [Op.or]: clienteSearchConditions
            },
            attributes: ['id']
          });
          
          if (clientes.length > 0) {
            const clienteIds = clientes.map(c => c.id);
            searchConditions.push({
              id_cliente: {
                [Op.in]: clienteIds
              }
            });
          }
        }
        
        // Buscar conversaciones por mensajes que contengan el término
        const chats = await ConversacionChat.findAll({
          where: {
            mensaje: {
              [Op.iLike]: `%${searchTerm}%`
            }
          },
          attributes: ['fkid_conversacion'],
          raw: true
        });
        
        if (chats.length > 0) {
          // Obtener IDs únicos de conversaciones
          const conversacionIdsFromChats = [...new Set(chats.map(c => c.fkid_conversacion).filter(id => id))];
          if (conversacionIdsFromChats.length > 0) {
            searchConditions.push({
              id: {
                [Op.in]: conversacionIdsFromChats
              }
            });
          }
        }
      }

      const offset = (page - 1) * limit;

      // Construir includes
      const clienteInclude = {
        model: Cliente,
        as: 'cliente',
        attributes: ['id', 'nombre_completo', 'email', 'telefono'],
        required: false
      };

      // Construir includes
      const includes = [
        clienteInclude,
        {
          model: Pedido,
          as: 'pedido',
          attributes: ['id', 'numero_pedido', 'estado', 'total', 'fecha_pedido'],
          required: false
        },
        {
          model: ConversacionChat,
          as: 'chats',
          attributes: ['id', 'fecha', 'hora', 'from', 'mensaje', 'tipo_mensaje', 'leido', 'created_at'],
          limit: 1,
          separate: true,
          order: [['created_at', 'DESC']]
        },
        {
          model: ConversacionLog,
          as: 'logs',
          attributes: ['id', 'fecha', 'hora', 'tipo_log', 'nivel', 'descripcion', 'created_at'],
          limit: 1,
          separate: true,
          order: [['created_at', 'DESC']]
        },
        {
          model: ConversacionFlag,
          as: 'flags',
          attributes: ['id', 'nombre', 'color', 'descripcion', 'activo'],
          through: { attributes: [] },
          required: false
        }
      ];

      // Filtrar por flags si se proporciona
      let flagFilter = null;
      if (flags) {
        const flagIds = Array.isArray(flags) ? flags : flags.split(',').map(id => parseInt(id.trim()));
        flagFilter = {
          model: ConversacionFlag,
          as: 'flags',
          where: {
            id: {
              [Op.in]: flagIds
            }
          },
          required: true
        };
        // Reemplazar el include de flags con el filtrado
        includes[includes.length - 1] = flagFilter;
      }

      // Si hay condiciones de búsqueda, usar Op.or para combinarlas
      if (searchConditions.length > 0) {
        // Si ya hay otras condiciones en whereClause, necesitamos combinarlas
        if (Object.keys(whereClause).length > 0 && !whereClause[Op.or]) {
          const existingConditions = { ...whereClause };
          whereClause = {
            [Op.and]: [
              existingConditions,
              {
                [Op.or]: searchConditions
              }
            ]
          };
        } else {
          whereClause[Op.or] = searchConditions;
        }
      }

      const { count, rows: conversaciones } = await Conversacion.findAndCountAll({
        where: whereClause,
        include: includes,
        distinct: true,
        order: [['updated_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          conversaciones,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener una conversación por ID
  async getConversacionById(req, res, next) {
    try {
      const { id } = req.params;
      
      const conversacion = await Conversacion.findByPk(id, {
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre_completo', 'email', 'telefono'],
            required: false
          },
          {
            model: Pedido,
            as: 'pedido',
            required: false,
            include: [
              {
                model: ProductoPedido,
                as: 'productos',
                required: false,
                include: [
                  {
                    model: Inventario,
                    as: 'producto',
                    required: false
                  }
                ]
              }
            ]
          },
          {
            model: ConversacionChat,
            as: 'chats',
            attributes: ['id', 'fecha', 'hora', 'from', 'mensaje', 'tipo_mensaje', 'leido', 'created_at'],
            order: [['created_at', 'ASC']],
            required: false
          },
          {
            model: ConversacionLog,
            as: 'logs',
            attributes: ['id', 'fecha', 'hora', 'tipo_log', 'nivel', 'descripcion', 'created_at'],
            order: [['created_at', 'ASC']],
            required: false
          },
          {
            model: ConversacionFlag,
            as: 'flags',
            attributes: ['id', 'nombre', 'color', 'descripcion', 'activo'],
            through: { attributes: [] },
            required: false
          }
        ]
      });
      
      if (!conversacion) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada'
        });
      }

      res.json({
        success: true,
        data: { conversacion }
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nueva conversación
  async createConversacion(req, res, next) {
    try {
      const {
        from,
        status = 'activa',
        id_cliente,
        tipo_usuario = 'cliente'
      } = req.body;

      // Normalizar id_cliente: si viene 0 o '0', tratar como null
      let clienteIdNormalizado = (id_cliente === 0 || id_cliente === '0') ? null : id_cliente;

      let cliente = null;
      // Verificar que el cliente existe si se proporciona
      if (clienteIdNormalizado) {
        cliente = await Cliente.findByPk(clienteIdNormalizado);
        if (!cliente) {
          return res.status(400).json({
            success: false,
            message: 'El cliente especificado no existe'
          });
        }
      } else {
        // Si no se proporciona id_cliente, buscar por teléfono en el campo 'from'
        const telefonoFrom = extractPhone(from);
        if (telefonoFrom) {
          cliente = await findClienteByTelefono(telefonoFrom);
          if (cliente) {
            clienteIdNormalizado = cliente.id;
          }
        }
      }

      const telefonoOrigen = extractPhone(cliente?.telefono || from);
      const whatsapp_phone_number_id = await resolvePhoneNumberId(telefonoOrigen);

      const conversacion = await Conversacion.create({
        from,
        status,
        id_cliente: clienteIdNormalizado,
        tipo_usuario,
        whatsapp_phone_number_id
      });

      // Crear log de inicio de conversación
      await ConversacionLog.createLog(
        conversacion.id,
        { 
          from: from,
          tipo_usuario: tipo_usuario,
          status_inicial: status
        },
        'inicio',
        'info',
        `Conversación iniciada por ${from}`
      );

      // Obtener la conversación creada con sus relaciones
      const conversacionCompleta = await Conversacion.findByPk(conversacion.id, {
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre_completo', 'email', 'telefono'],
            required: false
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Conversación creada exitosamente',
        data: { conversacion: conversacionCompleta }
      });
    } catch (error) {
      next(error);
    }
  }

  // Buscar o crear conversación (findOrCreate)
  async findOrCreateConversacion(req, res, next) {
    try {
      const {
        from,
        status = 'activa',
        id_cliente,
        tipo_usuario = 'cliente'
      } = req.body;

      // Normalizar id_cliente: si viene 0 o '0', tratar como null
      let clienteIdNormalizado = (id_cliente === 0 || id_cliente === '0') ? null : id_cliente;

      // Validar que from esté presente
      if (!from) {
        return res.status(400).json({
          success: false,
          message: 'El campo "from" es requerido'
        });
      }

      let cliente = null;
      // Verificar que el cliente existe si se proporciona
      if (clienteIdNormalizado) {
        cliente = await Cliente.findByPk(clienteIdNormalizado);
        if (!cliente) {
          return res.status(400).json({
            success: false,
            message: 'El cliente especificado no existe'
          });
        }
      } else {
        // Si no se proporciona id_cliente, buscar por teléfono en el campo 'from'
        const telefonoFrom = extractPhone(from);
        if (telefonoFrom) {
          cliente = await findClienteByTelefono(telefonoFrom);
          if (cliente) {
            clienteIdNormalizado = cliente.id;
          }
        }
      }

      // Buscar conversación existente por 'from' que esté activa o no eliminada
      let conversacion = await Conversacion.findOne({
        where: {
          from: from,
          baja_logica: false
        },
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre_completo', 'email', 'telefono'],
            required: false
          }
        ],
        order: [['created_at', 'DESC']] // Obtener la más reciente
      });

      let fueCreada = false;

      // Si no existe, crear una nueva
      if (!conversacion) {
        const telefonoOrigen = extractPhone(cliente?.telefono || from);
        const whatsapp_phone_number_id = await resolvePhoneNumberId(telefonoOrigen);
        conversacion = await Conversacion.create({
          from,
          status,
          id_cliente: clienteIdNormalizado,
          tipo_usuario,
          whatsapp_phone_number_id
        });

        // Crear log de inicio de conversación
        await ConversacionLog.createLog(
          conversacion.id,
          { 
            from: from,
            tipo_usuario: tipo_usuario,
            status_inicial: status
          },
          'inicio',
          'info',
          `Conversación iniciada por ${from}`
        );

        // Obtener la conversación creada con sus relaciones
        conversacion = await Conversacion.findByPk(conversacion.id, {
          include: [
            {
              model: Cliente,
              as: 'cliente',
              attributes: ['id', 'nombre_completo', 'email', 'telefono'],
              required: false
            }
          ]
        });

        fueCreada = true;
      } else {
        // Si la conversación existe pero no tiene cliente asignado y encontramos uno, actualizarla
        if (!conversacion.id_cliente && clienteIdNormalizado) {
          await conversacion.update({ id_cliente: clienteIdNormalizado });
          
          // Crear log de actualización
          await ConversacionLog.createLog(
            conversacion.id,
            { 
              cliente_anterior: null,
              cliente_nuevo: clienteIdNormalizado,
              updated_by: 'sistema'
            },
            'sistema',
            'info',
            `Conversación actualizada con cliente existente: ${cliente?.nombre_completo || clienteIdNormalizado}`
          );
          
          // Recargar la conversación con el cliente actualizado
          conversacion = await Conversacion.findByPk(conversacion.id, {
            include: [
              {
                model: Cliente,
                as: 'cliente',
                attributes: ['id', 'nombre_completo', 'email', 'telefono'],
                required: false
              }
            ]
          });
        }
        
        // Actualizar whatsapp_phone_number_id si no existe
        if (!conversacion.whatsapp_phone_number_id) {
          const telefonoOrigen = extractPhone(cliente?.telefono || conversacion?.from);
          const whatsapp_phone_number_id = await resolvePhoneNumberId(telefonoOrigen);
          if (whatsapp_phone_number_id) {
            await conversacion.update({ whatsapp_phone_number_id });
          }
        }
      }

      res.status(fueCreada ? 201 : 200).json({
        success: true,
        message: fueCreada 
          ? 'Conversación creada exitosamente' 
          : 'Conversación encontrada',
        data: { 
          conversacion: conversacion,
          fueCreada: fueCreada
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar conversación
  async updateConversacion(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const conversacion = await Conversacion.findByPk(id);
      
      if (!conversacion) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada'
        });
      }

      // Verificar que el cliente existe si se está actualizando
      if (updateData.id_cliente) {
        const cliente = await Cliente.findByPk(updateData.id_cliente);
        if (!cliente) {
          return res.status(400).json({
            success: false,
            message: 'El cliente especificado no existe'
          });
        }
      }

      // Guardar el status anterior para el log
      const statusAnterior = conversacion.status;

      await conversacion.update(updateData);

      // Crear log si cambió el status
      if (updateData.status && updateData.status !== statusAnterior) {
        await ConversacionLog.createLog(
          conversacion.id,
          { 
            status_anterior: statusAnterior,
            status_nuevo: updateData.status,
            updated_by: req.user?.id || 'sistema'
          },
          'sistema',
          'info',
          `Status cambiado de ${statusAnterior} a ${updateData.status}`
        );
      }

      // Obtener la conversación actualizada con sus relaciones
      const conversacionActualizada = await Conversacion.findByPk(id, {
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre_completo', 'email', 'telefono'],
            required: false
          }
        ]
      });

      res.json({
        success: true,
        message: 'Conversación actualizada exitosamente',
        data: { conversacion: conversacionActualizada }
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar conversación (baja lógica)
  async deleteConversacion(req, res, next) {
    try {
      const { id } = req.params;

      const conversacion = await Conversacion.findByPk(id);
      
      if (!conversacion) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada'
        });
      }

      await conversacion.softDelete();

      // Crear log de eliminación
      await ConversacionLog.createLog(
        conversacion.id,
        { 
          deleted_by: req.user?.id || 'sistema',
          deleted_at: new Date()
        },
        'sistema',
        'info',
        'Conversación eliminada (baja lógica)'
      );

      res.json({
        success: true,
        message: 'Conversación eliminada exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restaurar conversación
  async restoreConversacion(req, res, next) {
    try {
      const { id } = req.params;

      const conversacion = await Conversacion.findByPk(id);
      
      if (!conversacion) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada'
        });
      }

      await conversacion.restore();

      // Crear log de restauración
      await ConversacionLog.createLog(
        conversacion.id,
        { 
          restored_by: req.user?.id || 'sistema',
          restored_at: new Date()
        },
        'sistema',
        'info',
        'Conversación restaurada'
      );

      res.json({
        success: true,
        message: 'Conversación restaurada exitosamente',
        data: { conversacion }
      });
    } catch (error) {
      next(error);
    }
  }

  // Cambiar status de conversación
  async changeStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const conversacion = await Conversacion.findByPk(id);
      
      if (!conversacion) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada'
        });
      }

      const statusAnterior = conversacion.status;
      conversacion.status = status;
      await conversacion.save();

      // Crear log del cambio de status
      await ConversacionLog.createLog(
        conversacion.id,
        { 
          status_anterior: statusAnterior,
          status_nuevo: status,
          changed_by: req.user?.id || 'sistema'
        },
        'sistema',
        'info',
        `Status cambiado de ${statusAnterior} a ${status}`
      );

      res.json({
        success: true,
        message: `Status cambiado a ${status} exitosamente`,
        data: { conversacion }
      });
    } catch (error) {
      next(error);
    }
  }

  // Asignar conversación a cliente
  async assignToClient(req, res, next) {
    try {
      const { id } = req.params;
      const { id_cliente } = req.body;

      const conversacion = await Conversacion.findByPk(id);
      
      if (!conversacion) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada'
        });
      }

      // Verificar que el cliente existe
      const cliente = await Cliente.findByPk(id_cliente);
      if (!cliente) {
        return res.status(400).json({
          success: false,
          message: 'El cliente especificado no existe'
        });
      }

      const clienteAnterior = conversacion.id_cliente;
      await conversacion.assignToClient(id_cliente);

      // Crear log de asignación
      await ConversacionLog.createLog(
        conversacion.id,
        { 
          cliente_anterior: clienteAnterior,
          cliente_nuevo: id_cliente,
          assigned_by: req.user?.id || 'sistema'
        },
        'transferencia',
        'info',
        `Conversación asignada al cliente ${cliente.nombre_completo}`
      );

      res.json({
        success: true,
        message: 'Conversación asignada exitosamente',
        data: { conversacion }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener conversaciones por status
  async getConversacionesByStatus(req, res, next) {
    try {
      const { status } = req.params;

      const conversaciones = await Conversacion.findByStatus(status);

      res.json({
        success: true,
        data: {
          conversaciones,
          total: conversaciones.length,
          status
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener conversaciones por cliente
  async getConversacionesByClient(req, res, next) {
    try {
      const { clientId } = req.params;

      const conversaciones = await Conversacion.findByClient(clientId);

      res.json({
        success: true,
        data: {
          conversaciones,
          total: conversaciones.length,
          clientId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener conversaciones activas
  async getActiveConversaciones(req, res, next) {
    try {
      const conversaciones = await Conversacion.findActive();

      res.json({
        success: true,
        data: {
          conversaciones,
          total: conversaciones.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Buscar conversaciones
  async searchConversaciones(req, res, next) {
    try {
      const { search } = req.query;

      if (!search) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el parámetro de búsqueda'
        });
      }

      const conversaciones = await Conversacion.findByFrom(search);

      res.json({
        success: true,
        data: {
          conversaciones,
          total: conversaciones.length,
          searchTerm: search
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Estadísticas de conversaciones
  async getConversacionStats(req, res, next) {
    try {
      const totalConversaciones = await Conversacion.count({
        where: { baja_logica: false }
      });

      const conversacionesActivas = await Conversacion.count({
        where: { 
          status: 'activa',
          baja_logica: false
        }
      });

      const conversacionesCerradas = await Conversacion.count({
        where: { 
          status: 'cerrada',
          baja_logica: false
        }
      });

      const conversacionesPausadas = await Conversacion.count({
        where: { 
          status: 'pausada',
          baja_logica: false
        }
      });

      const conversacionesEnEspera = await Conversacion.count({
        where: { 
          status: 'en_espera',
          baja_logica: false
        }
      });

      const conversacionesPorTipo = await Conversacion.getConversationsByUserType();

      res.json({
        success: true,
        data: {
          totalConversaciones,
          conversacionesActivas,
          conversacionesCerradas,
          conversacionesPausadas,
          conversacionesEnEspera,
          conversacionesPorTipo
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ConversacionController();
