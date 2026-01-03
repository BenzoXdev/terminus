// Service de partage de position pour Terminus
class ShareService {
  constructor() {
    this.shareId = null;
    this.shareInterval = null;
    this.sharedPositions = [];
    this.maxSharedPositions = 100;
    this.shareExpiry = null;
  }

  // Générer un ID de partage unique
  generateShareId() {
    return `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Démarrer le partage de position
  async startSharing(options = {}) {
    const shareId = this.generateShareId();
    this.shareId = shareId;

    const duration = options.duration || 3600000; // 1h par défaut
    this.shareExpiry = Date.now() + duration;

    // Sauvegarder les infos de partage
    const shareData = {
      id: shareId,
      startTime: Date.now(),
      expiry: this.shareExpiry,
      destination: options.destination || null,
      isActive: true
    };

    localStorage.setItem(`terminus_share_${shareId}`, JSON.stringify(shareData));

    // Démarrer la mise à jour de position
    this.shareInterval = setInterval(() => {
      this.updateSharedPosition(shareId);
    }, 5000); // Mise à jour toutes les 5 secondes

    // Première mise à jour immédiate
    await this.updateSharedPosition(shareId);

    return {
      shareId,
      shareUrl: this.getShareUrl(shareId),
      expiresAt: new Date(this.shareExpiry)
    };
  }

  // Mettre à jour la position partagée
  async updateSharedPosition(shareId) {
    try {
      // Obtenir la position actuelle
      const position = await geolocationService.getCurrentPosition();
      if (!position) return;

      const posData = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed || 0,
        heading: position.coords.heading || null,
        timestamp: Date.now()
      };

      // Charger les positions existantes
      const shareData = this.getShareData(shareId);
      if (!shareData) return;

      shareData.positions = shareData.positions || [];
      shareData.positions.push(posData);

      // Limiter le nombre de positions
      if (shareData.positions.length > this.maxSharedPositions) {
        shareData.positions.shift();
      }

      shareData.lastUpdate = Date.now();
      shareData.isActive = true;

      // Sauvegarder
      localStorage.setItem(`terminus_share_${shareId}`, JSON.stringify(shareData));

    } catch (error) {
      console.error('Erreur mise à jour position partagée:', error);
    }
  }

  // Arrêter le partage
  stopSharing() {
    if (this.shareInterval) {
      clearInterval(this.shareInterval);
      this.shareInterval = null;
    }

    if (this.shareId) {
      const shareData = this.getShareData(this.shareId);
      if (shareData) {
        shareData.isActive = false;
        localStorage.setItem(`terminus_share_${this.shareId}`, JSON.stringify(shareData));
      }
      this.shareId = null;
    }
  }

  // Obtenir les données de partage
  getShareData(shareId) {
    try {
      const data = localStorage.getItem(`terminus_share_${shareId}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  // Obtenir l'URL de partage
  getShareUrl(shareId) {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?share=${shareId}`;
  }

  // Vérifier si on est en mode visualisation
  isViewingShare() {
    const params = new URLSearchParams(window.location.search);
    return params.has('share');
  }

  // Obtenir l'ID de partage depuis l'URL
  getShareIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('share');
  }

  // Obtenir les positions partagées pour visualisation
  getSharedPositions(shareId) {
    const shareData = this.getShareData(shareId);
    if (!shareData || !shareData.isActive) {
      return null;
    }

    // Vérifier l'expiration
    if (shareData.expiry && Date.now() > shareData.expiry) {
      return null;
    }

    return {
      shareId: shareData.id,
      startTime: shareData.startTime,
      lastUpdate: shareData.lastUpdate,
      positions: shareData.positions || [],
      destination: shareData.destination,
      isActive: shareData.isActive
    };
  }

  // Formater le temps restant
  formatTimeRemaining(expiry) {
    if (!expiry) return '';
    
    const remaining = expiry - Date.now();
    if (remaining <= 0) return 'Expiré';

    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    } else {
      return `${minutes}min`;
    }
  }

  // Partager via les APIs natives
  async shareViaNative(options) {
    const shareData = {
      title: '📍 Terminus - Suivez ma position',
      text: 'Je suis en route ! Suivez ma position en temps réel.',
      url: options.shareUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return { success: true, method: 'native' };
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('Erreur partage natif:', e);
        }
      }
    }

    // Fallback : copier dans le presse-papier
    try {
      await navigator.clipboard.writeText(options.shareUrl);
      return { success: true, method: 'clipboard' };
    } catch (e) {
      return { success: false, message: 'Impossible de partager' };
    }
  }

  // Créer un lien de partage court (via service tiers si disponible)
  async createShortLink(url) {
    // Pour l'instant, retourner l'URL complète
    // Pourrait utiliser un service comme tinyurl.com, bit.ly, etc.
    return url;
  }
}

// Instance globale
const shareService = new ShareService();

