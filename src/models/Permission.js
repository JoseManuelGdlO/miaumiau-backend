module.exports = (sequelize, DataTypes) => {
  const Permission = sequelize.define('Permission', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        len: [2, 100],
        notEmpty: true
      }
    },
    categoria: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        len: [2, 50],
        notEmpty: true
      }
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 1000]
      }
    },
    tipo: {
      type: DataTypes.ENUM('lectura', 'escritura', 'eliminacion', 'administracion', 'especial'),
      allowNull: false,
      defaultValue: 'lectura'
    },
    baja_logica: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    tableName: 'permissions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false, // No usar soft delete por defecto, usamos baja_logica
    indexes: [
      {
        fields: ['categoria']
      },
      {
        fields: ['tipo']
      },
      {
        fields: ['baja_logica']
      },
      {
        fields: ['nombre'],
        unique: true
      }
    ]
  });

  // Métodos de instancia
  Permission.prototype.softDelete = function() {
    this.baja_logica = true;
    return this.save();
  };

  Permission.prototype.restore = function() {
    this.baja_logica = false;
    return this.save();
  };

  // Métodos estáticos
  Permission.findByCategory = function(categoria) {
    return this.findAll({
      where: { 
        categoria,
        baja_logica: false
      },
      order: [['nombre', 'ASC']]
    });
  };

  Permission.findByType = function(tipo) {
    return this.findAll({
      where: { 
        tipo,
        baja_logica: false
      },
      order: [['nombre', 'ASC']]
    });
  };

  Permission.findActive = function() {
    return this.findAll({
      where: { baja_logica: false },
      order: [['categoria', 'ASC'], ['nombre', 'ASC']]
    });
  };

  Permission.findDeleted = function() {
    return this.findAll({
      where: { baja_logica: true },
      order: [['updated_at', 'DESC']]
    });
  };

  // Scope para consultas comunes
  Permission.addScope('active', {
    where: { baja_logica: false }
  });

  Permission.addScope('deleted', {
    where: { baja_logica: true }
  });

  Permission.addScope('byCategory', (categoria) => ({
    where: { 
      categoria,
      baja_logica: false
    }
  }));

  Permission.addScope('byType', (tipo) => ({
    where: { 
      tipo,
      baja_logica: false
    }
  }));

  return Permission;
};
