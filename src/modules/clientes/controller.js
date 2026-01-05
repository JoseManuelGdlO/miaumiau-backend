const { Cliente, Mascota, City, Pedido } = require('../../models');
const { Op } = require('sequelize');
const XLSX = require('xlsx');
const multer = require('multer');
const { applyCityFilter } = require('../../utils/cityFilter');

class ClienteController {
  // Obtener todos los clientes
  async getAllClientes(req, res, next) {
    try {
      const { 
        activos = 'true', 
        ciudad_id, 
        search,
        page = 1,
        limit = 10
      } = req.query;
      
      let whereClause = {};
      
      // Filtrar por activos/inactivos
      if (activos === 'true') {
        whereClause.isActive = true;
      } else if (activos === 'false') {
        whereClause.isActive = false;
      }
      
      // Filtrar por ciudad (si viene en query params)
      const fkidCiudadQuery = ciudad_id ?? req.query.fkid_ciudad;
      if (fkidCiudadQuery) {
        whereClause.fkid_ciudad = fkidCiudadQuery;
      }

      // Aplicar filtro de ciudad según el usuario autenticado
      // Si el usuario tiene ciudad asignada, solo puede ver clientes de su ciudad
      // Si no tiene ciudad asignada, puede ver todos los clientes
      applyCityFilter(req, whereClause, 'fkid_ciudad');

      // Búsqueda por nombre, email o teléfono
      if (search) {
        whereClause[Op.or] = [
          { nombre_completo: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { telefono: { [Op.like]: `%${search}%` } }
        ];
      }

      const offset = (page - 1) * limit;

      const { count, rows: clientes } = await Cliente.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          },
          {
            model: Mascota,
            as: 'mascotas',
            where: { isActive: true },
            required: false,
            attributes: ['id', 'nombre', 'edad', 'genero', 'raza']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Obtener estadísticas adicionales para cada cliente
      const clientesConStats = await Promise.all(
        clientes.map(async (cliente) => {
          // Contar pedidos del cliente
          const totalPedidos = await Pedido.count({
            where: { fkid_cliente: cliente.id }
          });

          // Obtener último pedido
          const ultimoPedido = await Pedido.findOne({
            where: { fkid_cliente: cliente.id },
            order: [['fecha_pedido', 'DESC']],
            attributes: ['fecha_pedido', 'estado']
          });

          // Calcular total gastado
          const totalGastado = await Pedido.sum('total', {
            where: { 
              fkid_cliente: cliente.id,
              estado: { [Op.in]: ['entregado', 'confirmado', 'en_preparacion', 'en_camino'] }
            }
          });

          return {
            ...cliente.toJSON(),
            totalPedidos: totalPedidos || 0,
            ultimoPedido: ultimoPedido ? ultimoPedido.fecha_pedido : null,
            totalGastado: totalGastado || 0,
            loyaltyPoints: Math.floor((totalGastado || 0) / 100) // 1 punto por cada $100
          };
        })
      );

      res.json({
        success: true,
        data: {
          clientes: clientesConStats,
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

  // Obtener un cliente por ID
  async getClienteById(req, res, next) {
    try {
      const { id } = req.params;
      
      const cliente = await Cliente.findByPk(id, {
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          },
          {
            model: Mascota,
            as: 'mascotas',
            where: { isActive: true },
            required: false,
            attributes: ['id', 'nombre', 'edad', 'genero', 'raza', 'producto_preferido', 'puntos_lealtad', 'notas_especiales']
          }
        ]
      });
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      // Obtener estadísticas del cliente
      const totalPedidos = await Pedido.count({
        where: { fkid_cliente: cliente.id }
      });

      const ultimoPedido = await Pedido.findOne({
        where: { fkid_cliente: cliente.id },
        order: [['fecha_pedido', 'DESC']],
        attributes: ['fecha_pedido', 'estado', 'total']
      });

      const totalGastado = await Pedido.sum('total', {
        where: { 
          fkid_cliente: cliente.id,
          estado: { [Op.in]: ['entregado', 'confirmado', 'en_preparacion', 'en_camino'] }
        }
      });

      const clienteConStats = {
        ...cliente.toJSON(),
        totalPedidos: totalPedidos || 0,
        ultimoPedido: ultimoPedido ? ultimoPedido.fecha_pedido : null,
        totalGastado: totalGastado || 0,
        loyaltyPoints: Math.floor((totalGastado || 0) / 100)
      };

      res.json({
        success: true,
        data: { cliente: clienteConStats }
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nuevo cliente
  async createCliente(req, res, next) {
    try {
      const {
        nombre_completo,
        telefono,
        canal_contacto,
        direccion_entrega,
        notas_especiales
      } = req.body;
      const email = req.body.email ?? req.body.correo_electronico;
      const fkid_ciudad = req.body.fkid_ciudad ?? req.body.ciudad_id;

      // Verificar que el email no exista (si se proporciona)
      if (email) {
        const existingCliente = await Cliente.findOne({
          where: { email }
        });

        if (existingCliente) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe un cliente con ese correo electrónico'
          });
        }
      }

      // Verificar que el teléfono no exista
      const existingPhone = await Cliente.findOne({
        where: { telefono }
      });

      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un cliente con ese número de teléfono'
        });
      }

      // Verificar que la ciudad existe
      let ciudadAsignada = fkid_ciudad;
      //Si viene en string, limpiar el texto y buscar la ciudad en la BD
      if (typeof fkid_ciudad === 'string') {
        // Limpiar el texto de entrada
        const cleanCity = fkid_ciudad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        
        // Obtener todas las ciudades activas de la BD
        const todasLasCiudades = await City.findAll({
          where: { baja_logica: false },
          attributes: ['id', 'nombre']
        });

        // Crear un mapa de ciudades normalizadas con sus IDs
        const ciudadesMap = new Map();
        todasLasCiudades.forEach(ciudad => {
          const nombreLower = ciudad.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          
          // Guardar con el nombre exacto normalizado
          ciudadesMap.set(nombreLower, ciudad.id);
          
          // Guardar variaciones comunes (sin puntos, sin espacios, etc.)
          ciudadesMap.set(nombreLower.replace(/\./g, ''), ciudad.id); // Sin puntos
          ciudadesMap.set(nombreLower.replace(/\s+/g, ''), ciudad.id); // Sin espacios
          ciudadesMap.set(nombreLower.replace(/\./g, '').replace(/\s+/g, ''), ciudad.id); // Sin puntos ni espacios
          
          // Guardar con "cd" en lugar de "ciudad" y viceversa
          if (nombreLower.startsWith('ciudad')) {
            ciudadesMap.set(nombreLower.replace('ciudad', 'cd'), ciudad.id);
          }
          if (nombreLower.startsWith('cd')) {
            ciudadesMap.set(nombreLower.replace('cd', 'ciudad'), ciudad.id);
          }
        });

        // Buscar la ciudad en el mapa
        ciudadAsignada = ciudadesMap.get(cleanCity) || 
                         ciudadesMap.get(cleanCity.replace(/\./g, '')) ||
                         ciudadesMap.get(cleanCity.replace(/\s+/g, '')) ||
                         ciudadesMap.get(cleanCity.replace(/\./g, '').replace(/\s+/g, '')) ||
                         3; // Valor por defecto si no se encuentra

        // Si aún no se encontró, hacer una búsqueda más flexible
        if (ciudadAsignada === 3) {
          const ciudadEncontrada = todasLasCiudades.find(c => {
            const nombreLower = c.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            return nombreLower === cleanCity ||
                   nombreLower.includes(cleanCity) ||
                   cleanCity.includes(nombreLower) ||
                   nombreLower.replace(/\./g, '').replace(/\s+/g, '') === cleanCity.replace(/\./g, '').replace(/\s+/g, '');
          });
          
          if (ciudadEncontrada) {
            ciudadAsignada = ciudadEncontrada.id;
          }
        }
      }
      const ciudad = await City.findByPk(ciudadAsignada);
      if (!ciudad) {
        return res.status(400).json({
          success: false,
          message: 'La ciudad especificada no existe'
        });
      }

      const cliente = await Cliente.create({
        nombre_completo,
        telefono,
        email,
        fkid_ciudad: ciudadAsignada,
        canal_contacto,
        direccion_entrega,
        notas_especiales
      });

      // Obtener el cliente creado con sus relaciones
      const clienteCompleto = await Cliente.findByPk(cliente.id, {
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          },
          {
            model: Mascota,
            as: 'mascotas',
            where: { isActive: true },
            required: false,
            attributes: ['id', 'nombre', 'edad', 'genero', 'raza']
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Cliente creado exitosamente',
        data: { cliente: clienteCompleto }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar cliente
  async updateCliente(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const cliente = await Cliente.findByPk(id);
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      // Verificar que el nuevo email no exista (si se está cambiando)
      const updateEmail = updateData.email ?? updateData.correo_electronico;
      if (updateEmail && updateEmail !== cliente.email) {
        const existingCliente = await Cliente.findOne({
          where: { 
            email: updateEmail,
            id: { [Op.ne]: id }
          }
        });
        
        if (existingCliente) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe un cliente con ese correo electrónico'
          });
        }
      }

      // Verificar que el nuevo teléfono no exista (si se está cambiando)
      if (updateData.telefono && updateData.telefono !== cliente.telefono) {
        const existingPhone = await Cliente.findOne({
          where: { 
            telefono: updateData.telefono,
            id: { [Op.ne]: id }
          }
        });
        
        if (existingPhone) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe un cliente con ese número de teléfono'
          });
        }
      }

      // Verificar que la ciudad existe (si se está cambiando)
      const updateCiudadId = updateData.fkid_ciudad ?? updateData.ciudad_id;
      if (updateCiudadId) {
        const ciudad = await City.findByPk(updateCiudadId);
        if (!ciudad) {
          return res.status(400).json({
            success: false,
            message: 'La ciudad especificada no existe'
          });
        }
      }

      await cliente.update({
        ...updateData,
        email: updateEmail ?? cliente.email,
        fkid_ciudad: updateCiudadId ?? cliente.fkid_ciudad
      });

      // Obtener el cliente actualizado con sus relaciones
      const clienteActualizado = await Cliente.findByPk(id, {
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          },
          {
            model: Mascota,
            as: 'mascotas',
            where: { isActive: true },
            required: false,
            attributes: ['id', 'nombre', 'edad', 'genero', 'raza']
          }
        ]
      });

      res.json({
        success: true,
        message: 'Cliente actualizado exitosamente',
        data: { cliente: clienteActualizado }
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar cliente (baja lógica)
  async deleteCliente(req, res, next) {
    try {
      const { id } = req.params;

      const cliente = await Cliente.findByPk(id);
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      await cliente.softDelete();

      res.json({
        success: true,
        message: 'Cliente eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restaurar cliente
  async restoreCliente(req, res, next) {
    try {
      const { id } = req.params;

      const cliente = await Cliente.findByPk(id);
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      await cliente.restore();

      res.json({
        success: true,
        message: 'Cliente restaurado exitosamente',
        data: { cliente }
      });
    } catch (error) {
      next(error);
    }
  }

  // Estadísticas de clientes
  async getClienteStats(req, res, next) {
    try {
      const totalClientes = await Cliente.count({
        where: { isActive: true }
      });

      const clientesActivos = await Cliente.count({
        where: { isActive: true }
      });

      const clientesInactivos = await Cliente.count({
        where: { isActive: false }
      });

      // Clientes por ciudad
      const clientesByCiudad = await Cliente.findAll({
        attributes: [
          'fkid_ciudad',
          [Cliente.sequelize.fn('COUNT', Cliente.sequelize.col('Cliente.id')), 'count']
        ],
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['nombre', 'departamento']
          }
        ],
        where: { isActive: true },
        group: ['fkid_ciudad', 'ciudad.id'],
        order: [[Cliente.sequelize.fn('COUNT', Cliente.sequelize.col('Cliente.id')), 'DESC']]
      });

      res.json({
        success: true,
        data: {
          totalClientes,
          clientesActivos,
          clientesInactivos,
          clientesByCiudad
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener clientes activos
  async getActiveClientes(req, res, next) {
    try {
      const whereClause = { isActive: true };
      
      // Aplicar filtro de ciudad según el usuario autenticado
      applyCityFilter(req, whereClause, 'fkid_ciudad');

      const clientes = await Cliente.findAll({
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          },
          {
            model: Mascota,
            as: 'mascotas',
            where: { isActive: true },
            required: false,
            attributes: ['id', 'nombre', 'edad', 'genero', 'raza']
          }
        ],
        where: whereClause,
        order: [['nombre_completo', 'ASC']]
      });

      res.json({
        success: true,
        data: {
          clientes,
          total: clientes.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Buscar cliente por teléfono exacto
  async getClienteByTelefono(req, res, next) {
    try {
      const { telefono } = req.params;
      
      const cliente = await Cliente.findOne({
        where: { 
          telefono: telefono,
          isActive: true 
        },
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          },
          {
            model: Mascota,
            as: 'mascotas',
            where: { isActive: true },
            required: false,
            attributes: ['id', 'nombre', 'edad', 'genero', 'raza', 'producto_preferido', 'puntos_lealtad', 'notas_especiales']
          }
        ]
      });
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado con ese número de teléfono'
        });
      }

      // Obtener estadísticas del cliente
      const totalPedidos = await Pedido.count({
        where: { fkid_cliente: cliente.id }
      });

      const ultimoPedido = await Pedido.findOne({
        where: { fkid_cliente: cliente.id },
        order: [['fecha_pedido', 'DESC']],
        attributes: ['fecha_pedido', 'estado', 'total']
      });

      const totalGastado = await Pedido.sum('total', {
        where: { 
          fkid_cliente: cliente.id,
          estado: { [Op.in]: ['entregado', 'confirmado', 'en_preparacion', 'en_camino'] }
        }
      });

      const clienteConStats = {
        ...cliente.toJSON(),
        totalPedidos: totalPedidos || 0,
        ultimoPedido: ultimoPedido ? ultimoPedido.fecha_pedido : null,
        totalGastado: totalGastado || 0,
        loyaltyPoints: Math.floor((totalGastado || 0) / 100)
      };

      res.json({
        success: true,
        data: { cliente: clienteConStats }
      });
    } catch (error) {
      next(error);
    }
  }

  // Descargar template de Excel
  async downloadTemplate(req, res, next) {
    try {
      // Crear un workbook
      const workbook = XLSX.utils.book_new();
      
      // Crear datos de ejemplo con todos los campos
      const templateData = [
        [
          'Plaza',                    // Obligatorio - Se mapea a fkid_ciudad
          'NombreCompleto',           // Opcional - Se mapea a nombre_completo (si no se proporciona, se genera "Cliente [Teléfono]")
          'NumeroTelefonico',         // Obligatorio - Se mapea a telefono
          'Email',                    // Opcional - Se mapea a email
          'Direccion',                // Opcional - Se mapea a direccion_entrega
          'CanalContacto',            // Opcional - Se mapea a canal_contacto (WhatsApp, Instagram, Facebook, etc.)
          'PuntosLealtad',            // Opcional - Se mapea a puntos_lealtad (default: 0)
          'Folio',                    // Opcional - Se agrega a notas_especiales
          'ComprasTelefono',          // Opcional - Se agrega a notas_especiales
          'NotasEspeciales'           // Opcional - Se mapea a notas_especiales
        ],
        [
          'Cd. Juarez', 
          'Juan Pérez García', 
          '6561234567', 
          'juan.perez@email.com', 
          'Calle Ejemplo 123, Col. Centro', 
          'WhatsApp', 
          '0', 
          '1234', 
          '1',
          'Cliente preferencial'
        ],
        [
          'Cd. Juarez', 
          '',                         // Ejemplo sin nombre - se generará "Cliente 6567654321"
          '6567654321', 
          'maria.gonzalez@email.com', 
          'Avenida Principal 456, Fracc. Norte', 
          'Instagram', 
          '0', 
          '5678', 
          '2',
          ''
        ],
      ];

      // Crear worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(templateData);
      
      // Ajustar ancho de columnas
      worksheet['!cols'] = [
        { wch: 15 }, // Plaza
        { wch: 30 }, // NombreCompleto
        { wch: 15 }, // NumeroTelefonico
        { wch: 30 }, // Email
        { wch: 50 }, // Direccion
        { wch: 15 }, // CanalContacto
        { wch: 12 }, // PuntosLealtad
        { wch: 15 }, // Folio
        { wch: 15 }, // ComprasTelefono
        { wch: 40 }, // NotasEspeciales
      ];

      // Agregar worksheet al workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes');

      // Generar buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Configurar headers para descarga
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=template_clientes.xlsx');
      
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  // Cargar clientes masivamente desde Excel
  async bulkUploadClientes(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No se proporcionó ningún archivo'
        });
      }

      // Leer el archivo Excel
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Validar que tenga encabezados
      if (data.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'El archivo debe contener al menos una fila de datos además de los encabezados'
        });
      }

      // Obtener encabezados (primera fila)
      if (!data[0] || !Array.isArray(data[0])) {
        return res.status(400).json({
          success: false,
          message: 'El archivo no tiene encabezados válidos'
        });
      }

      const headers = data[0].map(h => {
        if (h === null || h === undefined) return '';
        return String(h).trim();
      });
      
      console.log('Headers encontrados:', headers);
      
      // Mapear índices de columnas (campos requeridos y opcionales)
      const plazaIndex = headers.findIndex(h => 
        h && (h.toLowerCase().includes('plaza') || h.toLowerCase().includes('ciudad'))
      );
      const nombreCompletoIndex = headers.findIndex(h => 
        h && ((h.toLowerCase().includes('nombre') && h.toLowerCase().includes('completo')) ||
        h.toLowerCase().includes('nombrecompleto'))
      );
      const telefonoIndex = headers.findIndex(h => 
        h && (h.toLowerCase().includes('telefono') || h.toLowerCase().includes('teléfono') || 
        h.toLowerCase().includes('numerotelefonico') || h.toLowerCase().includes('numero telefonico'))
      );
      const emailIndex = headers.findIndex(h => 
        h && h.toLowerCase().includes('email')
      );
      const direccionIndex = headers.findIndex(h => 
        h && (h.toLowerCase().includes('direccion') || h.toLowerCase().includes('dirección'))
      );
      const canalContactoIndex = headers.findIndex(h => 
        h && ((h.toLowerCase().includes('canal') && h.toLowerCase().includes('contacto')) ||
        h.toLowerCase().includes('canalcontacto'))
      );
      const puntosLealtadIndex = headers.findIndex(h => 
        h && ((h.toLowerCase().includes('puntos') && h.toLowerCase().includes('lealtad')) ||
        h.toLowerCase().includes('puntoslealtad'))
      );
      const folioIndex = headers.findIndex(h => 
        h && h.toLowerCase().includes('folio')
      );
      const comprasIndex = headers.findIndex(h => 
        h && (h.toLowerCase().includes('compras') || h.toLowerCase().includes('# compras') ||
        h.toLowerCase().includes('comprastelefono'))
      );
      const notasEspecialesIndex = headers.findIndex(h => 
        h && ((h.toLowerCase().includes('notas') && h.toLowerCase().includes('especiales')) ||
        h.toLowerCase().includes('notasespeciales'))
      );

      console.log('Índices encontrados:', { 
        plazaIndex, 
        nombreCompletoIndex, 
        telefonoIndex, 
        emailIndex,
        direccionIndex, 
        canalContactoIndex,
        puntosLealtadIndex,
        folioIndex, 
        comprasIndex,
        notasEspecialesIndex
      });

      // Validar campos requeridos
      if (plazaIndex === -1 || telefonoIndex === -1) {
        return res.status(400).json({
          success: false,
          message: `El archivo debe contener las columnas requeridas. Encontradas: ${headers.join(', ')}. Se requieren: Plaza, NumeroTelefonico`
        });
      }

      const results = {
        created: 0,
        updated: 0,
        errors: [],
        total: 0
      };

      // Precargar todas las ciudades para optimizar búsquedas
      console.log('Precargando ciudades...');
      const todasLasCiudades = await City.findAll({
        where: { baja_logica: false },
        attributes: ['id', 'nombre']
      });

      // Crear cache de ciudades con múltiples variaciones de nombres
      const ciudadesCache = new Map();
      todasLasCiudades.forEach(ciudad => {
        const nombreLower = ciudad.nombre.toLowerCase().trim();
        // Guardar con el nombre exacto
        ciudadesCache.set(nombreLower, ciudad);
        // Guardar variaciones comunes
        ciudadesCache.set(nombreLower.replace(/\./g, ''), ciudad); // Sin puntos
        ciudadesCache.set(nombreLower.replace(/\s+/g, ''), ciudad); // Sin espacios
        ciudadesCache.set(nombreLower.replace(/\./g, '').replace(/\s+/g, ''), ciudad); // Sin puntos ni espacios
        // Guardar con "cd" en lugar de "ciudad"
        if (nombreLower.startsWith('ciudad')) {
          ciudadesCache.set(nombreLower.replace('ciudad', 'cd'), ciudad);
        }
        if (nombreLower.startsWith('cd')) {
          ciudadesCache.set(nombreLower.replace('cd', 'ciudad'), ciudad);
        }
      });

      console.log(`Cache de ciudades precargado: ${ciudadesCache.size} entradas (${todasLasCiudades.length} ciudades)`);

      // Límite de filas para procesar (prevenir loops infinitos)
      const MAX_ROWS = 10000;
      const totalRows = Math.min(data.length - 1, MAX_ROWS);

      console.log(`Iniciando procesamiento de ${totalRows} filas...`);

      // Procesar cada fila (empezando desde la fila 2, índice 1)
      for (let i = 1; i <= totalRows; i++) {
        const row = data[i];
        const rowNumber = i + 1; // Para mostrar en errores (1-indexed)

        // Validar que la fila existe y no está completamente vacía
        if (!row || !Array.isArray(row) || row.length === 0) {
          continue; // Saltar filas vacías
        }

        // Verificar si la fila tiene al menos algún dato en las columnas requeridas
        const hasData = row.some((cell, idx) => {
          return (idx === plazaIndex || idx === telefonoIndex || idx === nombreCompletoIndex) && 
                 cell !== null && cell !== undefined && String(cell).trim() !== '';
        });

        if (!hasData) {
          continue; // Saltar filas sin datos relevantes
        }

        // Validar y extraer datos de la fila
        const validationErrors = [];
        
        // Extraer datos de la fila
        const plaza = row[plazaIndex] ? String(row[plazaIndex]).trim() : '';
        const nombreCompleto = nombreCompletoIndex !== -1 && row[nombreCompletoIndex] 
          ? String(row[nombreCompletoIndex]).trim() 
          : '';
        const telefono = row[telefonoIndex] ? String(row[telefonoIndex]).trim() : '';
        const email = emailIndex !== -1 && row[emailIndex] 
          ? String(row[emailIndex]).trim() 
          : '';
        const direccion = direccionIndex !== -1 && row[direccionIndex] 
          ? String(row[direccionIndex]).trim() 
          : '';
        const canalContacto = canalContactoIndex !== -1 && row[canalContactoIndex] 
          ? String(row[canalContactoIndex]).trim() 
          : '';
        const puntosLealtad = puntosLealtadIndex !== -1 && row[puntosLealtadIndex] 
          ? parseInt(row[puntosLealtadIndex]) || 0 
          : 0;
        const folio = folioIndex !== -1 && row[folioIndex] ? String(row[folioIndex]).trim() : '';
        const compras = comprasIndex !== -1 && row[comprasIndex] ? String(row[comprasIndex]).trim() : '';
        const notasEspeciales = notasEspecialesIndex !== -1 && row[notasEspecialesIndex] 
          ? String(row[notasEspecialesIndex]).trim() 
          : '';

        // Validar campos requeridos
        if (!plaza) {
          validationErrors.push('Plaza es obligatorio');
        }
        if (!telefono) {
          validationErrors.push('NumeroTelefonico es obligatorio');
        }
        if (telefono && (telefono.length < 7 || telefono.length > 20)) {
          validationErrors.push(`NumeroTelefonico "${telefono}" debe tener entre 7 y 20 caracteres`);
        }
        // NombreCompleto es opcional - si no se proporciona, se generará uno por defecto
        if (nombreCompleto && (nombreCompleto.length < 2 || nombreCompleto.length > 100)) {
          validationErrors.push(`NombreCompleto "${nombreCompleto}" debe tener entre 2 y 100 caracteres`);
        }

        // Validar email si se proporciona
        if (email) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            validationErrors.push(`Email "${email}" no tiene un formato válido`);
          }
          if (email.length > 100) {
            validationErrors.push(`Email "${email}" no puede exceder 100 caracteres`);
          }
        }

        // Validar puntos de lealtad si se proporciona
        if (puntosLealtadIndex !== -1 && row[puntosLealtadIndex] !== undefined && row[puntosLealtadIndex] !== null && row[puntosLealtadIndex] !== '') {
          const puntos = parseInt(row[puntosLealtadIndex]);
          if (isNaN(puntos) || puntos < 0) {
            validationErrors.push(`PuntosLealtad "${row[puntosLealtadIndex]}" debe ser un número entero positivo o cero`);
          }
        }

        // Validar canal de contacto si se proporciona
        if (canalContacto && canalContacto.length > 50) {
          validationErrors.push(`CanalContacto "${canalContacto}" no puede exceder 50 caracteres`);
        }

        // Si hay errores de validación básicos, agregarlos y continuar
        if (validationErrors.length > 0) {
          results.errors.push({
            row: rowNumber,
            message: `Fila ${rowNumber}: ${validationErrors.join('; ')}`
          });
          continue;
        }

        try {
          // Buscar ciudad en cache (con múltiples variaciones)
          const plazaLower = plaza.toLowerCase().trim();
          let ciudad = ciudadesCache.get(plazaLower);
          
          // Si no se encuentra, intentar variaciones
          if (!ciudad) {
            ciudad = ciudadesCache.get(plazaLower.replace(/\./g, '')) ||
                     ciudadesCache.get(plazaLower.replace(/\s+/g, '')) ||
                     ciudadesCache.get(plazaLower.replace(/\./g, '').replace(/\s+/g, ''));
          }

          // Si aún no se encuentra, buscar en la base de datos (solo una vez por ciudad única)
          if (!ciudad) {
            // Buscar en todas las ciudades precargadas con búsqueda flexible
            ciudad = todasLasCiudades.find(c => {
              const nombreLower = c.nombre.toLowerCase().trim();
              return nombreLower === plazaLower ||
                     nombreLower.includes(plazaLower) ||
                     plazaLower.includes(nombreLower) ||
                     nombreLower.replace(/\./g, '').replace(/\s+/g, '') === plazaLower.replace(/\./g, '').replace(/\s+/g, '');
            });

            // Si se encuentra, guardar en cache para futuras búsquedas
            if (ciudad) {
              ciudadesCache.set(plazaLower, ciudad);
            }
          }

          if (!ciudad) {
            // Solo agregar error si no está en el cache de "no encontradas" (evitar errores duplicados)
            const errorKey = `error_${plazaLower}`;
            if (!ciudadesCache.has(errorKey)) {
              ciudadesCache.set(errorKey, null); // Marcar como "no encontrada"
              results.errors.push({
                row: rowNumber,
                message: `Fila ${rowNumber}: No se encontró la ciudad "${plaza}". Verifica que la ciudad exista en el sistema.`
              });
            }
            continue;
          }

          // Generar nombre completo si no se proporciona (usar teléfono como fallback)
          const nombreFinal = nombreCompleto || `Cliente ${telefono}`;

          // Construir notas especiales con información adicional (si no se proporcionó)
          let notasFinales = notasEspeciales;
          if (!notasFinales) {
            if (folio) {
              notasFinales += `Folio: ${folio}. `;
            }
            if (compras) {
              notasFinales += `Compras previas: ${compras}. `;
            }
            notasFinales = notasFinales.trim();
          } else {
            // Si hay notas del Excel, agregar información adicional si existe
            let infoAdicional = '';
            if (folio) {
              infoAdicional += `Folio: ${folio}. `;
            }
            if (compras) {
              infoAdicional += `Compras previas: ${compras}. `;
            }
            if (infoAdicional) {
              notasFinales = `${notasFinales} | ${infoAdicional.trim()}`;
            }
          }

          // Verificar si el cliente ya existe por teléfono o email ANTES de insertar
          const clienteExistentePorTelefono = await Cliente.findOne({
            where: { telefono }
          });

          const clienteExistentePorEmail = email ? await Cliente.findOne({
            where: { email }
          }) : null;

          // Verificar duplicados
          if (clienteExistentePorTelefono && clienteExistentePorEmail) {
            // Si ambos existen pero son el mismo cliente, actualizar
            if (clienteExistentePorTelefono.id === clienteExistentePorEmail.id) {
              // Es el mismo cliente, actualizar
              const updateData = {
                fkid_ciudad: ciudad.id,
                nombre_completo: nombreFinal,
              };
              
              if (email) {
                updateData.email = email;
              }
              if (direccion) {
                updateData.direccion_entrega = direccion;
              }
              if (canalContacto) {
                updateData.canal_contacto = canalContacto;
              }
              if (puntosLealtad !== undefined && puntosLealtad !== null) {
                updateData.puntos_lealtad = puntosLealtad;
              }
              if (notasFinales) {
                updateData.notas_especiales = notasFinales;
              }
              
              await clienteExistentePorTelefono.update(updateData);
              results.updated++;
              results.total++;
              continue;
            } else {
              // Son clientes diferentes, error
              results.errors.push({
                row: rowNumber,
                message: `Fila ${rowNumber}: Conflicto de duplicados - Ya existe un cliente con el teléfono "${telefono}" (ID: ${clienteExistentePorTelefono.id}) y otro cliente diferente con el email "${email}" (ID: ${clienteExistentePorEmail.id}). Verifica los datos.`
              });
              continue;
            }
          }

          if (clienteExistentePorTelefono) {
            // Cliente existe por teléfono, actualizar
            try {
              const updateData = {
                fkid_ciudad: ciudad.id,
                nombre_completo: nombreFinal,
              };
              
              if (email) {
                updateData.email = email;
              }
              if (direccion) {
                updateData.direccion_entrega = direccion;
              }
              if (canalContacto) {
                updateData.canal_contacto = canalContacto;
              }
              if (puntosLealtad !== undefined && puntosLealtad !== null) {
                updateData.puntos_lealtad = puntosLealtad;
              }
              if (notasFinales) {
                updateData.notas_especiales = notasFinales;
              }
              
              await clienteExistentePorTelefono.update(updateData);
              results.updated++;
              results.total++;
            } catch (updateError) {
              results.errors.push({
                row: rowNumber,
                message: `Fila ${rowNumber}: Error al actualizar cliente existente (Teléfono: ${telefono}, ID: ${clienteExistentePorTelefono.id}) - ${updateError.message || 'Error desconocido'}`
              });
            }
            continue;
          }

          if (clienteExistentePorEmail) {
            // Cliente existe por email pero no por teléfono, error
            results.errors.push({
              row: rowNumber,
              message: `Fila ${rowNumber}: Ya existe un cliente con el email "${email}" (ID: ${clienteExistentePorEmail.id}). El teléfono "${telefono}" no coincide con ningún cliente existente.`
            });
            continue;
          }

          // Crear nuevo cliente solo si no existe
          try {
            await Cliente.create({
              nombre_completo: nombreFinal,
              telefono,
              email: email || null,
              fkid_ciudad: ciudad.id,
              direccion_entrega: direccion || null,
              canal_contacto: canalContacto || 'WhatsApp',
              notas_especiales: notasFinales || null,
              puntos_lealtad: puntosLealtad || 0,
              isActive: true
            });
            results.created++;
            results.total++;
          } catch (createError) {
            let errorMessage = 'Error al crear el cliente';
            
            if (createError.name === 'SequelizeUniqueConstraintError') {
              if (createError.fields && createError.fields.includes('telefono')) {
                errorMessage = `Ya existe un cliente con el teléfono "${telefono}"`;
              } else if (createError.fields && createError.fields.includes('email')) {
                errorMessage = `Ya existe un cliente con el email "${email}"`;
              } else {
                errorMessage = `Violación de unicidad: ${createError.message || 'Ya existe un registro con estos datos'}`;
              }
            } else if (createError.message) {
              errorMessage = createError.message;
            }
            
            results.errors.push({
              row: rowNumber,
              message: `Fila ${rowNumber}: ${errorMessage}`
            });
          }
        } catch (error) {
          console.error(`Error procesando fila ${rowNumber}:`, error);
          
          // Extraer mensaje de error más detallado
          let errorMessage = 'Error al procesar la fila';
          
          if (error.name === 'SequelizeValidationError') {
            const validationErrors = error.errors ? error.errors.map((e) => e.message).join(', ') : error.message;
            errorMessage = `Error de validación: ${validationErrors}`;
          } else if (error.name === 'SequelizeUniqueConstraintError') {
            errorMessage = `Violación de unicidad: ${error.message || 'Ya existe un registro con estos datos'}`;
          } else if (error.name === 'SequelizeForeignKeyConstraintError') {
            errorMessage = `Error de referencia: ${error.message || 'La ciudad o referencia no existe'}`;
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          results.errors.push({
            row: rowNumber,
            message: `Fila ${rowNumber}: ${errorMessage}`
          });
        }

        // Log de progreso cada 100 filas
        if (i % 100 === 0) {
          console.log(`Procesadas ${i} de ${totalRows} filas...`);
        }
      }

      console.log(`Procesamiento completado. Creados: ${results.created}, Actualizados: ${results.updated}, Errores: ${results.errors.length}`);

      res.json({
        success: true,
        message: `Procesamiento completado. ${results.created} creados, ${results.updated} actualizados.`,
        data: results
      });
    } catch (error) {
      console.error('Error en bulkUploadClientes:', error);
      next(error);
    }
  }
}

module.exports = new ClienteController();
