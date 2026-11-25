# Mapeo de Datos n8n a Endpoint de Pedidos

## Datos de entrada desde n8n (findSession2)

```json
{
  "id": 1231,
  "direccion": "Avenida del lago 230 fraccionamiento real del country",
  "mensaje_confirmacion_direccion": true,
  "metodo_pago": [null],
  "codigo_promocional": false,
  "promocion_aplicada": {
    "valido": true,
    "mensaje_usuario": "Tu código 34160 te da un descuento fijo de $300 en compras mayores a $200...",
    "detalle_promocion": {
      "nombre": "prueba promocion",
      "fecha_fin": "2025-10-31T06:00:00.000Z",
      "descripcion": "asda",
      "fecha_inicio": "2025-10-05T06:00:00.000Z",
      "compra_minima": 200,
      "ciudades_aplica": []
    }
  },
  "pago": {
    "forma": "tarjeta"
  },
  "fecha_creacion": "2025-10-26T05:51:00.047Z",
  "fecha_actualizacion": "2025-10-26T05:51:00.047Z",
  "fecha_entrega": {
    "fecha": "2025-11-07",
    "tarde": false,
    "manana": true,
    "confirmado": true,
    "mensaje_usuario": "Excelente 😺, tu entrega quedó confirmada para el 7 de noviembre por la mañana. ¡Gracias!"
  }
}
```

## Función de mapeo (JavaScript para n8n)

```javascript
// Función para mapear datos de n8n a formato del endpoint de pedidos
function mapN8nToPedido(n8nData, clienteId, ciudadId) {
  // Extraer código promocional del mensaje si existe
  let codigoPromocion = null;
  if (n8nData.promocion_aplicada && n8nData.promocion_aplicada.valido) {
    // Buscar código en el mensaje (ej: "código 34160")
    const codigoMatch = n8nData.promocion_aplicada.mensaje_usuario?.match(/código\s+(\d+)/i);
    if (codigoMatch) {
      codigoPromocion = codigoMatch[1];
    }
  }

  // Mapear método de pago
  let metodoPago = null;
  if (n8nData.pago && n8nData.pago.forma) {
    const formaPago = n8nData.pago.forma.toLowerCase();
    // Mapear a valores del enum
    const metodoPagoMap = {
      'tarjeta': 'tarjeta',
      'efectivo': 'efectivo',
      'transferencia': 'transferencia',
      'pago_movil': 'pago_movil',
      'pago movil': 'pago_movil'
    };
    metodoPago = metodoPagoMap[formaPago] || formaPago;
  }

  // Fecha de entrega (día) y ventana (mañana / tarde / cualquiera)
  let fechaEntregaEstimada = null;
  let ventana = 'cualquiera';
  if (n8nData.fecha_entrega && n8nData.fecha_entrega.fecha) {
    fechaEntregaEstimada = n8nData.fecha_entrega.fecha; // "2025-11-07"
    if (n8nData.fecha_entrega.manana) ventana = 'manana';
    else if (n8nData.fecha_entrega.tarde) ventana = 'tarde';
  }

  // Construir el objeto de pedido
  const pedido = {
    fkid_cliente: clienteId, // Debe venir de otra fuente (ej: buscar cliente por teléfono)
    direccion_entrega: n8nData.direccion || n8nData.complete_addres,
    fkid_ciudad: ciudadId, // Debe venir de otra fuente o de la conversación
    metodo_pago: metodoPago,
    fecha_entrega_estimada: fechaEntregaEstimada,
    ventana,
    codigo_promocion: codigoPromocion,
    notas: `Creado desde n8n. ${n8nData.fecha_entrega?.mensaje_usuario || ''}`.trim(),
    // productos: [] // Debe venir de otra fuente (carrito de compras)
  };

  // Agregar campos opcionales si existen
  if (n8nData.telefono_referencia) {
    pedido.telefono_referencia = n8nData.telefono_referencia;
  }

  if (n8nData.email_referencia) {
    pedido.email_referencia = n8nData.email_referencia;
  }

  return pedido;
}

// Ejemplo de uso en n8n Code node
const n8nData = $input.item.json;
const clienteId = $input.item.json.cliente_id || 1; // Ajustar según tu lógica
const ciudadId = $input.item.json.ciudad_id || 1; // Ajustar según tu lógica

const pedidoMapeado = mapN8nToPedido(n8nData, clienteId, ciudadId);

return {
  json: {
    pedido: pedidoMapeado,
    datos_originales: n8nData
  }
};
```

## JSON resultante para el endpoint

```json
{
  "fkid_cliente": 1,
  "direccion_entrega": "Avenida del lago 230 fraccionamiento real del country",
  "fkid_ciudad": 1,
  "metodo_pago": "tarjeta",
  "fecha_entrega_estimada": "2025-11-07",
  "ventana": "manana",
  "codigo_promocion": "34160",
  "notas": "Creado desde n8n. Excelente 😺, tu entrega quedó confirmada para el 7 de noviembre por la mañana. ¡Gracias!",
  "productos": [
    {
      "fkid_producto": 1,
      "cantidad": 2,
      "precio_unidad": 350.00
    }
  ]
}
```

## Código completo para nodo Code en n8n

```javascript
// Obtener datos del nodo anterior
const sessionData = $input.item.json;

// Función helper para mapear
function mapN8nToPedido(n8nData, clienteId, ciudadId) {
  // Extraer código promocional
  let codigoPromocion = null;
  if (n8nData.promocion_aplicada?.valido && n8nData.promocion_aplicada.mensaje_usuario) {
    const codigoMatch = n8nData.promocion_aplicada.mensaje_usuario.match(/código\s+(\d+)/i);
    if (codigoMatch) {
      codigoPromocion = codigoMatch[1];
    }
  }

  // Mapear método de pago
  let metodoPago = null;
  if (n8nData.pago?.forma) {
    const forma = n8nData.pago.forma.toLowerCase();
    const mapa = {
      'tarjeta': 'tarjeta',
      'efectivo': 'efectivo',
      'transferencia': 'transferencia',
      'pago_movil': 'pago_movil',
      'pago movil': 'pago_movil'
    };
    metodoPago = mapa[forma] || forma;
  }

  let fechaEntregaEstimada = n8nData.fecha_entrega?.fecha || null;
  let ventana = 'cualquiera';
  if (n8nData.fecha_entrega?.manana) ventana = 'manana';
  else if (n8nData.fecha_entrega?.tarde) ventana = 'tarde';

  // Construir objeto
  return {
    fkid_cliente: clienteId,
    direccion_entrega: n8nData.direccion || n8nData.complete_addres || "",
    fkid_ciudad: ciudadId,
    metodo_pago: metodoPago,
    fecha_entrega_estimada: fechaEntregaEstimada,
    ventana,
    codigo_promocion: codigoPromocion,
    notas: `Creado desde n8n. ${n8nData.fecha_entrega?.mensaje_usuario || ''}`.trim()
  };
}

// Obtener cliente_id y ciudad_id (deben venir de otros nodos o de la conversación)
const clienteId = sessionData.cliente_id || $('BuscarCliente').item.json.id || 1;
const ciudadId = sessionData.ciudad_id || $('BuscarCiudad').item.json.id || 1;

// Mapear datos
const pedido = mapN8nToPedido(sessionData, clienteId, ciudadId);

// Retornar resultado
return {
  json: pedido
};
```

## Notas importantes

1. **cliente_id**: Debe obtenerse de otra fuente (buscar por teléfono, email, o desde la conversación)
2. **ciudad_id**: Debe obtenerse de otra fuente (desde la conversación o del cliente)
3. **productos**: Debe venir del carrito de compras o de otro nodo
4. **codigo_promocion**: Se extrae del mensaje, pero puede que necesites el código real del sistema
5. **fecha_entrega_estimada**: Solo el día (`YYYY-MM-DD`). La franja va en **ventana**: `manana`, `tarde` o `cualquiera`. El backend guarda 09:30, 12:00 o vacío.

