// Service de transport pour Terminus
// Utilise l'API Overpass pour trouver les transports à proximité

class TransportService {
  constructor() {
    this.overpassUrl = 'https://overpass-api.de/api/interpreter';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Rechercher les arrêts de transport à proximité
  async findNearbyStops(lat, lng, radius = 500) {
    const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)},${radius}`;

    // Vérifier le cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.time < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      // Requête Overpass pour trouver les arrêts de transport
      const query = `
        [out:json][timeout:10];
        (
          node["highway"="bus_stop"](around:${radius},${lat},${lng});
          node["public_transport"="stop_position"](around:${radius},${lat},${lng});
          node["railway"="station"](around:${radius},${lat},${lng});
          node["railway"="halt"](around:${radius},${lat},${lng});
          node["station"="subway"](around:${radius},${lat},${lng});
          node["amenity"="bus_station"](around:${radius},${lat},${lng});
        );
        out body;
      `;

      const response = await fetch(this.overpassUrl, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur API Overpass');
      }

      const data = await response.json();
      const stops = this.parseStops(data.elements, lat, lng);

      // Mettre en cache
      this.cache.set(cacheKey, { data: stops, time: Date.now() });

      return stops;
    } catch (error) {
      console.error('Erreur recherche transports:', error);
      return [];
    }
  }

  // Parser les résultats Overpass
  parseStops(elements, userLat, userLng) {
    const stops = elements.map(element => {
      const tags = element.tags || {};

      // Déterminer le type de transport
      let type = 'bus';
      let icon = '🚌';

      if (tags.railway === 'station' || tags.railway === 'halt') {
        type = 'train';
        icon = '🚉';
      } else if (tags.station === 'subway' || tags.subway) {
        type = 'metro';
        icon = '🚇';
      } else if (tags.amenity === 'bus_station') {
        type = 'bus_station';
        icon = '🚏';
      } else if (tags.tram === 'yes' || tags.railway === 'tram_stop') {
        type = 'tram';
        icon = '🚊';
      }

      // Calculer la distance
      const distance = this.calculateDistance(userLat, userLng, element.lat, element.lon);

      // Nom de l'arrêt
      const name = tags.name || tags['name:fr'] || tags['name:en'] || `Arrêt ${type}`;

      // Lignes desservies (si disponible)
      const lines = tags.route_ref || tags.ref || '';

      return {
        id: element.id,
        lat: element.lat,
        lng: element.lon,
        name: name,
        type: type,
        icon: icon,
        distance: distance,
        lines: lines,
        operator: tags.operator || '',
        network: tags.network || ''
      };
    });

    // Trier par distance et limiter à 10
    return stops
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);
  }

  // Calculer la distance entre deux points (Haversine)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Estimer les temps de trajet
  estimateTravelTimes(distanceMeters) {
    // Vitesses moyennes en m/s
    const walkSpeed = 1.4;  // ~5 km/h
    const bikeSpeed = 4.2;  // ~15 km/h
    const carSpeed = 8.3;   // ~30 km/h en ville
    const transitSpeed = 6.9; // ~25 km/h avec arrêts

    return {
      walk: Math.round(distanceMeters / walkSpeed / 60),      // minutes
      bike: Math.round(distanceMeters / bikeSpeed / 60),      // minutes
      car: Math.round(distanceMeters / carSpeed / 60),        // minutes
      transit: Math.round(distanceMeters / transitSpeed / 60) // minutes
    };
  }

  // Formater le temps
  formatTime(minutes) {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
  }

  // Formater la distance
  formatDistance(meters, units = 'metric') {
    if (units === 'imperial') {
      const miles = meters / 1609.34;
      if (miles < 0.1) return `${Math.round(meters * 3.281)} ft`;
      return `${miles.toFixed(1)} mi`;
    }

    if (meters < 1000) return `${meters} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }

  // Obtenir la direction cardinale
  getCardinalDirection(heading) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    const index = Math.round(heading / 45) % 8;
    return directions[index];
  }

  // Calculer le cap entre deux points
  calculateHeading(lat1, lon1, lat2, lon2) {
    const dLon = this.toRad(lon2 - lon1);
    const lat1Rad = this.toRad(lat1);
    const lat2Rad = this.toRad(lat2);

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    let heading = Math.atan2(y, x) * 180 / Math.PI;
    return (heading + 360) % 360;
  }
}

// Instance globale
const transportService = new TransportService();

