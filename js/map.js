// Service de carte pour Terminus
class MapService {
  constructor() {
    this.map = null;
    this.marker = null;
    this.destinationMarker = null;
    this.routeLine = null;
    this.zoneCircle = null;
    this.isInitialized = false;
    this.isSelecting = false;
  }

  // Initialiser la carte
  init(containerId, options = {}) {
    if (this.isInitialized) {
      return;
    }

    const defaultOptions = {
      center: [45.5017, -73.5673], // Montréal par défaut
      zoom: 10,
      ...options
    };

    // Créer la carte Leaflet
    this.map = L.map(containerId, {
      center: defaultOptions.center,
      zoom: defaultOptions.zoom,
      zoomControl: false, // On utilise nos propres contrôles
      attributionControl: true
    });

    // Ajouter la couche OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(this.map);

    this.isInitialized = true;

    // Observer les changements de thème pour le style de carte
    const observer = new MutationObserver(() => {
      this.updateMapStyle();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    this.updateMapStyle();
  }

  updateMapStyle() {
    // Appliquer un filtre pour le mode sombre
    const container = this.map?.getContainer();
    if (container) {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const tiles = container.querySelectorAll('.leaflet-tile-container');
      tiles.forEach(tile => {
        tile.style.filter = isDark ? 'brightness(0.85) contrast(1.1) saturate(0.9)' : 'none';
      });
    }
  }

  // Centrer la carte sur une position
  setCenter(lat, lng, zoom = null) {
    if (!this.map) return;

    if (zoom) {
      this.map.setView([lat, lng], zoom);
    } else {
      this.map.setView([lat, lng]);
    }
  }

  // Ajouter un marqueur de position actuelle
  updateCurrentPosition(lat, lng) {
    if (!this.map) return;

    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      // Créer un marqueur avec icône personnalisée
      const customIcon = L.divIcon({
        className: 'current-position-marker',
        html: `
          <div class="position-dot" style="
            width: 18px;
            height: 18px;
            background: linear-gradient(135deg, #00d9ff, #0099cc);
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 10px rgba(0, 217, 255, 0.5);
          "></div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      this.marker = L.marker([lat, lng], { icon: customIcon })
        .addTo(this.map);
    }
  }

  // Ajouter un marqueur de destination
  setDestination(lat, lng, name = 'Destination') {
    if (!this.map) return;

    // Supprimer l'ancien marqueur de destination
    if (this.destinationMarker) {
      this.map.removeLayer(this.destinationMarker);
    }

    // Créer un marqueur de destination SVG
    const destinationIcon = L.divIcon({
      className: 'destination-marker',
      html: `
        <svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 0C8.06 0 0 8.06 0 18C0 31.5 18 48 18 48S36 31.5 36 18C36 8.06 27.94 0 18 0Z" fill="#00d9ff"/>
          <circle cx="18" cy="18" r="8" fill="white"/>
          <circle cx="18" cy="18" r="4" fill="#00d9ff"/>
        </svg>
      `,
      iconSize: [36, 48],
      iconAnchor: [18, 48],
      popupAnchor: [0, -48]
    });

    this.destinationMarker = L.marker([lat, lng], {
      icon: destinationIcon,
      draggable: true
    }).addTo(this.map);

    // Ajouter un popup
    const shortName = name.split(',')[0];
    this.destinationMarker.bindPopup(`
      <div style="text-align: center; padding: 5px;">
        <strong style="color: #00d9ff;">📍 ${shortName}</strong>
      </div>
    `);

    // Gérer le déplacement du marqueur
    this.destinationMarker.on('dragend', (e) => {
      const position = e.target.getLatLng();
      if (window.app) {
        this.reverseGeocode(position.lat, position.lng).then(result => {
          if (result) {
            window.app.setDestination(result);
          }
        });
      }
    });
  }

  // Mettre à jour le cercle de zone
  updateZoneCircle(lat, lng, radius) {
    if (!this.map) return;

    // Supprimer l'ancien cercle
    if (this.zoneCircle) {
      this.map.removeLayer(this.zoneCircle);
    }

    // Créer un nouveau cercle
    this.zoneCircle = L.circle([lat, lng], {
      radius: radius,
      color: '#00d9ff',
      fillColor: '#00d9ff',
      fillOpacity: 0.1,
      weight: 2,
      dashArray: '8, 4'
    }).addTo(this.map);
  }

  // Mettre à jour la ligne de route
  updateRoute(currentLat, currentLng, destLat, destLng) {
    if (!this.map) return;

    // Supprimer l'ancienne ligne
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
    }

    // Créer une nouvelle ligne
    this.routeLine = L.polyline(
      [[currentLat, currentLng], [destLat, destLng]],
      {
        color: '#00d9ff',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10'
      }
    ).addTo(this.map);
  }

  // Gérer les clics sur la carte pour définir une destination
  enableDestinationSelection(callback) {
    if (!this.map) return;

    this.isSelecting = true;
    this.map.getContainer().style.cursor = 'crosshair';

    this.selectionHandler = (e) => {
      const { lat, lng } = e.latlng;
      callback(lat, lng);
    };

    this.map.on('click', this.selectionHandler);
  }

  // Désactiver la sélection de destination
  disableDestinationSelection() {
    if (!this.map) return;

    this.isSelecting = false;
    this.map.getContainer().style.cursor = '';

    if (this.selectionHandler) {
      this.map.off('click', this.selectionHandler);
      this.selectionHandler = null;
    }
  }

  // Obtenir les coordonnées depuis une adresse (géocodage)
  async geocodeAddress(address, userLocation = null) {
    try {
      // Construire l'URL avec biais de localisation si disponible
      let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`;

      // Ajouter un biais de localisation si on a la position de l'utilisateur
      if (userLocation) {
        url += `&viewbox=${userLocation.lng - 2},${userLocation.lat + 2},${userLocation.lng + 2},${userLocation.lat - 2}&bounded=0`;
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Terminus App (https://github.com/benzoXdev/terminus)',
          'Accept-Language': 'fr,en'
        }
      });

      const data = await response.json();

      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          name: data[0].display_name,
          address: data[0].display_name
        };
      }

      return null;
    } catch (error) {
      console.error('Erreur géocodage:', error);
      return null;
    }
  }

  // Recherche d'adresses (autocomplétion) avec priorité locale
  async searchAddresses(query, userLocation = null) {
    if (query.length < 2) {
      return [];
    }

    try {
      // Construire l'URL avec biais de localisation
      let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&addressdetails=1`;

      // Ajouter un biais de localisation pour prioriser les résultats locaux
      if (userLocation) {
        url += `&viewbox=${userLocation.lng - 3},${userLocation.lat + 3},${userLocation.lng + 3},${userLocation.lat - 3}&bounded=0`;
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Terminus App (https://github.com/benzoXdev/terminus)',
          'Accept-Language': 'fr,en'
        }
      });

      const data = await response.json();

      return data.map(item => ({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        name: item.display_name,
        address: item.display_name,
        type: item.type
      }));
    } catch (error) {
      console.error('Erreur recherche adresse:', error);
      return [];
    }
  }

  // Rechercher des lieux à proximité
  async searchNearby(type, userLocation) {
    if (!userLocation) return [];

    try {
      // Rechercher avec le type et la localisation
      const query = `${type}`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=3&addressdetails=1&viewbox=${userLocation.lng - 0.5},${userLocation.lat + 0.5},${userLocation.lng + 0.5},${userLocation.lat - 0.5}&bounded=1`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Terminus App (https://github.com/benzoXdev/terminus)',
          'Accept-Language': 'fr,en'
        }
      });

      const data = await response.json();

      return data.map(item => ({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        name: item.display_name,
        address: item.display_name,
        type: item.type
      }));
    } catch (error) {
      console.error('Erreur recherche à proximité:', error);
      return [];
    }
  }

  // Obtenir l'adresse depuis des coordonnées (géocodage inverse)
  async reverseGeocode(lat, lng) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'Terminus App (https://github.com/benzoXdev/terminus)',
            'Accept-Language': 'fr,en'
          }
        }
      );

      const data = await response.json();

      if (data && data.display_name) {
        return {
          lat: lat,
          lng: lng,
          name: data.display_name,
          address: data.display_name
        };
      }

      return null;
    } catch (error) {
      console.error('Erreur géocodage inverse:', error);
      return null;
    }
  }

  // Ajuster la vue pour montrer tous les marqueurs
  fitBounds() {
    if (!this.map) return;

    const bounds = [];

    if (this.marker) {
      bounds.push(this.marker.getLatLng());
    }

    if (this.destinationMarker) {
      bounds.push(this.destinationMarker.getLatLng());
    }

    if (bounds.length >= 2) {
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  // Nettoyer la carte
  clear() {
    if (this.destinationMarker) {
      this.map.removeLayer(this.destinationMarker);
      this.destinationMarker = null;
    }
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }
    if (this.zoneCircle) {
      this.map.removeLayer(this.zoneCircle);
      this.zoneCircle = null;
    }
  }

  // Détruire la carte
  destroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.isInitialized = false;
    }
  }
}

// Instance globale
const mapService = new MapService();
