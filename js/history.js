// Service d'historique des trajets pour Terminus
class HistoryService {
  constructor() {
    this.storageKey = 'terminus_history';
    this.maxHistorySize = 100; // Garder les 100 derniers trajets
  }

  // Sauvegarder un trajet terminé
  saveTrip(tripData) {
    const trips = this.getAllTrips();
    
    const trip = {
      id: this.generateId(),
      startTime: tripData.startTime || Date.now(),
      endTime: tripData.endTime || Date.now(),
      startLocation: {
        lat: tripData.startLat,
        lng: tripData.startLng,
        address: tripData.startAddress || 'Position de départ'
      },
      endLocation: {
        lat: tripData.endLat,
        lng: tripData.endLng,
        address: tripData.endAddress || 'Destination'
      },
      distance: tripData.distance || 0, // en mètres
      duration: tripData.duration || 0, // en secondes
      averageSpeed: tripData.averageSpeed || 0, // en km/h
      maxSpeed: tripData.maxSpeed || 0,
      transportMode: tripData.transportMode || 'unknown',
      notes: tripData.notes || '',
      createdAt: Date.now()
    };

    trips.unshift(trip); // Ajouter au début

    // Limiter la taille
    if (trips.length > this.maxHistorySize) {
      trips.splice(this.maxHistorySize);
    }

    this.saveTrips(trips);
    return trip;
  }

  // Obtenir tous les trajets
  getAllTrips() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Erreur lecture historique:', e);
      return [];
    }
  }

  // Sauvegarder les trajets
  saveTrips(trips) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(trips));
    } catch (e) {
      console.error('Erreur sauvegarde historique:', e);
      // Si quota dépassé, supprimer les plus anciens
      if (e.name === 'QuotaExceededError') {
        const reduced = trips.slice(0, Math.floor(trips.length / 2));
        localStorage.setItem(this.storageKey, JSON.stringify(reduced));
      }
    }
  }

  // Obtenir un trajet par ID
  getTripById(id) {
    const trips = this.getAllTrips();
    return trips.find(t => t.id === id);
  }

  // Supprimer un trajet
  deleteTrip(id) {
    const trips = this.getAllTrips();
    const filtered = trips.filter(t => t.id !== id);
    this.saveTrips(filtered);
    return filtered.length < trips.length;
  }

  // Supprimer tous les trajets
  clearHistory() {
    localStorage.removeItem(this.storageKey);
  }

  // Obtenir les statistiques
  getStatistics() {
    const trips = this.getAllTrips();
    
    if (trips.length === 0) {
      return {
        totalTrips: 0,
        totalDistance: 0,
        totalDistanceKm: 0,
        totalDuration: 0,
        averageDistance: 0,
        averageDuration: 0,
        averageSpeed: 0,
        longestTrip: null,
        fastestTrip: null,
        tripsByMonth: {},
        totalTimeSaved: 0 // Estimation basée sur vitesse moyenne
      };
    }

    const totalDistance = trips.reduce((sum, t) => sum + (t.distance || 0), 0);
    const totalDuration = trips.reduce((sum, t) => sum + (t.duration || 0), 0);
    const totalSpeed = trips.reduce((sum, t) => sum + (t.averageSpeed || 0), 0);

    // Trouver le plus long trajet
    const longestTrip = trips.reduce((max, t) => 
      (t.distance || 0) > (max.distance || 0) ? t : max, trips[0]);

    // Trouver le trajet le plus rapide
    const fastestTrip = trips.reduce((max, t) => 
      (t.maxSpeed || 0) > (max.maxSpeed || 0) ? t : max, trips[0]);

    // Grouper par mois
    const tripsByMonth = {};
    trips.forEach(trip => {
      const date = new Date(trip.startTime);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!tripsByMonth[monthKey]) {
        tripsByMonth[monthKey] = { count: 0, distance: 0 };
      }
      tripsByMonth[monthKey].count++;
      tripsByMonth[monthKey].distance += trip.distance || 0;
    });

    // Estimation du temps économisé (basé sur une vitesse de marche de 5 km/h)
    const walkingSpeed = 5; // km/h
    const totalTimeSaved = trips.reduce((sum, trip) => {
      const distanceKm = (trip.distance || 0) / 1000;
      const walkingTime = distanceKm / walkingSpeed; // heures
      const actualTime = (trip.duration || 0) / 3600; // heures
      return sum + Math.max(0, walkingTime - actualTime);
    }, 0);

    return {
      totalTrips: trips.length,
      totalDistance,
      totalDistanceKm: Math.round(totalDistance / 10) / 100, // arrondi à 10m près
      totalDuration,
      averageDistance: Math.round(totalDistance / trips.length),
      averageDuration: Math.round(totalDuration / trips.length),
      averageSpeed: trips.length > 0 ? Math.round(totalSpeed / trips.length) : 0,
      longestTrip,
      fastestTrip,
      tripsByMonth,
      totalTimeSaved: Math.round(totalTimeSaved * 60) // en minutes
    };
  }

  // Obtenir les trajets d'une période
  getTripsByDateRange(startDate, endDate) {
    const trips = this.getAllTrips();
    return trips.filter(trip => {
      const tripDate = new Date(trip.startTime);
      return tripDate >= startDate && tripDate <= endDate;
    });
  }

  // Obtenir les trajets du mois
  getTripsThisMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return this.getTripsByDateRange(start, end);
  }

  // Exporter l'historique en JSON
  exportHistory() {
    const trips = this.getAllTrips();
    const stats = this.getStatistics();
    
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      statistics: stats,
      trips: trips
    };

    return JSON.stringify(exportData, null, 2);
  }

  // Importer l'historique depuis JSON
  importHistory(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.trips && Array.isArray(data.trips)) {
        // Fusionner avec l'historique existant
        const existing = this.getAllTrips();
        const merged = [...data.trips, ...existing];
        
        // Dédupliquer par ID
        const unique = merged.filter((trip, index, self) =>
          index === self.findIndex(t => t.id === trip.id)
        );
        
        this.saveTrips(unique);
        return { success: true, imported: data.trips.length };
      }
      return { success: false, message: 'Format invalide' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  // Formater la durée
  formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0 min';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    } else if (minutes > 0) {
      return `${minutes}min ${secs > 0 ? secs + 's' : ''}`;
    } else {
      return `${secs}s`;
    }
  }

  // Formater la distance
  formatDistance(meters) {
    if (!meters || meters < 0) return '0 m';
    
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    } else {
      return `${Math.round(meters)} m`;
    }
  }

  // Formater la date
  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return "Aujourd'hui";
    } else if (days === 1) {
      return "Hier";
    } else if (days < 7) {
      return `Il y a ${days} jours`;
    } else {
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  }

  // Générer un ID unique
  generateId() {
    return `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Instance globale
const historyService = new HistoryService();

