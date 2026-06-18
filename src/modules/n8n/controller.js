const {
  Notificacion,
  Conversacion,
  ConversacionLog,
  sequelize,
} = require('../../models');
const { Op } = require('sequelize');
const {
  phonesMatch,
  findPedidoActivoPorTelefono,
  toPedidoResumen,
} = require('./pedidoActivo');
const { sendPushToUsersWithPermission } = require('../../services/pushService');
const { createConversationChatMessage } = require('../../services/conversacionChatService');
const { downloadAndSaveConversationImage } = require('../../utils/whatsapp');
const { deleteConversationImage } = require('../../utils/uploadImages');

const NOTIFICACION_TIPO = 'modificacion_pedido_activo';
const ANTI_SPAM_HORAS = 2;

const buildNotificacionAccion = (conversacionId) => ({
  tipo: 'ir_conversacion',
  conversacionId,
  ruta: `/conversaciones/${conversacionId}`,
});

const buildNotificacionDatos = ({
  conversacionId,
  telefono,
  pedido,
  textoBoton,
  mensajeUsuario,
}) => ({
  tipo: NOTIFICACION_TIPO,
  conversacionId,
  telefono,
  pedidoId: pedido?.id ?? null,
  numeroPedido: pedido?.numero_pedido ?? null,
  estadoPedido: pedido?.estado ?? null,
  textoBoton: textoBoton || null,
  mensajeUsuario: mensajeUsuario || null,
  accion: buildNotificacionAccion(conversacionId),
});

const findNotificacionRecienteDuplicada = async (conversacionId) => {
  const fechaLimite = new Date();
  fechaLimite.setHours(fechaLimite.getHours() - ANTI_SPAM_HORAS);

  const candidatas = await Notificacion.findAll({
    where: {
      leida: false,
      created_at: { [Op.gte]: fechaLimite },
    },
    order: [['created_at', 'DESC']],
    limit: 100,
  });

  return candidatas.find(
    (notificacion) =>
      notificacion.datos?.tipo === NOTIFICACION_TIPO &&
      Number(notificacion.datos?.conversacionId) === Number(conversacionId)
  ) || null;
};

class N8nController {
  async checkPedidoActivo(req, res, next) {
    try {
      const { telefono } = req.query;
      const { pedido } = await findPedidoActivoPorTelefono(telefono);

      res.status(200).json({
        success: true,
        tiene_pedido_activo: Boolean(pedido),
        pedido: pedido ? toPedidoResumen(pedido) : null,
      });
    } catch (error) {
      next(error);
    }
  }

  async crearAlertaModificacionPedido(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const {
        telefono,
        fkid_conversacion,
        texto_boton: textoBoton,
        mensaje_usuario: mensajeUsuario,
        pedido_id: pedidoId,
      } = req.body;

      const conversacion = await Conversacion.findOne({
        where: {
          id: fkid_conversacion,
          baja_logica: false,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!conversacion) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada',
        });
      }

      if (!phonesMatch(conversacion.from, telefono)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'El teléfono no corresponde a la conversación indicada',
        });
      }

      const { pedido } = await findPedidoActivoPorTelefono(telefono, pedidoId);
      if (!pedido) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: 'El usuario no tiene un pedido activo en estado pendiente o en camino',
        });
      }

      const notificacionExistente = await findNotificacionRecienteDuplicada(fkid_conversacion);
      if (conversacion.status === 'pausada' && notificacionExistente) {
        await transaction.commit();
        return res.status(200).json({
          success: true,
          creada: false,
          conversacion_pausada: true,
          conversacion: {
            id: conversacion.id,
            status: conversacion.status,
          },
          notificacion: {
            id: notificacionExistente.id,
            nombre: notificacionExistente.nombre,
            prioridad: notificacionExistente.prioridad,
          },
        });
      }

      const now = new Date();
      const fecha_creacion = now.toISOString().split('T')[0];
      const hora_creacion = now.toTimeString().split(' ')[0];

      const notificacion = await Notificacion.create(
        {
          nombre: 'Cliente con pedido activo solicita cambios',
          descripcion:
            'El usuario intentó modificar su pedido en curso mediante el bot. Requiere atención de asesor.',
          prioridad: 'alta',
          leida: false,
          fecha_creacion,
          hora_creacion,
          datos: buildNotificacionDatos({
            conversacionId: fkid_conversacion,
            telefono,
            pedido,
            textoBoton,
            mensajeUsuario,
          }),
        },
        { transaction }
      );

      const statusAnterior = conversacion.status;
      if (statusAnterior !== 'pausada') {
        await conversacion.update({ status: 'pausada' }, { transaction });

        const logNow = new Date();
        await ConversacionLog.create(
          {
            fkid_conversacion,
            fecha: logNow.toISOString().split('T')[0],
            hora: logNow.toTimeString().split(' ')[0],
            data: {
              motivo: 'bot_pausado_por_modificacion_pedido',
              status_anterior: statusAnterior,
              status_nuevo: 'pausada',
              notificacion_id: notificacion.id,
              pedido_id: pedido.id,
              fuente: 'n8n',
            },
            tipo_log: 'sistema',
            nivel: 'info',
            descripcion: 'Bot pausado: cliente con pedido activo solicitó cambios',
          },
          { transaction }
        );
      }

      await transaction.commit();

      try {
        await sendPushToUsersWithPermission('ver_notificaciones', {
          title: notificacion.nombre,
          body: notificacion.descripcion,
          url: `/dashboard/conversations/${fkid_conversacion}`,
        });
      } catch (pushError) {
        console.warn('[push] alerta-modificacion-pedido', pushError.message);
      }

      res.status(201).json({
        success: true,
        creada: true,
        conversacion_pausada: true,
        conversacion: {
          id: conversacion.id,
          status: 'pausada',
        },
        notificacion: {
          id: notificacion.id,
          nombre: notificacion.nombre,
          prioridad: notificacion.prioridad,
        },
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  async recibirImagenWhatsApp(req, res, next) {
    let savedFilename = null;

    try {
      const {
        fkid_conversacion: fkidConversacion,
        media_id: mediaId,
        mime_type: mimeType,
        mensaje,
        whatsapp_message_id: whatsappMessageId,
        caption,
      } = req.body;

      const result = await downloadAndSaveConversationImage(mediaId, mimeType || null);

      if (!result.success) {
        const status = result.status || 502;
        return res.status(status).json({
          success: false,
          message: result.error || 'No se pudo descargar la imagen de WhatsApp',
        });
      }

      savedFilename = result.filename;

      const chat = await createConversationChatMessage({
        fkid_conversacion: fkidConversacion,
        from: 'usuario',
        mensaje,
        tipo_mensaje: 'imagen',
        metadata: {
          canal: 'whatsapp',
          whatsapp_message_id: whatsappMessageId,
          media_id: mediaId,
          mime_type: result.mime_type,
          image_url: result.image_url,
          caption: caption || null,
        },
        changed_by: req.user?.id || 'n8n',
      });

      res.status(201).json({
        success: true,
        message: 'Imagen recibida y guardada en la conversación',
        data: {
          chat,
          image_url: result.image_url,
          filename: result.filename,
          mime_type: result.mime_type,
          size_bytes: result.size_bytes,
        },
      });
    } catch (error) {
      if (savedFilename) {
        deleteConversationImage(savedFilename);
      }
      next(error);
    }
  }
}

module.exports = new N8nController();
