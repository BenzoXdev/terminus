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

  // ===== HORAIRES EN TEMPS RÉEL =====

  // Obtenir les horaires en temps réel pour un arrêt
  async getRealtimeDepartures(stop, city = null) {
    if (!stop || !stop.lat || !stop.lng) return null;

    // Détecter la ville pour utiliser la bonne API
    const detectedCity = city || this.detectCity(stop.lat, stop.lng);

    try {
      switch (detectedCity) {
        case 'montreal':
          return await this.getMontrealRealtime(stop);
        case 'paris':
          return await this.getParisRealtime(stop);
        case 'toronto':
          return await this.getTorontoRealtime(stop);
        default:
          return await this.getGenericRealtime(stop);
      }
    } catch (error) {
      console.error('Erreur horaires temps réel:', error);
      return null;
    }
  }

  // Détecter la ville depuis les coordonnées
  detectCity(lat, lng) {
    // Montréal
    if (lat >= 45.4 && lat <= 45.7 && lng >= -73.8 && lng <= -73.4) {
      return 'montreal';
    }
    // Paris
    if (lat >= 48.8 && lat <= 48.9 && lng >= 2.2 && lng <= 2.4) {
      return 'paris';
    }
    // Toronto
    if (lat >= 43.6 && lat <= 43.8 && lng >= -79.4 && lng <= -79.2) {
      return 'toronto';
    }
    return 'generic';
  }

  // Horaires STM Montréal (via API GTFS)
  async getMontrealRealtime(stop) {
    try {
      // Utiliser l'API Navitia (gratuite avec clé)
      // Note: Nécessite une clé API, on utilise une estimation pour l'instant
      return this.estimateNextDepartures(stop, 'montreal');
    } catch (e) {
      return this.estimateNextDepartures(stop, 'montreal');
    }
  }

  // Horaires RATP Paris
  async getParisRealtime(stop) {
    try {
      // API Navitia pour Paris
      return this.estimateNextDepartures(stop, 'paris');
    } catch (e) {
      return this.estimateNextDepartures(stop, 'paris');
    }
  }

  // Horaires TTC Toronto
  async getTorontoRealtime(stop) {
    try {
      // API TTC
      return this.estimateNextDepartures(stop, 'toronto');
    } catch (e) {
      return this.estimateNextDepartures(stop, 'toronto');
    }
  }

  // Méthode générique (estimation basée sur fréquences moyennes)
  async getGenericRealtime(stop) {
    return this.estimateNextDepartures(stop, 'generic');
  }

  // Estimer les prochains départs (quand API non disponible)
  estimateNextDepartures(stop, city) {
    const now = new Date();
    const currentMinutes = now.getMinutes();
    const currentHour = now.getHours();

    // Fréquences moyennes par type et ville
    const frequencies = {
      montreal: {
        bus: 10,      // Toutes les 10 minutes
        metro: 5,     // Toutes les 5 minutes
        train: 15     // Toutes les 15 minutes
      },
      paris: {
        bus: 8,
        metro: 3,
        train: 10
      },
      toronto: {
        bus: 12,
        metro: 4,
        train: 20
      },
      generic: {
        bus: 15,
        metro: 5,
        train: 20
      }
    };

    const cityFreq = frequencies[city] || frequencies.generic;
    const frequency = cityFreq[stop.type] || cityFreq.bus;

    // Générer 3 prochains départs
    const departures = [];
    let nextMinutes = currentMinutes;

    for (let i = 0; i < 3; i++) {
      nextMinutes += frequency;
      let nextHour = currentHour;
      
      if (nextMinutes >= 60) {
        nextMinutes -= 60;
        nextHour++;
        if (nextHour >= 24) nextHour = 0;
      }

      const departureTime = new Date();
      departureTime.setHours(nextHour, nextMinutes, 0, 0);
      
      const minutesUntil = (departureTime - now) / 1000 / 60;

      departures.push({
        line: stop.lines || stop.name,
        destination: 'Direction centre-ville', // Estimation
        time: `${String(nextHour).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`,
        minutesUntil: Math.round(minutesUntil),
        isRealtime: false, // Estimation, pas temps réel
        status: minutesUntil < 2 ? 'arriving' : minutesUntil < 5 ? 'soon' : 'scheduled'
      });
    }

    return {
      stop: stop.name,
      stopId: stop.id,
      type: stop.type,
      departures: departures,
      lastUpdate: now.toISOString(),
      isRealtime: false
    };
  }

  // Obtenir les horaires pour plusieurs arrêts à proximité
  async getNearbyRealtimeDepartures(lat, lng, radius = 500) {
    const stops = await this.findNearbyStops(lat, lng, radius);
    
    // Limiter à 5 arrêts les plus proches
    const closestStops = stops.slice(0, 5);

    // Obtenir les horaires pour chaque arrêt
    const departures = await Promise.all(
      closestStops.map(stop => this.getRealtimeDepartures(stop))
    );

    return departures.filter(d => d !== null);
  }

  // Formater les horaires pour l'affichage
  formatDepartureTime(departure) {
    if (departure.minutesUntil < 1) {
      return '🚌 Arrivée imminente';
    } else if (departure.minutesUntil < 5) {
      return `🚌 Dans ${departure.minutesUntil} min`;
    } else {
      return `🚌 ${departure.time}`;
    }
  }

  // ===== ITINÉRAIRE DÉTAILLÉ =====

  // Générer un itinéraire détaillé en transport en commun
  async generateDetailedRoute(startLat, startLng, endLat, endLng, userLocation = null) {
    try {
      // Trouver les arrêts proches du départ et de l'arrivée
      const startStops = await this.findNearbyStops(startLat, startLng, 800);
      const endStops = await this.findNearbyStops(endLat, endLng, 800);

      if (startStops.length === 0 || endStops.length === 0) {
        return this.generateWalkOnlyRoute(startLat, startLng, endLat, endLng);
      }

      // Calculer la distance totale
      const totalDistance = this.calculateDistance(startLat, startLng, endLat, endLng);
      
      // Générer les étapes de l'itinéraire
      const route = await this.buildTransitRoute(
        { lat: startLat, lng: startLng },
        { lat: endLat, lng: endLng },
        startStops,
        endStops,
        totalDistance
      );

      return route;
    } catch (error) {
      console.error('Erreur génération itinéraire:', error);
      return this.generateWalkOnlyRoute(startLat, startLng, endLat, endLng);
    }
  }

  // Construire un itinéraire en transport en commun
  async buildTransitRoute(start, end, startStops, endStops, totalDistance) {
    const now = new Date();
    const route = {
      type: 'transit',
      startTime: now,
      totalDistance: totalDistance,
      estimatedDuration: 0,
      steps: [],
      summary: '',
      transfers: 0,
      walkDistance: 0,
      transitDistance: 0,
      price: null
    };

    // Étape 1: Marche vers le premier arrêt
    const firstStop = startStops[0];
    const walkToStop = this.calculateDistance(start.lat, start.lng, firstStop.lat, firstStop.lng);
    
    if (walkToStop > 50) {
      route.steps.push({
        type: 'walk',
        icon: '🚶',
        mode: 'À pied',
        from: {
          name: 'Position actuelle',
          lat: start.lat,
          lng: start.lng
        },
        to: {
          name: firstStop.name,
          lat: firstStop.lat,
          lng: firstStop.lng
        },
        distance: walkToStop,
        duration: Math.ceil(walkToStop / 80), // 80m/min = ~5km/h
        departureTime: this.formatTimeHHMM(now),
        arrivalTime: this.formatTimeHHMM(new Date(now.getTime() + (walkToStop / 80) * 60000)),
        instructions: `Marcher vers ${firstStop.name}`,
        color: '#6b7280'
      });
      route.walkDistance += walkToStop;
      route.estimatedDuration += Math.ceil(walkToStop / 80);
    }

    // Déterminer le type de transport et les correspondances
    const transitSteps = await this.determineTransitSteps(firstStop, endStops[0], now, route.estimatedDuration);
    
    for (const step of transitSteps) {
      route.steps.push(step);
      route.estimatedDuration += step.duration;
      
      if (step.type === 'transit') {
        route.transitDistance += step.distance;
      } else if (step.type === 'walk') {
        route.walkDistance += step.distance;
      }
      
      if (step.type === 'transfer') {
        route.transfers++;
      }
    }

    // Étape finale: Marche vers la destination
    const lastStop = endStops[0];
    const walkFromStop = this.calculateDistance(lastStop.lat, lastStop.lng, end.lat, end.lng);
    
    if (walkFromStop > 50) {
      const arrivalAtStop = new Date(now.getTime() + route.estimatedDuration * 60000);
      route.steps.push({
        type: 'walk',
        icon: '🚶',
        mode: 'À pied',
        from: {
          name: lastStop.name,
          lat: lastStop.lat,
          lng: lastStop.lng
        },
        to: {
          name: 'Destination',
          lat: end.lat,
          lng: end.lng
        },
        distance: walkFromStop,
        duration: Math.ceil(walkFromStop / 80),
        departureTime: this.formatTimeHHMM(arrivalAtStop),
        arrivalTime: this.formatTimeHHMM(new Date(arrivalAtStop.getTime() + (walkFromStop / 80) * 60000)),
        instructions: 'Marcher vers votre destination',
        color: '#6b7280'
      });
      route.walkDistance += walkFromStop;
      route.estimatedDuration += Math.ceil(walkFromStop / 80);
    }

    // Calculer l'heure d'arrivée finale
    route.arrivalTime = new Date(now.getTime() + route.estimatedDuration * 60000);
    
    // Générer le résumé
    route.summary = this.generateRouteSummary(route);
    
    // Estimer le prix (simulation)
    route.price = this.estimatePrice(route);

    return route;
  }

  // Déterminer les étapes de transport
  async determineTransitSteps(startStop, endStop, startTime, elapsedMinutes) {
    const steps = [];
    const currentTime = new Date(startTime.getTime() + elapsedMinutes * 60000);

    // Obtenir les horaires du premier arrêt
    const departures = await this.getRealtimeDepartures(startStop);
    
    // Distance entre les arrêts
    const transitDistance = this.calculateDistance(startStop.lat, startStop.lng, endStop.lat, endStop.lng);
    
    // Déterminer si on a besoin de correspondance
    const needsTransfer = transitDistance > 3000 || startStop.type !== endStop.type;

    if (needsTransfer) {
      // Première ligne de transport
      const firstLine = departures?.departures?.[0] || {
        line: startStop.lines || 'Ligne 1',
        destination: 'Centre',
        time: this.formatTimeHHMM(new Date(currentTime.getTime() + 5 * 60000)),
        minutesUntil: 5
      };

      const transferPoint = {
        name: this.generateTransferName(startStop, endStop),
        lat: (startStop.lat + endStop.lat) / 2,
        lng: (startStop.lng + endStop.lng) / 2
      };

      const firstLegDuration = Math.ceil(transitDistance / 2 / 400); // ~400m/min en transport
      const waitTime = Math.max(2, firstLine.minutesUntil);

      // Attente
      if (waitTime > 1) {
        steps.push({
          type: 'wait',
          icon: '⏳',
          mode: 'Attente',
          location: startStop.name,
          duration: waitTime,
          departureTime: this.formatTimeHHMM(currentTime),
          arrivalTime: this.formatTimeHHMM(new Date(currentTime.getTime() + waitTime * 60000)),
          instructions: `Attendre ${waitTime} min`,
          color: '#f59e0b'
        });
      }

      // Premier trajet
      const firstDepartureTime = new Date(currentTime.getTime() + waitTime * 60000);
      steps.push({
        type: 'transit',
        icon: this.getTransportIcon(startStop.type),
        mode: this.getTransportMode(startStop.type),
        line: firstLine.line,
        lineColor: this.getLineColor(firstLine.line),
        direction: firstLine.destination,
        from: {
          name: startStop.name,
          lat: startStop.lat,
          lng: startStop.lng
        },
        to: {
          name: transferPoint.name,
          lat: transferPoint.lat,
          lng: transferPoint.lng
        },
        stops: this.generateIntermediateStops(startStop, transferPoint, 3),
        distance: Math.round(transitDistance / 2),
        duration: firstLegDuration,
        departureTime: this.formatTimeHHMM(firstDepartureTime),
        arrivalTime: this.formatTimeHHMM(new Date(firstDepartureTime.getTime() + firstLegDuration * 60000)),
        frequency: '5-10 min',
        operator: startStop.operator || 'Transport local',
        instructions: `Prendre ${this.getTransportMode(startStop.type)} ${firstLine.line} direction ${firstLine.destination}`,
        color: this.getLineColor(firstLine.line)
      });

      // Correspondance
      const transferTime = new Date(firstDepartureTime.getTime() + firstLegDuration * 60000);
      steps.push({
        type: 'transfer',
        icon: '🔄',
        mode: 'Correspondance',
        from: transferPoint.name,
        walkTime: 3,
        duration: 5,
        departureTime: this.formatTimeHHMM(transferTime),
        arrivalTime: this.formatTimeHHMM(new Date(transferTime.getTime() + 5 * 60000)),
        instructions: `Correspondance vers ${this.getTransportMode(endStop.type)}`,
        color: '#8b5cf6'
      });

      // Deuxième trajet
      const secondDepartureTime = new Date(transferTime.getTime() + 5 * 60000);
      const secondLegDuration = Math.ceil(transitDistance / 2 / 400);
      
      steps.push({
        type: 'transit',
        icon: this.getTransportIcon(endStop.type),
        mode: this.getTransportMode(endStop.type),
        line: endStop.lines || 'Ligne 2',
        lineColor: this.getLineColor(endStop.lines || 'Ligne 2'),
        direction: 'Terminus',
        from: {
          name: transferPoint.name,
          lat: transferPoint.lat,
          lng: transferPoint.lng
        },
        to: {
          name: endStop.name,
          lat: endStop.lat,
          lng: endStop.lng
        },
        stops: this.generateIntermediateStops(transferPoint, endStop, 2),
        distance: Math.round(transitDistance / 2),
        duration: secondLegDuration,
        departureTime: this.formatTimeHHMM(secondDepartureTime),
        arrivalTime: this.formatTimeHHMM(new Date(secondDepartureTime.getTime() + secondLegDuration * 60000)),
        frequency: '5-10 min',
        operator: endStop.operator || 'Transport local',
        instructions: `Prendre ${this.getTransportMode(endStop.type)} direction Terminus`,
        color: this.getLineColor(endStop.lines || 'Ligne 2')
      });

    } else {
      // Trajet direct sans correspondance
      const departure = departures?.departures?.[0] || {
        line: startStop.lines || 'Direct',
        destination: endStop.name,
        time: this.formatTimeHHMM(new Date(currentTime.getTime() + 5 * 60000)),
        minutesUntil: 5
      };

      const waitTime = Math.max(2, departure.minutesUntil);
      const transitDuration = Math.ceil(transitDistance / 400);

      // Attente
      if (waitTime > 1) {
        steps.push({
          type: 'wait',
          icon: '⏳',
          mode: 'Attente',
          location: startStop.name,
          duration: waitTime,
          departureTime: this.formatTimeHHMM(currentTime),
          arrivalTime: this.formatTimeHHMM(new Date(currentTime.getTime() + waitTime * 60000)),
          instructions: `Attendre ${waitTime} min`,
          color: '#f59e0b'
        });
      }

      // Trajet direct
      const departureTime = new Date(currentTime.getTime() + waitTime * 60000);
      steps.push({
        type: 'transit',
        icon: this.getTransportIcon(startStop.type),
        mode: this.getTransportMode(startStop.type),
        line: departure.line,
        lineColor: this.getLineColor(departure.line),
        direction: departure.destination,
        from: {
          name: startStop.name,
          lat: startStop.lat,
          lng: startStop.lng
        },
        to: {
          name: endStop.name,
          lat: endStop.lat,
          lng: endStop.lng
        },
        stops: this.generateIntermediateStops(startStop, endStop, 5),
        distance: transitDistance,
        duration: transitDuration,
        departureTime: this.formatTimeHHMM(departureTime),
        arrivalTime: this.formatTimeHHMM(new Date(departureTime.getTime() + transitDuration * 60000)),
        frequency: '5-10 min',
        operator: startStop.operator || 'Transport local',
        instructions: `Prendre ${this.getTransportMode(startStop.type)} ${departure.line} direction ${departure.destination}`,
        color: this.getLineColor(departure.line)
      });
    }

    return steps;
  }

  // Générer les arrêts intermédiaires
  generateIntermediateStops(from, to, count) {
    const stops = [];
    const names = ['Place centrale', 'Marché', 'Université', 'Hôtel de ville', 'Parc', 'Bibliothèque', 'Stade', 'Musée'];
    
    for (let i = 0; i < count; i++) {
      const ratio = (i + 1) / (count + 1);
      stops.push({
        name: names[i % names.length] || `Arrêt ${i + 1}`,
        lat: from.lat + (to.lat - from.lat) * ratio,
        lng: from.lng + (to.lng - from.lng) * ratio
      });
    }
    
    return stops;
  }

  // Générer un nom de correspondance
  generateTransferName(startStop, endStop) {
    const names = ['Gare centrale', 'Place du marché', 'Centre-ville', 'Carrefour', 'Hub'];
    return names[Math.floor(Math.random() * names.length)];
  }

  // Générer un itinéraire à pied uniquement
  generateWalkOnlyRoute(startLat, startLng, endLat, endLng) {
    const now = new Date();
    const distance = this.calculateDistance(startLat, startLng, endLat, endLng);
    const duration = Math.ceil(distance / 80); // 80m/min

    return {
      type: 'walk',
      startTime: now,
      arrivalTime: new Date(now.getTime() + duration * 60000),
      totalDistance: distance,
      estimatedDuration: duration,
      steps: [{
        type: 'walk',
        icon: '🚶',
        mode: 'À pied',
        from: {
          name: 'Position actuelle',
          lat: startLat,
          lng: startLng
        },
        to: {
          name: 'Destination',
          lat: endLat,
          lng: endLng
        },
        distance: distance,
        duration: duration,
        departureTime: this.formatTimeHHMM(now),
        arrivalTime: this.formatTimeHHMM(new Date(now.getTime() + duration * 60000)),
        instructions: 'Marcher jusqu\'à votre destination',
        color: '#6b7280'
      }],
      summary: `${this.formatTime(duration)} à pied (${this.formatDistance(distance)})`,
      transfers: 0,
      walkDistance: distance,
      transitDistance: 0,
      price: null
    };
  }

  // Générer le résumé de l'itinéraire
  generateRouteSummary(route) {
    const parts = [];
    
    // Modes de transport utilisés
    const modes = [...new Set(route.steps.filter(s => s.type === 'transit').map(s => s.mode))];
    
    if (modes.length > 0) {
      parts.push(modes.join(' + '));
    }
    
    if (route.transfers > 0) {
      parts.push(`${route.transfers} correspondance${route.transfers > 1 ? 's' : ''}`);
    }
    
    return `${this.formatTime(route.estimatedDuration)} • ${this.formatDistance(route.totalDistance)}${parts.length > 0 ? ' • ' + parts.join(' • ') : ''}`;
  }

  // Estimer le prix
  estimatePrice(route) {
    // Prix simulé basé sur la distance
    if (route.transitDistance === 0) return null;
    
    const basePrice = 3.50; // Prix de base
    const pricePerKm = 0.15; // Prix par km
    const price = basePrice + (route.transitDistance / 1000) * pricePerKm;
    
    return {
      amount: Math.round(price * 100) / 100,
      currency: 'CAD',
      formatted: `${price.toFixed(2)} $`
    };
  }

  // Obtenir l'icône de transport
  getTransportIcon(type) {
    const icons = {
      'bus': '🚌',
      'metro': '🚇',
      'train': '🚆',
      'tram': '🚊',
      'ferry': '⛴️',
      'bus_station': '🚏'
    };
    return icons[type] || '🚌';
  }

  // Obtenir le mode de transport
  getTransportMode(type) {
    const modes = {
      'bus': 'Bus',
      'metro': 'Métro',
      'train': 'Train',
      'tram': 'Tramway',
      'ferry': 'Ferry',
      'bus_station': 'Bus'
    };
    return modes[type] || 'Bus';
  }

  // Obtenir la couleur d'une ligne
  getLineColor(line) {
    const colors = {
      'Ligne 1': '#00a86b',
      'Ligne 2': '#ff6f00',
      'Ligne 3': '#0077be',
      'Ligne 4': '#8b008b',
      'Ligne 5': '#00bcd4',
      'A': '#f44336',
      'B': '#2196f3',
      'C': '#4caf50',
      'D': '#ff9800',
      'E': '#9c27b0'
    };
    
    // Essayer de trouver une correspondance
    for (const [key, color] of Object.entries(colors)) {
      if (line && line.toString().includes(key)) {
        return color;
      }
    }
    
    // Couleur par défaut basée sur le hash du nom
    const hash = line ? line.toString().split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0) : 0;
    
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  // Formater l'heure HH:MM
  formatTimeHHMM(date) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}

// Instance globale
const transportService = new TransportService();

