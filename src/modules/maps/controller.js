const axios = require('axios');

class MapsController {
  // Geocodificar una dirección
  async geocodeAddress(req, res, next) {
    try {
      const { address, estado, ciudad } = req.body;

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

      // Construir dirección completa con estado/ciudad para mejor precisión
      let fullAddress = address;
      if (estado) {
        fullAddress += `, ${estado}`;
      }
      if (ciudad && !address.includes(ciudad)) {
        fullAddress += `, ${ciudad}`;
      }

      console.log(`[MAPS] Geocodificando dirección: ${fullAddress}`);

      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json`,
        {
          params: {
            address: fullAddress,
            key: apiKey,
            region: 'mx' // Restringir búsqueda a México
          }
        }
      );

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location;
        return res.json({
          success: true,
          data: {
            lat: location.lat,
            lng: location.lng,
            formatted_address: response.data.results[0].formatted_address
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

      // Convertir arrays de coordenadas a string
      const originsStr = origins.map(c => `${c.lat},${c.lng}`).join('|');
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

      if (response.data.status === 'OK') {
        const matrix = response.data.rows.map((row, i) =>
          row.elements.map((element, j) => ({
            distance: element.status === 'OK' ? element.distance.value / 1000 : null, // en km
            duration: element.status === 'OK' ? element.duration.value / 60 : null, // en minutos
            status: element.status
          }))
        );

        return res.json({
          success: true,
          data: {
            matrix: matrix,
            origin_addresses: response.data.origin_addresses,
            destination_addresses: response.data.destination_addresses
          }
        });
      }

      return res.status(400).json({
        success: false,
        message: `Error de Google Maps: ${response.data.status}`,
        error: response.data.error_message
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
        try {
          // addressData puede ser string o objeto con address, estado, ciudad
          const address = typeof addressData === 'string' ? addressData : addressData.address;
          const estado = typeof addressData === 'object' ? addressData.estado : undefined;
          const ciudad = typeof addressData === 'object' ? addressData.ciudad : undefined;
          
          // Construir dirección completa
          let fullAddress = address;
          if (estado) {
            fullAddress += `, ${estado}`;
          }
          if (ciudad && !address.includes(ciudad)) {
            fullAddress += `, ${ciudad}`;
          }
          
          const response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json`,
            {
              params: {
                address: fullAddress,
                key: apiKey,
                region: 'mx' // Restringir búsqueda a México
              }
            }
          );

          if (response.data.status === 'OK' && response.data.results.length > 0) {
            const location = response.data.results[0].geometry.location;
            return {
              address: typeof addressData === 'string' ? addressData : addressData.address,
              success: true,
              lat: location.lat,
              lng: location.lng,
              formatted_address: response.data.results[0].formatted_address
            };
          }

          return {
            address: typeof addressData === 'string' ? addressData : addressData.address,
            success: false,
            error: response.data.status
          };
        } catch (error) {
          return {
            address: address,
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

