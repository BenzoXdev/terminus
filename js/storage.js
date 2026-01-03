// Service de stockage local pour Terminus
class StorageService {
  constructor() {
    this.storageKey = 'terminus_data';
    this.defaultData = {
      favorites: [],
      settings: {
        alertDistance: 1000,
        alertType: 'all',
        soundType: 'classic',
        theme: 'dark'
      }
    };
    this.init();
  }

  init() {
    if (!this.getData()) {
      this.saveData(this.defaultData);
    }
  }

  getData() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Erreur lors de la lecture du stockage:', error);
      return null;
    }
  }

  saveData(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      return false;
    }
  }

  // Gestion des favoris
  getFavorites() {
    const data = this.getData();
    return data ? data.favorites : [];
  }

  addFavorite(favorite) {
    const data = this.getData();
    if (!data) return false;

    // Vérifier si le favori existe déjà
    const exists = data.favorites.some(fav =>
      Math.abs(fav.lat - favorite.lat) < 0.0001 &&
      Math.abs(fav.lng - favorite.lng) < 0.0001
    );

    if (!exists) {
      favorite.id = Date.now().toString();
      favorite.createdAt = new Date().toISOString();
      data.favorites.push(favorite);
      return this.saveData(data);
    }
    return false;
  }

  removeFavorite(id) {
    const data = this.getData();
    if (!data) return false;

    data.favorites = data.favorites.filter(fav => fav.id !== id);
    return this.saveData(data);
  }

  // Gestion des paramètres
  getSettings() {
    const data = this.getData();
    return data ? { ...this.defaultData.settings, ...data.settings } : this.defaultData.settings;
  }

  updateSettings(newSettings) {
    const data = this.getData();
    if (!data) return false;

    data.settings = { ...data.settings, ...newSettings };
    return this.saveData(data);
  }

  // Gestion de la destination actuelle
  getCurrentDestination() {
    const data = this.getData();
    return data ? data.currentDestination : null;
  }

  setCurrentDestination(destination) {
    const data = this.getData();
    if (!data) return false;

    data.currentDestination = destination;
    return this.saveData(data);
  }

  clearCurrentDestination() {
    const data = this.getData();
    if (!data) return false;

    delete data.currentDestination;
    return this.saveData(data);
  }

  // Export des données
  exportData() {
    const data = this.getData();
    return JSON.stringify(data, null, 2);
  }

  // Import des données
  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      return this.saveData(data);
    } catch (error) {
      console.error('Erreur import:', error);
      return false;
    }
  }

  // Réinitialisation
  reset() {
    return this.saveData(this.defaultData);
  }
}

// Instance globale
const storageService = new StorageService();
