const { ConversacionLog, Conversacion } = require('../../models');
const { Op } = require('sequelize');

const { Logger } = require('../../utils/logger');

const logger = new Logger('ConversacionesLogs');

class ConversacionLogController {
  // Obtener todos los logs
  async getAllLogs(req, res, next) {
    try {
      const { 
        fkid_conversacion,
        tipo_log,
        nivel,
        activos = 'true',
        search_key,
        search_value,
        start_date,
        end_date,
        page = 1,
        limit = 20
      } = req.query;
      
      let whereClause = {};
      
      // Filtrar por activos/inactivos
      if (activos === 'true') {
        whereClause.baja_logica = false;
      } else if (activos === 'false') {
        whereClause.baja_logica = true;
      }
      
      // Filtrar por conversación
      if (fkid_conversacion) {
        whereClause.fkid_conversacion = fkid_conversacion;
      }
      
      // Filtrar por tipo de log
      if (tipo_log) {
        whereClause.tipo_log = tipo_log;
      }
      
      // Filtrar por nivel
      if (nivel) {
        whereClause.nivel = nivel;
      }

      // Filtrar por rango de fechas
      if (start_date && end_date) {
        whereClause.fecha = {
          [Op.between]: [start_date, end_date]
        };
      }

      // Búsqueda en data JSON
      if (search_key && search_value) {
        whereClause[`data.${search_key}`] = search_value;
      }

      const offset = (page - 1) * limit;

      const { count, rows: logs } = await ConversacionLog.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Conversacion,
            as: 'conversacion',
            attributes: ['id', 'from', 'status', 'tipo_usuario'],
            required: false
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      logger.error('getAllLogs falló', { message: error.message });
      next(error);
    }
  }

  // Obtener un log por ID
  async getLogById(req, res, next) {
    try {
      const { id } = req.params;
      
      const log = await ConversacionLog.findByPk(id, {
        include: [
          {
            model: Conversacion,
            as: 'conversacion',
            attributes: ['id', 'from', 'status', 'tipo_usuario'],
            required: false
          }
        ]
      });
      
      if (!log) {
        return res.status(404).json({
          success: false,
          message: 'Log no encontrado'
        });
      }

      res.json({
        success: true,
        data: { log }
      });
    } catch (error) {
      logger.error('getLogById falló', { message: error.message });
      next(error);
    }
  }

  // Crear nuevo log
  async createLog(req, res, next) {
    try {
      const {
        fkid_conversacion,
        data,
        tipo_log = 'sistema',
        nivel = 'info',
        descripcion = null
      } = req.body;

      // Verificar que la conversación existe
      const conversacion = await Conversacion.findByPk(fkid_conversacion);
      if (!conversacion) {
        logger.warn('createLog rechazado', { status: 400, reason: "La conversación especificada no existe" });
        return res.status(400).json({
          success: false,
          message: 'La conversación especificada no existe'
        });
      }

      const log = await ConversacionLog.createLog(
        fkid_conversacion,
        data,
        tipo_log,
        nivel,
        descripcion
      );

      // Obtener el log creado con sus relaciones
      const logCompleto = await ConversacionLog.findByPk(log.id, {
        include: [
          {
            model: Conversacion,
            as: 'conversacion',
            attributes: ['id', 'from', 'status', 'tipo_usuario'],
            required: false
          }
        ]
      });

      logger.info('createLog', { id: log.id });
      res.status(201).json({
        success: true,
        message: 'Log creado exitosamente',
        data: { log: logCompleto }
      });
    } catch (error) {
      logger.error('createLog falló', { message: error.message });
      next(error);
    }
  }

  // Actualizar log
  async updateLog(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const log = await ConversacionLog.findByPk(id);
      
      if (!log) {
        logger.warn('updateLog rechazado', { status: 404, reason: "Log no encontrado" });
        return res.status(404).json({
          success: false,
          message: 'Log no encontrado'
        });
      }

      await log.update(updateData);

      // Obtener el log actualizado con sus relaciones
      const logActualizado = await ConversacionLog.findByPk(id, {
        include: [
          {
            model: Conversacion,
            as: 'conversacion',
            attributes: ['id', 'from', 'status', 'tipo_usuario'],
            required: false
          }
        ]
      });

      logger.info('updateLog', { id: id });
      res.json({
        success: true,
        message: 'Log actualizado exitosamente',
        data: { log: logActualizado }
      });
    } catch (error) {
      logger.error('updateLog falló', { message: error.message });
      next(error);
    }
  }

  // Eliminar log (baja lógica)
  async deleteLog(req, res, next) {
    try {
      const { id } = req.params;

      const log = await ConversacionLog.findByPk(id);
      
      if (!log) {
        logger.warn('deleteLog rechazado', { status: 404, reason: "Log no encontrado" });
        return res.status(404).json({
          success: false,
          message: 'Log no encontrado'
        });
      }

      await log.softDelete();

      logger.info('deleteLog', { id: id });
      res.json({
        success: true,
        message: 'Log eliminado exitosamente'
      });
    } catch (error) {
      logger.error('deleteLog falló', { message: error.message });
      next(error);
    }
  }

  // Restaurar log
  async restoreLog(req, res, next) {
    try {
      const { id } = req.params;

      const log = await ConversacionLog.findByPk(id);
      
      if (!log) {
        logger.warn('restoreLog rechazado', { status: 404, reason: "Log no encontrado" });
        return res.status(404).json({
          success: false,
          message: 'Log no encontrado'
        });
      }

      await log.restore();

      logger.info('restoreLog', { id: id });
      res.json({
        success: true,
        message: 'Log restaurado exitosamente',
        data: { log }
      });
    } catch (error) {
      logger.error('restoreLog falló', { message: error.message });
      next(error);
    }
  }

  // Obtener logs por conversación
  async getLogsByConversacion(req, res, next) {
    try {
      const { conversacionId } = req.params;

      const logs = await ConversacionLog.findByConversation(conversacionId);

      res.json({
        success: true,
        data: {
          logs,
          total: logs.length,
          conversacionId
        }
      });
    } catch (error) {
      logger.error('getLogsByConversacion falló', { message: error.message });
      next(error);
    }
  }

  // Obtener logs por tipo
  async getLogsByType(req, res, next) {
    try {
      const { tipo } = req.params;

      const logs = await ConversacionLog.findByType(tipo);

      res.json({
        success: true,
        data: {
          logs,
          total: logs.length,
          tipo
        }
      });
    } catch (error) {
      logger.error('getLogsByType falló', { message: error.message });
      next(error);
    }
  }

  // Obtener logs por nivel
  async getLogsByLevel(req, res, next) {
    try {
      const { nivel } = req.params;

      const logs = await ConversacionLog.findByLevel(nivel);

      res.json({
        success: true,
        data: {
          logs,
          total: logs.length,
          nivel
        }
      });
    } catch (error) {
      logger.error('getLogsByLevel falló', { message: error.message });
      next(error);
    }
  }

  // Obtener logs por fecha
  async getLogsByDate(req, res, next) {
    try {
      const { fecha } = req.params;

      const logs = await ConversacionLog.findByDate(fecha);

      res.json({
        success: true,
        data: {
          logs,
          total: logs.length,
          fecha
        }
      });
    } catch (error) {
      logger.error('getLogsByDate falló', { message: error.message });
      next(error);
    }
  }

  // Obtener logs de errores
  async getErrorLogs(req, res, next) {
    try {
      const { conversacionId } = req.query;

      const logs = await ConversacionLog.findErrors(conversacionId);

      res.json({
        success: true,
        data: {
          logs,
          total: logs.length
        }
      });
    } catch (error) {
      logger.error('getErrorLogs falló', { message: error.message });
      next(error);
    }
  }

  // Obtener logs de advertencias
  async getWarningLogs(req, res, next) {
    try {
      const { conversacionId } = req.query;

      const logs = await ConversacionLog.findWarnings(conversacionId);

      res.json({
        success: true,
        data: {
          logs,
          total: logs.length
        }
      });
    } catch (error) {
      logger.error('getWarningLogs falló', { message: error.message });
      next(error);
    }
  }

  // Buscar en data JSON
  async searchInData(req, res, next) {
    try {
      const { search_key, search_value, conversacionId } = req.query;

      if (!search_key || !search_value) {
        logger.warn('searchInData rechazado', { status: 400, reason: "Se requieren los parámetros search_key y search_value" });
        return res.status(400).json({
          success: false,
          message: 'Se requieren los parámetros search_key y search_value'
        });
      }

      const logs = await ConversacionLog.searchInData(search_key, search_value, conversacionId);

      res.json({
        success: true,
        data: {
          logs,
          total: logs.length,
          searchKey: search_key,
          searchValue: search_value
        }
      });
    } catch (error) {
      logger.error('searchInData falló', { message: error.message });
      next(error);
    }
  }

  // Estadísticas de logs
  async getLogStats(req, res, next) {
    try {
      const { conversacionId } = req.query;

      const totalLogs = await ConversacionLog.count({
        where: { 
          baja_logica: false,
          ...(conversacionId && { fkid_conversacion: conversacionId })
        }
      });

      const logsInfo = await ConversacionLog.count({
        where: { 
          nivel: 'info',
          baja_logica: false,
          ...(conversacionId && { fkid_conversacion: conversacionId })
        }
      });

      const logsWarning = await ConversacionLog.count({
        where: { 
          nivel: 'warning',
          baja_logica: false,
          ...(conversacionId && { fkid_conversacion: conversacionId })
        }
      });

      const logsError = await ConversacionLog.count({
        where: { 
          nivel: 'error',
          baja_logica: false,
          ...(conversacionId && { fkid_conversacion: conversacionId })
        }
      });

      const logsDebug = await ConversacionLog.count({
        where: { 
          nivel: 'debug',
          baja_logica: false,
          ...(conversacionId && { fkid_conversacion: conversacionId })
        }
      });

      const logsPorTipo = await ConversacionLog.getLogsByType(conversacionId);
      const logsPorNivel = await ConversacionLog.getLogsByLevel(conversacionId);

      res.json({
        success: true,
        data: {
          totalLogs,
          logsInfo,
          logsWarning,
          logsError,
          logsDebug,
          logsPorTipo,
          logsPorNivel
        }
      });
    } catch (error) {
      logger.error('getLogStats falló', { message: error.message });
      next(error);
    }
  }

  // Obtener logs recientes
  async getRecentLogs(req, res, next) {
    try {
      const { limit = 10, conversacionId } = req.query;

      const logs = await ConversacionLog.getRecentLogs(parseInt(limit), conversacionId);

      res.json({
        success: true,
        data: {
          logs,
          total: logs.length
        }
      });
    } catch (error) {
      logger.error('getRecentLogs falló', { message: error.message });
      next(error);
    }
  }

  // Obtener logs por hora
  async getLogsByHour(req, res, next) {
    try {
      const { fecha } = req.params;

      const logs = await ConversacionLog.getLogsByHour(fecha);

      res.json({
        success: true,
        data: {
          logs,
          fecha
        }
      });
    } catch (error) {
      logger.error('getLogsByHour falló', { message: error.message });
      next(error);
    }
  }

  // Actualizar data del log
  async updateLogData(req, res, next) {
    try {
      const { id } = req.params;
      const { data } = req.body;

      const log = await ConversacionLog.findByPk(id);
      
      if (!log) {
        logger.warn('updateLogData rechazado', { status: 404, reason: "Log no encontrado" });
        return res.status(404).json({
          success: false,
          message: 'Log no encontrado'
        });
      }

      await log.updateData(data);

      logger.info('updateLogData', { id: id });
      res.json({
        success: true,
        message: 'Data del log actualizada exitosamente',
        data: { log }
      });
    } catch (error) {
      logger.error('updateLogData falló', { message: error.message });
      next(error);
    }
  }

  // Agregar data al log
  async addToLogData(req, res, next) {
    try {
      const { id } = req.params;
      const { key, value } = req.body;

      const log = await ConversacionLog.findByPk(id);
      
      if (!log) {
        logger.warn('addToLogData rechazado', { status: 404, reason: "Log no encontrado" });
        return res.status(404).json({
          success: false,
          message: 'Log no encontrado'
        });
      }

      await log.addToData(key, value);

      logger.info('addToLogData', { id: id });
      res.json({
        success: true,
        message: 'Data agregada al log exitosamente',
        data: { log }
      });
    } catch (error) {
      logger.error('addToLogData falló', { message: error.message });
      next(error);
    }
  }
}

module.exports = new ConversacionLogController();
