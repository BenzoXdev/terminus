// Service de géolocalisation pour Terminus
class GeolocationService {
  constructor() {
    this.watchId = null;
    this.currentPosition = null;
    this.destination = null;
    this.callbacks = {
      onPositionUpdate: null,
      onDistanceChange: null,
      onArrival: null
    };
    this.isTracking = false;
  }

  // Demander l'autorisation et démarrer le suivi
  async startTracking(destination, callbacks = {}) {
    if (!navigator.geolocation) {
      throw new Error('La géolocalisation n\'est pas supportée par votre navigateur');
    }

    this.destination = destination;
    this.callbacks = { ...this.callbacks, ...callbacks };

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.currentPosition = position;
          this.isTracking = true;
          this.watchId = navigator.geolocation.watchPosition(
            (pos) => this.handlePositionUpdate(pos),
            (error) => this.handleError(error),
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            }
          );
          resolve(position);
        },
        (error) => {
          reject(this.handleError(error));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  // Arrêter le suivi
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isTracking = false;
    }
  }

  // Gérer les mises à jour de position
  handlePositionUpdate(position) {
    this.currentPosition = position;
    const distance = this.calculateDistance(
      position.coords.latitude,
      position.coords.longitude,
      this.destination.lat,
      this.destination.lng
    );

    if (this.callbacks.onPositionUpdate) {
      this.callbacks.onPositionUpdate(position, distance);
    }

    if (this.callbacks.onDistanceChange) {
      this.callbacks.onDistanceChange(distance);
    }

    // Vérifier si on est arrivé à destination
    const settings = storageService.getSettings();
    if (distance <= settings.alertDistance && this.callbacks.onArrival) {
      this.callbacks.onArrival(distance);
    }
  }

  // Gérer les erreurs
  handleError(error) {
    let message = 'Erreur de géolocalisation';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = 'Permission de géolocalisation refusée';
        break;
      case error.POSITION_UNAVAILABLE:
        message = 'Position indisponible';
        break;
      case error.TIMEOUT:
        message = 'Délai d\'attente dépassé';
        break;
    }
    console.error('Erreur géolocalisation:', message);
    return { message, code: error.code };
  }

  // Calculer la distance entre deux points (formule de Haversine)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Rayon de la Terre en mètres
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return Math.round(distance);
  }

  // Convertir degrés en radians
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Obtenir la position actuelle (une seule fois)
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Géolocalisation non supportée'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        (error) => reject(this.handleError(error)),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  // Obtenir la distance actuelle vers la destination
  getCurrentDistance() {
    if (!this.currentPosition || !this.destination) {
      return null;
    }
    return this.calculateDistance(
      this.currentPosition.coords.latitude,
      this.currentPosition.coords.longitude,
      this.destination.lat,
      this.destination.lng
    );
  }
}

// Instance globale
const geolocationService = new GeolocationService();

