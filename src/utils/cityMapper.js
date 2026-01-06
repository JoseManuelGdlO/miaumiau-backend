const { City } = require('../models');

/**
 * Convierte un nombre de ciudad (string) o ID (número) a ID de ciudad
 * @param {string|number} cityInput - Nombre de la ciudad o ID numérico
 * @param {Object} options - Opciones adicionales
 * @param {number} options.defaultId - ID por defecto si no se encuentra (opcional)
 * @param {boolean} options.includeInactive - Incluir ciudades inactivas en la búsqueda (default: false)
 * @returns {Promise<number|null>} - ID de la ciudad o null si no se encuentra
 */
async function mapCityNameToId(cityInput, options = {}) {
  const { defaultId = null, includeInactive = false } = options;

  // Si es número, retornarlo directamente (asumiendo que es un ID válido)
  if (typeof cityInput === 'number') {
    return cityInput;
  }

  // Si no es string, retornar null
  if (typeof cityInput !== 'string') {
    return null;
  }

  // Limpiar el texto de entrada
  const cleanCity = cityInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  if (!cleanCity) {
    return null;
  }

  // Obtener todas las ciudades (activas o todas según la opción)
  const whereClause = includeInactive ? {} : { baja_logica: false };
  const todasLasCiudades = await City.findAll({
    where: whereClause,
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
  let ciudadId = ciudadesMap.get(cleanCity) || 
                 ciudadesMap.get(cleanCity.replace(/\./g, '')) ||
                 ciudadesMap.get(cleanCity.replace(/\s+/g, '')) ||
                 ciudadesMap.get(cleanCity.replace(/\./g, '').replace(/\s+/g, '')) ||
                 null;

  // Si aún no se encontró, hacer una búsqueda más flexible
  if (!ciudadId) {
    const ciudadEncontrada = todasLasCiudades.find(c => {
      const nombreLower = c.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      return nombreLower === cleanCity ||
             nombreLower.includes(cleanCity) ||
             cleanCity.includes(nombreLower) ||
             nombreLower.replace(/\./g, '').replace(/\s+/g, '') === cleanCity.replace(/\./g, '').replace(/\s+/g, '');
    });
    
    if (ciudadEncontrada) {
      ciudadId = ciudadEncontrada.id;
    }
  }

  // Retornar el ID encontrado, el defaultId, o null
  return ciudadId || defaultId;
}

/**
 * Valida que una ciudad existe y retorna el ID
 * @param {string|number} cityInput - Nombre de la ciudad o ID numérico
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<{id: number, city: City}|null>} - Objeto con ID y ciudad, o null si no existe
 */
async function validateAndGetCity(cityInput, options = {}) {
  const cityId = await mapCityNameToId(cityInput, options);
  
  if (!cityId) {
    return null;
  }

  const city = await City.findByPk(cityId);
  
  if (!city) {
    return null;
  }

  return {
    id: cityId,
    city: city
  };
}

module.exports = {
  mapCityNameToId,
  validateAndGetCity
};
