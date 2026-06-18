const { User, Role, Permission } = require('../models');

async function usersWithPermission(permissionName) {
  const [withPermission, superAdmins] = await Promise.all([
    User.findAll({
      where: { isActive: true },
      include: [
        {
          model: Role,
          as: 'rol',
          required: true,
          where: { baja_logica: false },
          include: [
            {
              model: Permission,
              as: 'permissions',
              required: true,
              through: { attributes: [] },
              where: {
                nombre: permissionName,
                baja_logica: false,
              },
            },
          ],
        },
      ],
    }),
    User.findAll({
      where: { isActive: true },
      include: [
        {
          model: Role,
          as: 'rol',
          required: true,
          where: { nombre: 'super_admin', baja_logica: false },
        },
      ],
    }),
  ]);

  const byId = new Map();
  for (const user of [...withPermission, ...superAdmins]) {
    byId.set(user.id, user);
  }

  return [...byId.values()];
}

module.exports = usersWithPermission;
