module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define('Role', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [2, 50],
        notEmpty: true
      }
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 500]
      }
    },
    baja_logica: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    tableName: 'roles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false, // No usar soft delete por defecto, usamos baja_logica
    indexes: [
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
  Role.prototype.softDelete = function() {
    this.baja_logica = true;
    return this.save();
  };

  Role.prototype.restore = function() {
    this.baja_logica = false;
    return this.save();
  };

  // Métodos estáticos
  Role.findActive = function() {
    return this.findAll({
      where: { baja_logica: false },
      order: [['nombre', 'ASC']]
    });
  };

  Role.findDeleted = function() {
    return this.findAll({
      where: { baja_logica: true },
      order: [['updated_at', 'DESC']]
    });
  };

  Role.findByName = function(nombre) {
    return this.findOne({
      where: { 
        nombre,
        baja_logica: false
      }
    });
  };

  // Scope para consultas comunes
  Role.addScope('active', {
    where: { baja_logica: false }
  });

  Role.addScope('deleted', {
    where: { baja_logica: true }
  });

  return Role;
};
