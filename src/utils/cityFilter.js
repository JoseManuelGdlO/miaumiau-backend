/**
 * Helper para aplicar filtro de ciudad según el usuario
 * 
 * Reglas:
 * - Si el usuario tiene ciudad_id asignada (no es null) → Solo puede ver información de esa ciudad
 * - Si el usuario NO tiene ciudad_id (es null) → Puede ver información de todas las ciudades
 * 
 * @param {Object} req - Request object (debe tener req.user con ciudad_id o ciudad)
 * @param {string} cityFieldName - Nombre del campo de ciudad en el modelo (ej: 'fkid_ciudad', 'ciudad_id')
 * @returns {Object|null} - Objeto con el filtro de ciudad o null si no se debe filtrar
 */
function getCityFilter(req, cityFieldName = 'fkid_ciudad') {
  // Si no hay usuario autenticado, no aplicar filtro
  if (!req.user) {
    return null;
  }

  // Obtener ciudad_id del usuario
  // Puede venir de req.user.ciudad_id o req.user.ciudad?.id
  let userCityId = null;
  
  if (req.user.ciudad_id !== undefined && req.user.ciudad_id !== null) {
    userCityId = req.user.ciudad_id;
  } else if (req.user.ciudad && req.user.ciudad.id) {
    userCityId = req.user.ciudad.id;
  }

  // Si el usuario tiene una ciudad asignada, filtrar por esa ciudad
  if (userCityId !== null) {
    return {
      [cityFieldName]: userCityId
    };
  }

  // Si el usuario NO tiene ciudad asignada, no aplicar filtro (puede ver todo)
  return null;
}

/**
 * Aplica el filtro de ciudad a un whereClause existente
 * 
 * @param {Object} req - Request object
 * @param {Object} whereClause - Objeto whereClause de Sequelize
 * @param {string} cityFieldName - Nombre del campo de ciudad en el modelo
 * @returns {Object} - whereClause actualizado con el filtro de ciudad (si aplica)
 */
function applyCityFilter(req, whereClause = {}, cityFieldName = 'fkid_ciudad') {
  const cityFilter = getCityFilter(req, cityFieldName);
  
  if (cityFilter) {
    // Si ya existe un filtro de ciudad en el whereClause, respetarlo (el query param tiene prioridad)
    // Pero si el usuario tiene ciudad asignada, forzar su ciudad
    if (whereClause[cityFieldName]) {
      // Si el usuario tiene ciudad asignada, solo puede ver su ciudad
      // Ignorar el filtro del query param si es diferente
      const requestedCityId = whereClause[cityFieldName];
      const userCityId = req.user.ciudad_id || req.user.ciudad?.id;
      
      if (userCityId !== null && requestedCityId !== userCityId) {
        // El usuario intentó filtrar por otra ciudad, forzar su ciudad
        whereClause[cityFieldName] = userCityId;
      }
      // Si el requestedCityId coincide con userCityId, mantenerlo
    } else {
      // No hay filtro de ciudad en el query, aplicar el del usuario
      whereClause[cityFieldName] = cityFilter[cityFieldName];
    }
  }
  // Si no hay filtro de ciudad del usuario, no hacer nada (puede ver todo)

  return whereClause;
}

module.exports = {
  getCityFilter,
  applyCityFilter
};

