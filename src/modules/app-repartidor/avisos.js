function avisoDeEvento(event) {
  if (!event || typeof event !== 'object') return null;
  if (event.type === 'ruta.actualizada') {
    if (event.motivo === 'pago') return null;
    const aviso = {
      titulo: 'Te asignaron un pedido',
      mensaje: 'Revisa tu ruta.',
    };
    if (event.pedidoId != null) aviso.data = { pedidoId: String(event.pedidoId) };
    return aviso;
  }
  if (event.type === 'soporte.mensaje' && event.texto) {
    return { titulo: 'Call Center', mensaje: String(event.texto) };
  }
  if (event.type === 'solicitud.atendida' || event.type === 'jornada.actualizada') {
    return { titulo: 'Aviso de Call Center', mensaje: 'Hay una actualización en tu ruta.' };
  }
  return null;
}

module.exports = { avisoDeEvento };
