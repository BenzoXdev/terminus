// Service de géolocalisation amélioré pour Terminus
class GeolocationService {
  constructor() {
    this.watchId = null;
    this.currentPosition = null;
    this.previousPosition = null;
    this.destination = null;
    this.callbacks = {
      onPositionUpdate: null,
      onDistanceChange: null,
      onArrival: null,
      onError: null
    };
    this.isTracking = false;
    this.hasTriggeredAlert = false;
    this.alertZoneRadius = 1000; // Rayon par défaut
    this.lastAlertTime = 0;
    this.positionHistory = [];
    this.maxHistoryLength = 10;
  }

  // Vérifier si le GPS est disponible
  isGPSAvailable() {
    return 'geolocation' in navigator;
  }

  // Demander la permission GPS avec message clair
  async requestPermission() {
    if (!this.isGPSAvailable()) {
      return {
        success: false,
        message: '❌ Géolocalisation non supportée par ce navigateur',
        code: 'NOT_SUPPORTED'
      };
    }

    try {
      const position = await this.getCurrentPosition(true);
      return {
        success: true,
        message: '✅ GPS activé',
        position,
        accuracy: position.coords.accuracy
      };
    } catch (error) {
      return {
        success: false,
        message: this.getErrorMessage(error),
        code: error.code
      };
    }
  }

  // Obtenir la position actuelle avec haute précision
  getCurrentPosition(highAccuracy = true) {
    return new Promise((resolve, reject) => {
      if (!this.isGPSAvailable()) {
        reject({ code: 0, message: 'GPS non supporté' });
        return;
      }

      const options = {
        enableHighAccuracy: highAccuracy,
        timeout: 30000, // 30 secondes
        maximumAge: 0
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.currentPosition = position;
          resolve(position);
        },
        (error) => reject(error),
        options
      );
    });
  }

  // Démarrer le suivi GPS
  async startTracking(destination, callbacks = {}, options = {}) {
    if (!this.isGPSAvailable()) {
      throw new Error('La géolocalisation n\'est pas supportée');
    }

    this.destination = destination;
    this.callbacks = { ...this.callbacks, ...callbacks };
    this.alertZoneRadius = options.alertRadius || 1000;
    this.hasTriggeredAlert = false;
    this.positionHistory = [];

    // Obtenir la position initiale
    try {
      const initialPosition = await this.getCurrentPosition(true);
      this.currentPosition = initialPosition;
      this.previousPosition = null;
      this.isTracking = true;

      // Démarrer le suivi continu
      this.watchId = navigator.geolocation.watchPosition(
        (position) => this.handlePositionUpdate(position),
        (error) => this.handleError(error),
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 1000 // Accepter des positions récentes (1 seconde)
        }
      );

      return {
        success: true,
        position: initialPosition,
        distance: this.calculateDistanceToDestination(initialPosition)
      };

    } catch (error) {
      this.isTracking = false;
      throw error;
    }
  }

  // Arrêter le suivi
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    this.hasTriggeredAlert = false;
    this.previousPosition = null;
  }

  // Définir le rayon de la zone d'alerte
  setAlertRadius(radius) {
    this.alertZoneRadius = radius;
  }

  // Gérer les mises à jour de position
  handlePositionUpdate(position) {
    // Sauvegarder la position précédente pour calcul de vitesse
    this.previousPosition = this.currentPosition;
    this.currentPosition = position;

    // Ajouter à l'historique
    this.positionHistory.push({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: position.timestamp,
      accuracy: position.coords.accuracy
    });

    // Garder seulement les dernières positions
    if (this.positionHistory.length > this.maxHistoryLength) {
      this.positionHistory.shift();
    }

    // Calculer la distance vers la destination
    const distance = this.calculateDistanceToDestination(position);

    // Calculer les métriques de mouvement
    const metrics = this.calculateMovementMetrics(position);

    // Appeler le callback de mise à jour
    if (this.callbacks.onPositionUpdate) {
      this.callbacks.onPositionUpdate(position, distance, metrics);
    }

    if (this.callbacks.onDistanceChange) {
      this.callbacks.onDistanceChange(distance);
    }

    // *** VÉRIFICATION DE L'ARRIVÉE ***
    this.checkArrival(distance, position);
  }

  // Vérifier si on est arrivé dans la zone
  checkArrival(distance, position) {
    const now = Date.now();

    // Si déjà alerté dans les 30 dernières secondes, ne pas répéter
    if (now - this.lastAlertTime < 30000) {
      return;
    }

    // Vérifier si on est dans la zone d'alerte
    if (distance <= this.alertZoneRadius) {
      console.log(`🎯 DANS LA ZONE ! Distance: ${distance}m, Rayon: ${this.alertZoneRadius}m`);

      this.lastAlertTime = now;
      this.hasTriggeredAlert = true;

      if (this.callbacks.onArrival) {
        this.callbacks.onArrival(distance, position);
      }
    }
  }

  // Calculer la distance vers la destination
  calculateDistanceToDestination(position) {
    if (!this.destination) return null;

    return this.calculateDistance(
      position.coords.latitude,
      position.coords.longitude,
      this.destination.lat,
      this.destination.lng
    );
  }

  // Calculer les métriques de mouvement (vitesse, direction, altitude)
  calculateMovementMetrics(position) {
    const metrics = {
      speed: null,
      speedKmh: null,
      heading: null,
      headingText: null,
      altitude: null,
      accuracy: position.coords.accuracy,
      isAccurate: position.coords.accuracy < 100
    };

    // Vitesse depuis le GPS
    if (position.coords.speed !== null && position.coords.speed >= 0) {
      metrics.speed = position.coords.speed; // m/s
      metrics.speedKmh = Math.round(position.coords.speed * 3.6); // km/h
    } else if (this.previousPosition && this.positionHistory.length >= 2) {
      // Calculer la vitesse manuellement
      const speed = this.calculateSpeed();
      if (speed !== null) {
        metrics.speed = speed;
        metrics.speedKmh = Math.round(speed * 3.6);
      }
    }

    // Direction depuis le GPS
    if (position.coords.heading !== null && !isNaN(position.coords.heading)) {
      metrics.heading = position.coords.heading;
      metrics.headingText = this.getHeadingText(position.coords.heading);
    } else if (this.positionHistory.length >= 2) {
      // Calculer la direction manuellement
      const heading = this.calculateHeading();
      if (heading !== null) {
        metrics.heading = heading;
        metrics.headingText = this.getHeadingText(heading);
      }
    }

    // Altitude
    if (position.coords.altitude !== null) {
      metrics.altitude = Math.round(position.coords.altitude);
    }

    return metrics;
  }

  // Calculer la vitesse manuellement
  calculateSpeed() {
    if (this.positionHistory.length < 2) return null;

    const recent = this.positionHistory[this.positionHistory.length - 1];
    const previous = this.positionHistory[this.positionHistory.length - 2];

    const distance = this.calculateDistance(
      previous.lat, previous.lng,
      recent.lat, recent.lng
    );

    const timeDiff = (recent.timestamp - previous.timestamp) / 1000; // secondes

    if (timeDiff <= 0) return null;

    return distance / timeDiff; // m/s
  }

  // Calculer la direction manuellement
  calculateHeading() {
    if (this.positionHistory.length < 2) return null;

    const recent = this.positionHistory[this.positionHistory.length - 1];
    const previous = this.positionHistory[this.positionHistory.length - 2];

    return this.calculateBearing(
      previous.lat, previous.lng,
      recent.lat, recent.lng
    );
  }

  // Calculer le cap (bearing) entre deux points
  calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = this.toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(this.toRad(lat2));
    const x = Math.cos(this.toRad(lat1)) * Math.sin(this.toRad(lat2)) -
              Math.sin(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.cos(dLon);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  // Convertir le cap en texte
  getHeadingText(heading) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    const index = Math.round(heading / 45) % 8;
    return directions[index];
  }

  // Calculer la distance entre deux points (Haversine)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Rayon de la Terre en mètres
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  // Estimer le temps d'arrivée
  estimateArrivalTime(distance, speedKmh) {
    if (!speedKmh || speedKmh < 1) {
      // Estimer avec une vitesse moyenne de marche (5 km/h)
      const walkingSpeed = 5;
      const hours = distance / 1000 / walkingSpeed;
      const minutes = Math.round(hours * 60);
      return { minutes, estimated: true, method: 'walking' };
    }

    const hours = distance / 1000 / speedKmh;
    const minutes = Math.round(hours * 60);
    return { minutes, estimated: false, method: 'current_speed' };
  }

  // Convertir degrés en radians
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Gérer les erreurs GPS
  handleError(error) {
    const errorInfo = {
      code: error.code,
      message: this.getErrorMessage(error)
    };

    console.error('Erreur GPS:', errorInfo);

    if (this.callbacks.onError) {
      this.callbacks.onError(errorInfo);
    }

    return errorInfo;
  }

  // Message d'erreur clair
  getErrorMessage(error) {
    switch (error.code) {
      case 1: // PERMISSION_DENIED
        return '📍 Permission GPS refusée.\n\nPour activer :\n• iOS : Réglages > Confidentialité > Services de localisation\n• Android : Paramètres > Position\n• Navigateur : Cliquez sur l\'icône 🔒 dans la barre d\'adresse';
      case 2: // POSITION_UNAVAILABLE
        return '📍 Position GPS indisponible.\n\nVérifiez que :\n• Le GPS est activé\n• Vous êtes à l\'extérieur ou près d\'une fenêtre\n• Le mode avion est désactivé';
      case 3: // TIMEOUT
        return '📍 Délai GPS dépassé.\n\nLe signal GPS est faible. Essayez :\n• D\'aller à l\'extérieur\n• D\'attendre quelques secondes\n• De redémarrer l\'application';
      default:
        return '📍 Erreur de géolocalisation inconnue';
    }
  }

  // Obtenir la distance actuelle
  getCurrentDistance() {
    if (!this.currentPosition || !this.destination) return null;
    return this.calculateDistanceToDestination(this.currentPosition);
  }

  // Obtenir les métriques actuelles
  getCurrentMetrics() {
    if (!this.currentPosition) return null;
    return this.calculateMovementMetrics(this.currentPosition);
  }

  // Vérifier si le GPS est précis
  isGPSAccurate() {
    if (!this.currentPosition) return false;
    return this.currentPosition.coords.accuracy < 100; // Moins de 100m = précis
  }

  // Forcer une nouvelle lecture GPS
  async refreshPosition() {
    try {
      const position = await this.getCurrentPosition(true);
      this.handlePositionUpdate(position);
      return position;
    } catch (error) {
      throw error;
    }
  }
}

// Instance globale
const geolocationService = new GeolocationService();
