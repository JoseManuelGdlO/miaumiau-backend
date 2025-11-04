const { Notificacion, Sequelize } = require('../../models');
const { Op } = require('sequelize');

class NotificacionController {
  // Obtener todas las notificaciones
  async getAllNotificaciones(req, res, next) {
    try {
      const { 
        prioridad,
        leida,
        fecha_inicio,
        fecha_fin,
        search,
        page = 1,
        limit = 10
      } = req.query;
      
      let whereClause = {};
      
      // Filtrar por prioridad
      if (prioridad) {
        whereClause.prioridad = prioridad;
      }
      
      // Filtrar por leída
      if (leida !== undefined) {
        whereClause.leida = leida === 'true' || leida === true;
      }
      
      // Filtrar por rango de fechas
      if (fecha_inicio && fecha_fin) {
        whereClause.fecha_creacion = {
          [Op.between]: [fecha_inicio, fecha_fin]
        };
      } else if (fecha_inicio) {
        whereClause.fecha_creacion = {
          [Op.gte]: fecha_inicio
        };
      } else if (fecha_fin) {
        whereClause.fecha_creacion = {
          [Op.lte]: fecha_fin
        };
      }

      // Búsqueda por nombre o descripción
      if (search) {
        whereClause[Op.or] = [
          { nombre: { [Op.like]: `%${search}%` } },
          { descripcion: { [Op.like]: `%${search}%` } }
        ];
      }

      const offset = (page - 1) * limit;

      const { count, rows: notificaciones } = await Notificacion.findAndCountAll({
        where: whereClause,
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.status(200).json({
        success: true,
        data: notificaciones,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener notificación por ID
  async getNotificacionById(req, res, next) {
    try {
      const { id } = req.params;

      const notificacion = await Notificacion.findByPk(id);

      if (!notificacion) {
        return res.status(404).json({
          success: false,
          message: 'Notificación no encontrada'
        });
      }

      res.status(200).json({
        success: true,
        data: notificacion
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nueva notificación
  async createNotificacion(req, res, next) {
    try {
      const { nombre, descripcion, prioridad, datos } = req.body;

      const notificacion = await Notificacion.create({
        nombre,
        descripcion,
        prioridad: prioridad || 'media',
        leida: false,
        datos: datos || null
      });

      res.status(201).json({
        success: true,
        message: 'Notificación creada exitosamente',
        data: notificacion
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar notificación
  async updateNotificacion(req, res, next) {
    try {
      const { id } = req.params;
      const { nombre, descripcion, prioridad, datos, leida } = req.body;

      const notificacion = await Notificacion.findByPk(id);

      if (!notificacion) {
        return res.status(404).json({
          success: false,
          message: 'Notificación no encontrada'
        });
      }

      // Actualizar campos permitidos
      if (nombre !== undefined) notificacion.nombre = nombre;
      if (descripcion !== undefined) notificacion.descripcion = descripcion;
      if (prioridad !== undefined) notificacion.prioridad = prioridad;
      if (datos !== undefined) notificacion.datos = datos;
      if (leida !== undefined) notificacion.leida = leida;

      await notificacion.save();

      res.status(200).json({
        success: true,
        message: 'Notificación actualizada exitosamente',
        data: notificacion
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar notificación
  async deleteNotificacion(req, res, next) {
    try {
      const { id } = req.params;

      const notificacion = await Notificacion.findByPk(id);

      if (!notificacion) {
        return res.status(404).json({
          success: false,
          message: 'Notificación no encontrada'
        });
      }

      await notificacion.destroy();

      res.status(200).json({
        success: true,
        message: 'Notificación eliminada exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Marcar notificación como leída
  async marcarComoLeida(req, res, next) {
    try {
      const { id } = req.params;

      const notificacion = await Notificacion.findByPk(id);

      if (!notificacion) {
        return res.status(404).json({
          success: false,
          message: 'Notificación no encontrada'
        });
      }

      await notificacion.marcarComoLeida();

      res.status(200).json({
        success: true,
        message: 'Notificación marcada como leída',
        data: notificacion
      });
    } catch (error) {
      next(error);
    }
  }

  // Marcar notificación como no leída
  async marcarComoNoLeida(req, res, next) {
    try {
      const { id } = req.params;

      const notificacion = await Notificacion.findByPk(id);

      if (!notificacion) {
        return res.status(404).json({
          success: false,
          message: 'Notificación no encontrada'
        });
      }

      await notificacion.marcarComoNoLeida();

      res.status(200).json({
        success: true,
        message: 'Notificación marcada como no leída',
        data: notificacion
      });
    } catch (error) {
      next(error);
    }
  }

  // Marcar todas como leídas
  async marcarTodasComoLeidas(req, res, next) {
    try {
      await Notificacion.update(
        { leida: true },
        { where: { leida: false } }
      );

      res.status(200).json({
        success: true,
        message: 'Todas las notificaciones fueron marcadas como leídas'
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener notificaciones por prioridad
  async getNotificacionesByPrioridad(req, res, next) {
    try {
      const { prioridad } = req.params;

      const notificaciones = await Notificacion.findByPrioridad(prioridad);

      res.status(200).json({
        success: true,
        data: notificaciones
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener notificaciones leídas
  async getNotificacionesLeidas(req, res, next) {
    try {
      const notificaciones = await Notificacion.findLeidas();

      res.status(200).json({
        success: true,
        data: notificaciones
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener notificaciones no leídas
  async getNotificacionesNoLeidas(req, res, next) {
    try {
      const notificaciones = await Notificacion.findNoLeidas();

      res.status(200).json({
        success: true,
        data: notificaciones,
        count: notificaciones.length
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener notificaciones urgentes
  async getNotificacionesUrgentes(req, res, next) {
    try {
      const notificaciones = await Notificacion.findUrgentes();

      res.status(200).json({
        success: true,
        data: notificaciones,
        count: notificaciones.length
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener notificaciones por fecha
  async getNotificacionesByFecha(req, res, next) {
    try {
      const { fecha } = req.params;

      const notificaciones = await Notificacion.findByFecha(fecha);

      res.status(200).json({
        success: true,
        data: notificaciones
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener notificaciones recientes
  async getNotificacionesRecientes(req, res, next) {
    try {
      const { limit = 10 } = req.query;

      const notificaciones = await Notificacion.getRecent(parseInt(limit));

      res.status(200).json({
        success: true,
        data: notificaciones
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener estadísticas de notificaciones
  async getStats(req, res, next) {
    try {
      const stats = await Notificacion.getStats();

      // Obtener estadísticas adicionales
      const total = await Notificacion.count();
      const leidas = await Notificacion.count({ where: { leida: true } });
      const noLeidas = await Notificacion.count({ where: { leida: false } });
      
      const porPrioridad = await Notificacion.findAll({
        attributes: [
          'prioridad',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'total']
        ],
        group: ['prioridad'],
        raw: true
      });

      res.status(200).json({
        success: true,
        data: {
          total,
          leidas,
          noLeidas,
          porPrioridad
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificacionController();

