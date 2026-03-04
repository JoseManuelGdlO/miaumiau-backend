const axios = require('axios');

// Helper: llamar a la API de geocoding de Google
async function callGeocodeApi(address, apiKey) {
  const response = await axios.get(
    `https://maps.googleapis.com/maps/api/geocode/json`,
    {
      params: {
        address,
        key: apiKey,
        region: 'mx'
      }
    }
  );
  return response.data;
}

// Helper: detectar si la API encontró la calle (vs dirección genérica tipo "Ciudad, Mexico")
function isStreetFound(formattedAddress, searchedAddress) {
  const parts = formattedAddress.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length <= 3) return false;
  if (searchedAddress && formattedAddress.toLowerCase().includes(searchedAddress.toLowerCase())) return true;
  const streetPrefixes = ['c.', 'av.', 'calle', 'blvd', 'boulevard', 'privada', 'priv.', 'prolongación'];
  const firstPart = parts[0].toLowerCase();
  return streetPrefixes.some(prefix => firstPart.startsWith(prefix));
}

class MapsController {
  // Geocodificar una dirección
  async geocodeAddress(req, res, next) {
    try {
      const { address, ciudad, codigo_postal, colonia } = req.body;

      if (!address) {
        return res.status(400).json({
          success: false,
          message: 'La dirección es requerida'
        });
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: 'Google Maps API Key no configurada en el servidor'
        });
      }

      // Construir dirección completa: address + colonia (opcional) + ciudad + codigo_postal (opcional)
      let fullAddress = address;
      if (colonia) fullAddress += `, ${colonia}`;
      if (ciudad && !address.includes(ciudad)) fullAddress += `, ${ciudad}`;
      if (codigo_postal) fullAddress += `, ${codigo_postal}`;

      console.log(`[MAPS] Geocodificando dirección: ${fullAddress}`);

      let data = await callGeocodeApi(fullAddress, apiKey);

      console.log('[MAPS] Geocode respuesta cruda de Google:', {
        status: data?.status,
        resultsLength: Array.isArray(data?.results) ? data.results.length : null,
        error_message: data?.error_message
      });

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        const location = result.geometry.location;
        const formattedAddress = result.formatted_address;

        const streetFound = isStreetFound(formattedAddress, address);

        if (!streetFound && (colonia || codigo_postal)) {
          const fallbackAddress = [colonia, ciudad, codigo_postal].filter(Boolean).join(', ');
          console.log(`[MAPS] Calle no encontrada, intentando fallback: ${fallbackAddress}`);
          const fallbackData = await callGeocodeApi(fallbackAddress, apiKey);
          if (fallbackData.status === 'OK' && fallbackData.results.length > 0) {
            const fb = fallbackData.results[0];
            return res.json({
              success: true,
              data: {
                lat: fb.geometry.location.lat,
                lng: fb.geometry.location.lng,
                formatted_address: fb.formatted_address
              }
            });
          }
        }

        return res.json({
          success: true,
          data: {
            lat: location.lat,
            lng: location.lng,
            formatted_address: formattedAddress
          }
        });
      }

      return res.status(404).json({
        success: false,
        message: 'No se pudo geocodificar la dirección'
      });
    } catch (error) {
      console.error('Error geocodificando dirección:', error);
      next(error);
    }
  }

  // Calcular matriz de distancias
  async calculateDistanceMatrix(req, res, next) {
    try {
      const { origins, destinations } = req.body;

      if (!origins || !destinations) {
        return res.status(400).json({
          success: false,
          message: 'Los orígenes y destinos son requeridos'
        });
      }

      if (!Array.isArray(origins) || !Array.isArray(destinations)) {
        return res.status(400).json({
          success: false,
          message: 'Los orígenes y destinos deben ser arrays'
        });
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: 'Google Maps API Key no configurada en el servidor'
        });
      }

      const totalOrigins = origins.length;
      const totalDestinations = destinations.length;

      if (totalOrigins === 0 || totalDestinations === 0) {
        return res.status(400).json({
          success: false,
          message: 'Los orígenes y destinos no pueden estar vacíos'
        });
      }

      // Google impone un límite de elementos (origins * destinations) por petición.
      // Usamos un límite conservador de 100 elementos y troceamos origins en chunks.
      const MAX_ELEMENTS_PER_REQUEST = 100;
      const maxOriginsPerChunk = Math.max(
        1,
        Math.floor(MAX_ELEMENTS_PER_REQUEST / totalDestinations)
      );

      const allOriginAddresses = [];
      let destinationAddresses = null;
      const fullMatrix = [];

      for (let start = 0; start < totalOrigins; start += maxOriginsPerChunk) {
        const end = Math.min(start + maxOriginsPerChunk, totalOrigins);
        const originsChunk = origins.slice(start, end);

        const originsStr = originsChunk.map(c => `${c.lat},${c.lng}`).join('|');
        const destinationsStr = destinations.map(c => `${c.lat},${c.lng}`).join('|');

        const response = await axios.get(
          `https://maps.googleapis.com/maps/api/distancematrix/json`,
          {
            params: {
              origins: originsStr,
              destinations: destinationsStr,
              key: apiKey,
              units: 'metric'
            }
          }
        );

        if (response.data.status !== 'OK') {
          return res.status(400).json({
            success: false,
            message: `Error de Google Maps: ${response.data.status}`,
            error: response.data.error_message
          });
        }

        if (!destinationAddresses) {
          destinationAddresses = response.data.destination_addresses;
        }

        allOriginAddresses.push(...response.data.origin_addresses);

        const chunkMatrix = response.data.rows.map(row =>
          row.elements.map(element => ({
            distance: element.status === 'OK' ? element.distance.value / 1000 : null, // en km
            duration: element.status === 'OK' ? element.duration.value / 60 : null, // en minutos
            status: element.status
          }))
        );

        fullMatrix.push(...chunkMatrix);
      }

      return res.json({
        success: true,
        data: {
          matrix: fullMatrix,
          origin_addresses: allOriginAddresses,
          destination_addresses: destinationAddresses
        }
      });
    } catch (error) {
      console.error('Error calculando matriz de distancias:', error);
      next(error);
    }
  }

  // Geocodificar múltiples direcciones
  async geocodeMultipleAddresses(req, res, next) {
    try {
      const { addresses } = req.body;

      if (!addresses || !Array.isArray(addresses)) {
        return res.status(400).json({
          success: false,
          message: 'Las direcciones deben ser un array'
        });
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: 'Google Maps API Key no configurada en el servidor'
        });
      }

      // Geocodificar todas las direcciones en paralelo
      const geocodePromises = addresses.map(async (addressData) => {
        const addressKey = typeof addressData === 'string' ? addressData : addressData.address;
        try {
          const address = typeof addressData === 'string' ? addressData : addressData.address;
          const ciudad = typeof addressData === 'object' ? addressData.ciudad : undefined;
          const codigo_postal = typeof addressData === 'object' ? addressData.codigo_postal : undefined;
          const colonia = typeof addressData === 'object' ? addressData.colonia : undefined;

          let fullAddress = address;
          if (colonia) fullAddress += `, ${colonia}`;
          if (ciudad && !address.includes(ciudad)) fullAddress += `, ${ciudad}`;
          if (codigo_postal) fullAddress += `, ${codigo_postal}`;

          let data = await callGeocodeApi(fullAddress, apiKey);

          if (data.status === 'OK' && data.results.length > 0) {
            const result = data.results[0];
            const location = result.geometry.location;
            const formattedAddress = result.formatted_address;

            const streetFound = isStreetFound(formattedAddress, address);

            if (!streetFound && (colonia || codigo_postal)) {
              const fallbackAddress = [colonia, ciudad, codigo_postal].filter(Boolean).join(', ');
              const fallbackData = await callGeocodeApi(fallbackAddress, apiKey);
              if (fallbackData.status === 'OK' && fallbackData.results.length > 0) {
                const fb = fallbackData.results[0];
                return {
                  address: addressKey,
                  success: true,
                  lat: fb.geometry.location.lat,
                  lng: fb.geometry.location.lng,
                  formatted_address: fb.formatted_address
                };
              }
            }

            return {
              address: addressKey,
              success: true,
              lat: location.lat,
              lng: location.lng,
              formatted_address: formattedAddress
            };
          }

          return {
            address: addressKey,
            success: false,
            error: data.status
          };
        } catch (error) {
          return {
            address: addressKey,
            success: false,
            error: error.message
          };
        }
      });

      const results = await Promise.all(geocodePromises);

      return res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('Error geocodificando direcciones múltiples:', error);
      next(error);
    }
  }
}

module.exports = new MapsController();

