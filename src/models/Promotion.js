const { Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const Promotion = sequelize.define('Promotion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [2, 100],
        notEmpty: true
      }
    },
    codigo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 20],
        notEmpty: true,
        is: /^[A-Z0-9_-]+$/
      }
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 1000]
      }
    },
    tipo_promocion: {
      type: DataTypes.ENUM('porcentaje', 'monto_fijo', 'envio_gratis', 'descuento_especial'),
      allowNull: false,
      defaultValue: 'porcentaje'
    },
    valor_descuento: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    fecha_inicio: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isDate: true
      }
    },
    fecha_fin: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isDate: true,
        isAfterStartDate(value) {
          if (value <= this.fecha_inicio) {
            throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
          }
        }
      }
    },
    limite_uso: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    compra_minima: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0
      }
    },
    descuento_maximo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0
      }
    },
    baja_logica: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    tableName: 'promotions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false, // No usar soft delete por defecto, usamos baja_logica
    indexes: [
      {
        fields: ['codigo'],
        unique: true
      },
      {
        fields: ['tipo_promocion']
      },
      {
        fields: ['fecha_inicio']
      },
      {
        fields: ['fecha_fin']
      },
      {
        fields: ['baja_logica']
      },
      {
        fields: ['fecha_inicio', 'fecha_fin']
      }
    ],
    validate: {
      fechaFinAfterInicio() {
        if (this.fecha_fin && this.fecha_inicio && this.fecha_fin <= this.fecha_inicio) {
          throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
        }
      }
    }
  });

  // Métodos de instancia
  Promotion.prototype.softDelete = function() {
    this.baja_logica = true;
    return this.save();
  };

  Promotion.prototype.restore = function() {
    this.baja_logica = false;
    return this.save();
  };

  Promotion.prototype.isActive = function() {
    const now = new Date();
    return !this.baja_logica && 
           this.fecha_inicio <= now && 
           this.fecha_fin >= now;
  };

  Promotion.prototype.isExpired = function() {
    return new Date() > this.fecha_fin;
  };

  Promotion.prototype.isNotStarted = function() {
    return new Date() < this.fecha_inicio;
  };

  // Métodos estáticos
  Promotion.findActive = function() {
    const now = new Date();
    return this.findAll({
      where: {
        baja_logica: false,
        fecha_inicio: { [Op.lte]: now },
        fecha_fin: { [Op.gte]: now }
      },
      order: [['fecha_inicio', 'ASC']]
    });
  };

  Promotion.findByType = function(tipo_promocion) {
    return this.findAll({
      where: { 
        tipo_promocion,
        baja_logica: false
      },
      order: [['fecha_inicio', 'ASC']]
    });
  };

  Promotion.findByCode = function(codigo) {
    return this.findOne({
      where: { 
        codigo,
        baja_logica: false
      }
    });
  };

  Promotion.findExpired = function() {
    const now = new Date();
    return this.findAll({
      where: {
        baja_logica: false,
        fecha_fin: { [Op.lt]: now }
      },
      order: [['fecha_fin', 'DESC']]
    });
  };

  Promotion.findUpcoming = function() {
    const now = new Date();
    return this.findAll({
      where: {
        baja_logica: false,
        fecha_inicio: { [Op.gt]: now }
      },
      order: [['fecha_inicio', 'ASC']]
    });
  };

  // Scope para consultas comunes
  Promotion.addScope('active', {
    where: {
      baja_logica: false,
      fecha_inicio: { [Op.lte]: sequelize.fn('NOW') },
      fecha_fin: { [Op.gte]: sequelize.fn('NOW') }
    }
  });

  Promotion.addScope('expired', {
    where: {
      baja_logica: false,
      fecha_fin: { [Op.lt]: sequelize.fn('NOW') }
    }
  });

  Promotion.addScope('upcoming', {
    where: {
      baja_logica: false,
      fecha_inicio: { [Op.gt]: sequelize.fn('NOW') }
    }
  });

  Promotion.addScope('byType', (tipo_promocion) => ({
    where: { 
      tipo_promocion,
      baja_logica: false
    }
  }));

  return Promotion;
};
