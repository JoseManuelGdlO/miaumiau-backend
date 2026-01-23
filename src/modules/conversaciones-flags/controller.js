const { ConversacionFlag, ConversacionFlagAsignacion, Conversacion } = require('../../models');
const { Op } = require('sequelize');

class ConversacionFlagController {
  // Obtener todos los flags
  async getAllFlags(req, res, next) {
    try {
      const {
        activos = 'true',
        activo = null,
        search,
        page = 1,
        limit = 50
      } = req.query;

      let whereClause = {
        baja_logica: false
      };

      // Filtrar por activos
      if (activos === 'true' || activo === 'true') {
        whereClause.activo = true;
      } else if (activos === 'false' || activo === 'false') {
        whereClause.activo = false;
      }

      // Búsqueda por nombre o descripción
      if (search) {
        whereClause[Op.or] = [
          { nombre: { [Op.iLike]: `%${search}%` } },
          { descripcion: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const offset = (page - 1) * limit;

      const { count, rows: flags } = await ConversacionFlag.findAndCountAll({
        where: whereClause,
        order: [['nombre', 'ASC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          flags,
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

  // Obtener flag por ID
  async getFlagById(req, res, next) {
    try {
      const { id } = req.params;

      const flag = await ConversacionFlag.findByPk(id, {
        where: { baja_logica: false }
      });

      if (!flag) {
        return res.status(404).json({
          success: false,
          message: 'Flag no encontrado'
        });
      }

      res.json({
        success: true,
        data: { flag }
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nuevo flag
  async createFlag(req, res, next) {
    try {
      const { nombre, color, descripcion, activo = true } = req.body;

      // Validar color hex si se proporciona
      if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
        return res.status(400).json({
          success: false,
          message: 'El color debe ser un código hexadecimal válido (ej: #3B82F6)'
        });
      }

      const flag = await ConversacionFlag.create({
        nombre,
        color: color || '#3B82F6',
        descripcion,
        activo
      });

      res.status(201).json({
        success: true,
        message: 'Flag creado exitosamente',
        data: { flag }
      });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un flag con ese nombre'
        });
      }
      next(error);
    }
  }

  // Actualizar flag
  async updateFlag(req, res, next) {
    try {
      const { id } = req.params;
      const { nombre, color, descripcion, activo } = req.body;

      const flag = await ConversacionFlag.findByPk(id, {
        where: { baja_logica: false }
      });

      if (!flag) {
        return res.status(404).json({
          success: false,
          message: 'Flag no encontrado'
        });
      }

      // Validar color hex si se proporciona
      if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
        return res.status(400).json({
          success: false,
          message: 'El color debe ser un código hexadecimal válido (ej: #3B82F6)'
        });
      }

      if (nombre !== undefined) flag.nombre = nombre;
      if (color !== undefined) flag.color = color;
      if (descripcion !== undefined) flag.descripcion = descripcion;
      if (activo !== undefined) flag.activo = activo;

      await flag.save();

      res.json({
        success: true,
        message: 'Flag actualizado exitosamente',
        data: { flag }
      });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un flag con ese nombre'
        });
      }
      next(error);
    }
  }

  // Eliminar flag (soft delete)
  async deleteFlag(req, res, next) {
    try {
      const { id } = req.params;

      const flag = await ConversacionFlag.findByPk(id, {
        where: { baja_logica: false }
      });

      if (!flag) {
        return res.status(404).json({
          success: false,
          message: 'Flag no encontrado'
        });
      }

      // Eliminar todas las asignaciones de este flag antes de eliminarlo
      await ConversacionFlagAsignacion.destroy({
        where: {
          fkid_flag: id
        }
      });

      await flag.softDelete();

      res.json({
        success: true,
        message: 'Flag eliminado exitosamente. Todas las asignaciones han sido removidas.'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restaurar flag
  async restoreFlag(req, res, next) {
    try {
      const { id } = req.params;

      const flag = await ConversacionFlag.findByPk(id);

      if (!flag) {
        return res.status(404).json({
          success: false,
          message: 'Flag no encontrado'
        });
      }

      await flag.restore();

      res.json({
        success: true,
        message: 'Flag restaurado exitosamente',
        data: { flag }
      });
    } catch (error) {
      next(error);
    }
  }

  // Asignar flag a conversación
  async assignFlagToConversation(req, res, next) {
    try {
      const { id: flagId, conversacionId } = req.params;

      // Verificar que el flag existe
      const flag = await ConversacionFlag.findByPk(flagId, {
        where: { baja_logica: false }
      });

      if (!flag) {
        return res.status(404).json({
          success: false,
          message: 'Flag no encontrado'
        });
      }

      // Verificar que la conversación existe
      const conversacion = await Conversacion.findByPk(conversacionId, {
        where: { baja_logica: false }
      });

      if (!conversacion) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada'
        });
      }

      // Verificar si ya está asignado
      const existing = await ConversacionFlagAsignacion.findByConversacionAndFlag(
        conversacionId,
        flagId
      );

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'El flag ya está asignado a esta conversación'
        });
      }

      // Crear asignación
      const asignacion = await ConversacionFlagAsignacion.create({
        fkid_conversacion: conversacionId,
        fkid_flag: flagId
      });

      res.status(201).json({
        success: true,
        message: 'Flag asignado exitosamente',
        data: { asignacion }
      });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
          success: false,
          message: 'El flag ya está asignado a esta conversación'
        });
      }
      next(error);
    }
  }

  // Remover flag de conversación
  async removeFlagFromConversation(req, res, next) {
    try {
      const { id: flagId, conversacionId } = req.params;

      const asignacion = await ConversacionFlagAsignacion.findByConversacionAndFlag(
        conversacionId,
        flagId
      );

      if (!asignacion) {
        return res.status(404).json({
          success: false,
          message: 'El flag no está asignado a esta conversación'
        });
      }

      await asignacion.destroy();

      res.json({
        success: true,
        message: 'Flag removido exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener flags de una conversación
  async getConversationFlags(req, res, next) {
    try {
      const { id: conversacionId } = req.params;

      const conversacion = await Conversacion.findByPk(conversacionId, {
        where: { baja_logica: false }
      });

      if (!conversacion) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada'
        });
      }

      const asignaciones = await ConversacionFlagAsignacion.findByConversacion(conversacionId);

      const flagIds = asignaciones.map(a => a.fkid_flag);
      // Incluir todos los flags asignados, incluso los eliminados, para poder removerlos
      const flags = await ConversacionFlag.findAll({
        where: {
          id: flagIds
        },
        order: [['nombre', 'ASC']]
      });

      res.json({
        success: true,
        data: { flags }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ConversacionFlagController();
