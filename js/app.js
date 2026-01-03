// Application principale Terminus
class TerminusApp {
  constructor() {
    this.currentDestination = null;
    this.isTracking = false;
    this.autocompleteTimeout = null;
    this.initialDistance = null;
    this.zoneRadius = 1000;
    this.lastPositions = [];
    this.currentSpeed = 0;
    this.nearbyPlaces = [];
    this.userLocation = null;
    this.userInfo = null;
    this.units = 'metric';
    this.activeSearchTab = 'address';
    this.timeUpdateInterval = null;
    this.currentSearchResults = [];
    this.deferredInstallPrompt = null;

    this.init();
  }

  async init() {
    this.initTheme();
    mapService.init('map');
    this.loadSettings();

    const savedDestination = storageService.getCurrentDestination();
    if (savedDestination) {
      this.setDestination(savedDestination);
    }

    this.setupEventListeners();
    await this.loadUserInfo();
    this.startTimeUpdate();
    this.loadNearbyRecommendations();
    this.loadNearbyTransport();
  }

  // ===== USER INFO =====
  async loadUserInfo() {
    this.updateLocationDisplay('📍 Recherche...');

    try {
      // Obtenir les infos utilisateur complètes avec plusieurs fallbacks
      this.userInfo = await userInfoService.getUserInfo(true);
      this.userLocation = this.userInfo.position;

      // Construire l'affichage de la position
      const loc = this.userInfo.location;
      let locationParts = [];

      // Ajouter quartier si disponible
      if (loc.neighbourhood) locationParts.push(loc.neighbourhood);

      // Ajouter ville
      if (loc.city) locationParts.push(loc.city);

      // Ajouter région si différente de la ville
      if (loc.region && loc.region !== loc.city) {
        locationParts.push(loc.region);
      }

      // Construire le texte final
      let locationText = locationParts.length > 0
        ? locationParts.join(', ')
        : userInfoService.formatLocationDisplay();

      // Ajouter le drapeau du pays
      if (loc.countryCode) {
        const flag = userInfoService.getCountryFlag(loc.countryCode);
        locationText = `${flag} ${locationText}`;
      }

      this.updateLocationDisplay(locationText);

      // Afficher les coordonnées formatées
      const coords = userInfoService.formatPosition(this.userLocation.lat, this.userLocation.lng);
      document.getElementById('userCoordsText').textContent = coords;

      // Indicateur de source
      const sourceIndicator = this.userLocation.source === 'gps' ? '🛰️' : '🌐';
      const accuracyText = this.userLocation.accuracy
        ? ` (±${Math.round(this.userLocation.accuracy)}m)`
        : '';

      // Centrer la carte
      mapService.setCenter(this.userLocation.lat, this.userLocation.lng, 13);
      mapService.updateCurrentPosition(this.userLocation.lat, this.userLocation.lng);

      // Afficher les détails
      this.updateUserDetails();

      // Charger la météo
      await this.loadWeather();

      console.log(`Position: ${sourceIndicator} ${locationText}${accuracyText}`);

    } catch (error) {
      console.error('Erreur chargement infos:', error);
      this.updateLocationDisplay('📍 Position inconnue');

      // Essayer de centrer sur une position par défaut
      const defaultPos = { lat: 45.5017, lng: -73.5673 };
      mapService.setCenter(defaultPos.lat, defaultPos.lng, 10);
    }
  }

  updateLocationDisplay(text) {
    document.getElementById('userLocationText').textContent = text;
  }

  updateUserDetails() {
    if (!this.userInfo) return;

    const loc = this.userInfo.location;
    const device = this.userInfo.device;
    const pos = this.userInfo.position;

    // Région avec icône
    const regionEl = document.getElementById('userRegion');
    if (regionEl) {
      regionEl.textContent = loc.region || loc.district || '--';
    }

    // Pays avec drapeau
    const countryEl = document.getElementById('userCountry');
    const countryIconEl = document.getElementById('countryIcon');
    if (countryEl) {
      const flag = this.getCountryFlag(loc.countryCode);
      countryEl.textContent = loc.country || '--';
      // Mettre à jour l'icône avec le drapeau du pays
      if (countryIconEl && flag) {
        countryIconEl.textContent = flag;
      }
    }

    // Fuseau horaire - afficher la ville locale, pas une autre ville
    const tzEl = document.getElementById('userTimezone');
    if (tzEl && loc.timezone) {
      // Utiliser la ville locale si disponible, sinon le fuseau
      let tzDisplay = '';
      if (loc.city) {
        tzDisplay = loc.city;
      } else {
        // Prendre la dernière partie du fuseau et formater
        tzDisplay = loc.timezone.split('/').pop().replace(/_/g, ' ');
      }
      tzEl.textContent = tzDisplay;
      tzEl.title = `Fuseau: ${loc.timezone}`;
    }

    // Code postal
    const postcodeEl = document.getElementById('userPostcode');
    if (postcodeEl) {
      postcodeEl.textContent = loc.postcode || '--';
    }

    // Précision GPS avec indicateur clair
    const accuracyEl = document.getElementById('userAccuracy');
    if (accuracyEl) {
      if (pos.source === 'ip') {
        // Localisation par IP - précision approximative, pas une erreur
        accuracyEl.innerHTML = '<span title="Localisation approximative via votre adresse IP">🌐 Via IP (approx.)</span>';
      } else if (pos.accuracy) {
        const accuracy = Math.round(pos.accuracy);
        let qualityIcon = '🟢'; // Excellent < 10m
        let qualityText = 'Excellent';
        if (accuracy > 100) {
          qualityIcon = '🟡';
          qualityText = 'Bon';
        }
        if (accuracy > 500) {
          qualityIcon = '🟠';
          qualityText = 'Moyen';
        }
        if (accuracy > 1000) {
          qualityIcon = '🔴';
          qualityText = 'Faible';
        }
        accuracyEl.innerHTML = `<span title="${qualityText}">${qualityIcon} ±${accuracy}m</span>`;
      } else {
        accuracyEl.textContent = '--';
      }
    }

    // Appareil avec emoji
    const deviceEl = document.getElementById('userDevice');
    if (deviceEl) {
      const typeEmoji = device.typeEmoji || '💻';
      deviceEl.textContent = `${typeEmoji} ${device.os}`;
    }
  }

  async loadWeather() {
    if (!this.userLocation) return;

    try {
      const weather = await userInfoService.getWeather(this.userLocation.lat, this.userLocation.lng);
      if (weather) {
        const weatherEl = document.getElementById('userWeather');
        weatherEl.innerHTML = `${weather.weatherIcon} ${Math.round(weather.temperature)}°C`;
        weatherEl.title = weather.weatherDescription;
      }
    } catch (error) {
      console.log('Météo indisponible');
    }
  }

  startTimeUpdate() {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      document.getElementById('userTime').textContent = timeStr;
    };

    updateTime();
    this.timeUpdateInterval = setInterval(updateTime, 1000);
  }

  getCountryFlag(countryCode) {
    if (!countryCode) return '';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }

  // ===== THEME MANAGEMENT =====
  initTheme() {
    const settings = storageService.getSettings();
    let theme = settings.theme || 'dark';
    this.units = settings.units || 'metric';

    if (theme === 'auto') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    this.setTheme(theme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      const settings = storageService.getSettings();
      if (settings.theme === 'auto') {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0a0e27' : '#f0f4f8');
    }
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
    storageService.updateSettings({ theme: newTheme });
  }

  setupEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
      this.toggleTheme();
    });

    // User info toggle
    document.getElementById('userInfoHeader').addEventListener('click', () => {
      this.toggleUserInfo();
    });

    // Search tabs
    document.querySelectorAll('.search-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchSearchTab(tab.dataset.tab);
      });
    });

    // Address search
    const addressInput = document.getElementById('addressInput');
    addressInput.addEventListener('input', (e) => {
      this.handleAddressInput(e.target.value);
    });

    addressInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.searchAddress(addressInput.value);
      }
    });

    addressInput.addEventListener('focus', () => {
      if (addressInput.value.length >= 2) {
        this.handleAddressInput(addressInput.value);
      }
    });

    document.getElementById('searchBtn').addEventListener('click', () => {
      this.searchAddress(addressInput.value);
    });

    // Coordinates search
    document.getElementById('searchCoordsBtn').addEventListener('click', () => {
      this.searchByCoordinates();
    });

    document.getElementById('latInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.searchByCoordinates();
    });

    document.getElementById('lngInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.searchByCoordinates();
    });

    // Postal code search
    document.getElementById('searchPostalBtn').addEventListener('click', () => {
      this.searchByPostalCode();
    });

    document.getElementById('postalInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.searchByPostalCode();
    });

    // Click outside to close autocomplete
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container') && !e.target.closest('.search-filters')) {
        this.hideAutocomplete();
        document.getElementById('searchFilters').style.display = 'none';
      }
    });

    // Filtres de recherche
    document.getElementById('sortByFilter')?.addEventListener('change', () => {
      this.applyFilters();
    });

    document.getElementById('categoryFilter')?.addEventListener('change', () => {
      this.applyFilters();
    });

    // Quick stations
    document.querySelectorAll('.station-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const stationName = btn.dataset.station;
        this.searchAddress(stationName);
      });
    });

    // Map controls
    document.getElementById('selectOnMapBtn').addEventListener('click', () => {
      this.enableMapSelection();
    });

    document.getElementById('centerMapBtn').addEventListener('click', () => {
      this.centerOnCurrentLocation();
    });

    document.getElementById('fitBoundsBtn').addEventListener('click', () => {
      mapService.fitBounds();
    });

    document.getElementById('zoomInBtn').addEventListener('click', () => {
      mapService.map?.zoomIn();
    });

    document.getElementById('zoomOutBtn').addEventListener('click', () => {
      mapService.map?.zoomOut();
    });

    // Zone radius slider
    document.getElementById('zoneRadiusSlider').addEventListener('input', (e) => {
      this.updateZoneRadius(parseInt(e.target.value));
    });

    // Tracking
    document.getElementById('startTrackingBtn').addEventListener('click', () => {
      this.startTracking();
    });

    document.getElementById('stopTrackingBtn').addEventListener('click', () => {
      this.stopTracking();
    });

    // Destination
    document.getElementById('removeDestinationBtn').addEventListener('click', () => {
      this.removeDestination();
    });

    document.getElementById('addToFavoritesBtn').addEventListener('click', () => {
      this.addToFavorites();
    });

    // Settings
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.openSettings();
    });

    document.getElementById('closeSettingsBtn').addEventListener('click', () => {
      this.closeSettings();
    });

    // Favorites
    document.getElementById('favoritesBtn').addEventListener('click', () => {
      this.openFavorites();
    });

    document.getElementById('closeFavoritesBtn').addEventListener('click', () => {
      this.closeFavorites();
    });

    // Settings selects
    document.getElementById('alertTypeSelect').addEventListener('change', (e) => {
      storageService.updateSettings({ alertType: e.target.value });
    });

    document.getElementById('soundTypeSelect').addEventListener('change', (e) => {
      storageService.updateSettings({ soundType: e.target.value });
    });

    document.getElementById('themeSelect').addEventListener('change', (e) => {
      const theme = e.target.value;
      storageService.updateSettings({ theme });
      if (theme === 'auto') {
        this.initTheme();
      } else {
        this.setTheme(theme);
      }
    });

    document.getElementById('unitsSelect').addEventListener('change', (e) => {
      this.units = e.target.value;
      storageService.updateSettings({ units: e.target.value });
      if (this.currentDestination) {
        this.updateTripInfo();
      }
    });

    // Test buttons
    document.getElementById('testSoundBtn')?.addEventListener('click', async () => {
      await alertService.forceEnableAudio();
      await alertService.testSound();
      this.showToast('🔊 Son testé', 'success');
    });

    document.getElementById('testVibrationBtn')?.addEventListener('click', () => {
      const success = alertService.testVibration();
      this.showToast(success ? '📳 Vibration testée' : '📳 Vibration non supportée', success ? 'success' : 'error');
    });

    document.getElementById('testNotificationBtn')?.addEventListener('click', async () => {
      const result = await alertService.testNotification();
      this.showToast(result.success ? '🔔 Notification envoyée' : '🔔 ' + result.message, result.success ? 'success' : 'error');
    });

    document.getElementById('testAllBtn')?.addEventListener('click', async () => {
      await alertService.forceEnableAudio();
      await alertService.triggerFullAlert({
        title: '🧪 Test Terminus',
        body: 'Toutes les alertes fonctionnent !',
        repeats: 1
      });
      this.showToast('⚡ Toutes les alertes testées', 'success');
    });

    // Volume slider
    document.getElementById('volumeSlider')?.addEventListener('input', (e) => {
      const volume = parseInt(e.target.value);
      document.getElementById('volumeValue').textContent = volume + '%';
      alertService.setVolume(volume / 100);
      storageService.updateSettings({ volume });
    });

    // Repeat count
    document.getElementById('repeatSelect')?.addEventListener('change', (e) => {
      const count = parseInt(e.target.value);
      alertService.setRepeatCount(count);
      storageService.updateSettings({ repeatCount: count });
    });

    // Sound type
    document.getElementById('soundTypeSelect')?.addEventListener('change', (e) => {
      alertService.selectSound(e.target.value);
      storageService.updateSettings({ soundType: e.target.value });
    });

    // Enable all permissions
    document.getElementById('enableAllPermissions')?.addEventListener('click', async () => {
      await this.enableAllPermissions();
    });

    // Check background compatibility
    document.getElementById('checkBackgroundBtn')?.addEventListener('click', async () => {
      const result = await alertService.requestBackgroundPermission();
      alert(result.message);
    });

    // Install app button
    document.getElementById('installAppBtn')?.addEventListener('click', () => {
      this.promptInstall();
    });

    // Modals
    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') this.closeSettings();
    });

    document.getElementById('favoritesModal').addEventListener('click', (e) => {
      if (e.target.id === 'favoritesModal') this.closeFavorites();
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeSettings();
        this.closeFavorites();
      }
    });
  }

  // ===== USER INFO TOGGLE =====
  toggleUserInfo() {
    const details = document.getElementById('userInfoDetails');
    const toggle = document.getElementById('toggleUserInfo');

    if (details.style.display === 'none') {
      details.style.display = 'block';
      toggle.classList.add('expanded');
    } else {
      details.style.display = 'none';
      toggle.classList.remove('expanded');
    }
  }

  // ===== SEARCH TABS =====
  switchSearchTab(tab) {
    this.activeSearchTab = tab;

    document.querySelectorAll('.search-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });

    document.getElementById('searchAddress').style.display = tab === 'address' ? 'block' : 'none';
    document.getElementById('searchCoords').style.display = tab === 'coords' ? 'block' : 'none';
    document.getElementById('searchPostal').style.display = tab === 'postal' ? 'block' : 'none';
  }

  // ===== COORDINATES SEARCH =====
  async searchByCoordinates() {
    const latInput = document.getElementById('latInput').value;
    const lngInput = document.getElementById('lngInput').value;

    // Essayer de parser les coordonnées
    let coords = null;

    // Si les deux champs sont remplis
    if (latInput && lngInput) {
      coords = { lat: parseFloat(latInput), lng: parseFloat(lngInput) };
    } else if (latInput) {
      // Essayer de parser un format combiné
      coords = searchService.parseCoordinates(latInput);
    }

    if (!coords || isNaN(coords.lat) || isNaN(coords.lng)) {
      this.showToast('Coordonnées invalides', 'error');
      return;
    }

    if (coords.lat < -90 || coords.lat > 90 || coords.lng < -180 || coords.lng > 180) {
      this.showToast('Coordonnées hors limites', 'error');
      return;
    }

    try {
      const result = await searchService.reverseGeocode(coords.lat, coords.lng);
      if (result) {
        this.setDestination(result);
      } else {
        this.setDestination({
          lat: coords.lat,
          lng: coords.lng,
          name: `Position (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
          address: `Coordonnées: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`
        });
      }
    } catch (error) {
      this.showToast('Erreur de recherche', 'error');
    }
  }

  // ===== POSTAL CODE SEARCH =====
  async searchByPostalCode() {
    const postalCode = document.getElementById('postalInput').value.trim();

    if (!postalCode) {
      this.showToast('Entrez un code postal', 'error');
      return;
    }

    try {
      const results = await searchService.searchPostalCode(postalCode);
      if (results && results.length > 0) {
        this.setDestination(results[0]);
      } else {
        this.showToast('Code postal introuvable', 'error');
      }
    } catch (error) {
      this.showToast('Erreur de recherche', 'error');
    }
  }

  // ===== ZONE RADIUS =====
  updateZoneRadius(radius) {
    this.zoneRadius = radius;
    storageService.updateSettings({ alertDistance: radius });

    const display = radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`;
    document.getElementById('zoneRadiusValue').textContent = display;

    if (this.currentDestination) {
      mapService.updateZoneCircle(this.currentDestination.lat, this.currentDestination.lng, radius);
    }
  }

  // ===== AUTOCOMPLETE =====
  handleAddressInput(query) {
    clearTimeout(this.autocompleteTimeout);

    if (query.length < 2) {
      this.hideAutocomplete();
      return;
    }

    this.autocompleteTimeout = setTimeout(async () => {
      // Utiliser le nouveau service de recherche robuste
      const results = await searchService.search(query, this.userLocation);
      this.showAutocomplete(results);
    }, 300);
  }

  showAutocomplete(results, showFilters = true) {
    const container = document.getElementById('autocompleteResults');
    const filtersEl = document.getElementById('searchFilters');
    container.innerHTML = '';

    if (!results || results.length === 0) {
      container.innerHTML = `
        <div class="autocomplete-item autocomplete-empty">
          <span class="autocomplete-item-icon">🔍</span>
          <div class="autocomplete-item-text">
            <div class="autocomplete-item-name">Aucun résultat trouvé</div>
            <div class="autocomplete-item-address">Essayez une recherche plus précise (ex: "Gare de Lyon, Paris")</div>
          </div>
        </div>
      `;
      container.classList.add('show');
      if (filtersEl) filtersEl.style.display = 'none';
      return;
    }

    // Stocker les résultats bruts pour filtrage
    this.currentSearchResults = results;

    // Appliquer les filtres
    const sortBy = document.getElementById('sortByFilter')?.value || 'distance_asc';
    const categoryFilter = document.getElementById('categoryFilter')?.value || 'all';

    let filteredResults = [...results];

    // Filtrer par catégorie si défini
    if (categoryFilter !== 'all' && typeof filterByCategory === 'function') {
      filteredResults = filterByCategory(filteredResults, categoryFilter);
    }

    // Trier
    if (typeof sortResults === 'function') {
      filteredResults = sortResults(filteredResults, sortBy);
    }

    // Afficher les filtres si plusieurs résultats
    if (filtersEl) {
      filtersEl.style.display = (showFilters && results.length > 3) ? 'flex' : 'none';
    }

    // Compteur de résultats
    const countHtml = `<div class="autocomplete-count">${filteredResults.length} résultat${filteredResults.length > 1 ? 's' : ''}</div>`;
    container.innerHTML = countHtml;

    filteredResults.forEach(result => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';

      // Icône - utiliser celle du résultat ou détecter
      const icon = result.icon || '📍';

      // Nom court
      const name = result.shortName || result.name || 'Lieu inconnu';

      // Adresse complète formatée
      let addressDisplay = '';
      if (result.details) {
        const parts = [];
        if (result.details.street) {
          const streetFull = result.details.houseNumber
            ? `${result.details.houseNumber} ${result.details.street}`
            : result.details.street;
          parts.push(streetFull);
        }
        if (result.details.neighbourhood) parts.push(result.details.neighbourhood);
        if (result.details.city) parts.push(result.details.city);
        if (result.details.postcode) parts.push(result.details.postcode);
        if (result.details.country && !parts.some(p => p === result.details.country)) {
          parts.push(result.details.country);
        }
        addressDisplay = parts.join(', ');
      }

      // Fallback sur l'adresse brute
      if (!addressDisplay) {
        addressDisplay = result.address || result.displayAddress || '';
      }

      // Formater la distance
      let distanceHtml = '';
      if (result.distance) {
        const distText = result.distance >= 1000
          ? `${(result.distance / 1000).toFixed(1)} km`
          : `${Math.round(result.distance)} m`;
        distanceHtml = `<span class="autocomplete-item-distance">${distText}</span>`;
      }

      // Type de lieu
      const typeLabel = this.getTypeLabel(result.type);

      // Infos supplémentaires
      let extraInfo = '';
      if (result.details?.openingHours) {
        extraInfo = `<span class="autocomplete-item-hours">🕐 ${result.details.openingHours}</span>`;
      }

      item.innerHTML = `
        <span class="autocomplete-item-icon">${icon}</span>
        <div class="autocomplete-item-text">
          <div class="autocomplete-item-name">${this.escapeHtml(name)}</div>
          <div class="autocomplete-item-address">${this.escapeHtml(addressDisplay)}</div>
          ${extraInfo}
        </div>
        <div class="autocomplete-item-meta">
          ${distanceHtml}
          <span class="autocomplete-item-category">${typeLabel}</span>
        </div>
      `;

      item.addEventListener('click', () => {
        this.setDestination(result);
        this.hideAutocomplete();
        document.getElementById('addressInput').value = name;
      });

      container.appendChild(item);
    });

    container.classList.add('show');
  }

  getTypeLabel(type) {
    const labels = {
      'train': '🚉 Gare',
      'metro': '🚇 Métro',
      'bus': '🚌 Bus',
      'airport': '✈️ Aéroport',
      'tram': '🚊 Tram',
      'restaurant': '🍽️ Restaurant',
      'fastfood': '🍔 Fast-food',
      'cafe': '☕ Café',
      'bar': '🍺 Bar',
      'hotel': '🏨 Hôtel',
      'hospital': '🏥 Hôpital',
      'pharmacy': '💊 Pharmacie',
      'supermarket': '🛒 Supermarché',
      'shop': '🏪 Magasin',
      'mall': '🏬 Centre commercial',
      'school': '🏫 École',
      'university': '🎓 Université',
      'museum': '🏛️ Musée',
      'theatre': '🎭 Théâtre',
      'cinema': '🎬 Cinéma',
      'park': '🌳 Parc',
      'beach': '🏖️ Plage',
      'mountain': '⛰️ Montagne',
      'city': '🏙️ Ville',
      'town': '🏘️ Ville',
      'village': '🏘️ Village',
      'church': '⛪ Église',
      'castle': '🏰 Château',
      'bank': '🏦 Banque',
      'post': '📮 Poste',
      'police': '👮 Police',
      'stadium': '🏟️ Stade',
      'gym': '🏋️ Sport',
      'pool': '🏊 Piscine'
    };
    return labels[type] || '📍 Lieu';
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  applyFilters() {
    if (this.currentSearchResults && this.currentSearchResults.length > 0) {
      this.showAutocomplete(this.currentSearchResults, true);
    }
  }

  hideAutocomplete() {
    document.getElementById('autocompleteResults').classList.remove('show');
  }

  truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  // ===== NEARBY RECOMMENDATIONS =====
  async loadNearbyRecommendations() {
    if (!this.userLocation) {
      this.displayPopularPlaces();
      return;
    }

    try {
      const searchTerms = [
        { term: 'gare', icon: '🚉', type: 'train' },
        { term: 'station métro', icon: '🚇', type: 'metro' },
        { term: 'aéroport', icon: '✈️', type: 'airport' },
        { term: 'gare routière', icon: '🚌', type: 'bus' }
      ];

      const places = [];

      for (const search of searchTerms) {
        try {
          const results = await searchService.search(search.term, this.userLocation, { limit: 1 });
          if (results && results.length > 0) {
            const place = results[0];
            place.icon = search.icon;
            place.type = search.type;
            places.push(place);
          }
        } catch (e) {
          // Ignorer les erreurs
        }
      }

      if (places.length > 0) {
        this.nearbyPlaces = places.sort((a, b) => (a.distance || 0) - (b.distance || 0)).slice(0, 4);
        this.displayNearbyPlaces();
      } else {
        this.displayPopularPlaces();
      }
    } catch (error) {
      this.displayPopularPlaces();
    }
  }

  // ===== NEARBY TRANSPORT =====
  async loadNearbyTransport() {
    if (!this.userLocation) return;

    try {
      const stops = await transportService.findNearbyStops(
        this.userLocation.lat,
        this.userLocation.lng,
        1000
      );

      if (stops.length > 0) {
        this.displayTransportStops(stops);
      }
    } catch (error) {
      console.log('Transports indisponibles');
    }
  }

  displayTransportStops(stops) {
    const section = document.getElementById('transportSection');
    const list = document.getElementById('transportList');

    if (!stops || stops.length === 0) {
      section.style.display = 'none';
      return;
    }

    list.innerHTML = stops.slice(0, 5).map(stop => `
      <div class="transport-item" data-lat="${stop.lat}" data-lng="${stop.lng}" data-name="${stop.name}">
        <span class="transport-item-icon">${stop.icon}</span>
        <div class="transport-item-info">
          <div class="transport-item-name">${this.truncateText(stop.name, 30)}</div>
          ${stop.lines ? `<div class="transport-item-lines">Lignes: ${stop.lines}</div>` : ''}
          ${stop.operator ? `<div class="transport-item-operator">${stop.operator}</div>` : ''}
        </div>
        <div class="transport-item-distance">${transportService.formatDistance(stop.distance, this.units)}</div>
      </div>
    `).join('');

    list.querySelectorAll('.transport-item').forEach(item => {
      item.addEventListener('click', () => {
        const destination = {
          lat: parseFloat(item.dataset.lat),
          lng: parseFloat(item.dataset.lng),
          name: item.dataset.name,
          address: item.dataset.name
        };
        this.setDestination(destination);
      });
    });

    section.style.display = 'block';
  }

  displayPopularPlaces() {
    const section = document.getElementById('nearbySection');
    const grid = document.getElementById('nearbyGrid');

    const popularPlaces = [
      { name: 'Gare centrale', icon: '🚉', searchTerm: 'gare centrale' },
      { name: 'Aéroport', icon: '✈️', searchTerm: 'aéroport international' },
      { name: 'Station de métro', icon: '🚇', searchTerm: 'station métro' },
      { name: 'Gare routière', icon: '🚌', searchTerm: 'gare routière' }
    ];

    grid.innerHTML = popularPlaces.map(place => `
      <button type="button" class="nearby-item" data-search="${place.searchTerm}">
        <div class="nearby-item-icon">${place.icon}</div>
        <div class="nearby-item-name">${place.name}</div>
        <div class="nearby-item-distance">Rechercher</div>
      </button>
    `).join('');

    grid.querySelectorAll('.nearby-item').forEach(item => {
      item.addEventListener('click', () => {
        document.getElementById('addressInput').value = item.dataset.search;
        this.searchAddress(item.dataset.search);
      });
    });

    section.style.display = 'block';
  }

  displayNearbyPlaces() {
    const section = document.getElementById('nearbySection');
    const grid = document.getElementById('nearbyGrid');

    if (!this.nearbyPlaces || this.nearbyPlaces.length === 0) {
      section.style.display = 'none';
      return;
    }

    grid.innerHTML = this.nearbyPlaces.map(place => {
      const distanceText = place.distance
        ? transportService.formatDistance(place.distance, this.units)
        : 'À proximité';

      return `
        <button type="button" class="nearby-item" data-lat="${place.lat}" data-lng="${place.lng}" data-name="${place.name}">
          <div class="nearby-item-icon">${place.icon || '📍'}</div>
          <div class="nearby-item-name">${this.truncateText(place.shortName || place.name?.split(',')[0], 20)}</div>
          <div class="nearby-item-distance">${distanceText}</div>
        </button>
      `;
    }).join('');

    grid.querySelectorAll('.nearby-item').forEach(item => {
      if (item.dataset.lat) {
        item.addEventListener('click', () => {
          const destination = {
            lat: parseFloat(item.dataset.lat),
            lng: parseFloat(item.dataset.lng),
            name: item.dataset.name,
            address: item.dataset.name
          };
          this.setDestination(destination);
        });
      }
    });

    section.style.display = 'block';
  }

  // ===== ADDRESS SEARCH =====
  async searchAddress(query) {
    if (!query.trim()) return;

    this.hideAutocomplete();

    try {
      // Utiliser le service de recherche robuste
      const results = await searchService.search(query, this.userLocation);
      if (results && results.length > 0) {
        this.setDestination(results[0]);
        document.getElementById('addressInput').value = results[0].shortName || results[0].name?.split(',')[0];
      } else {
        this.showToast('Adresse introuvable', 'error');
      }
    } catch (error) {
      this.showToast('Erreur lors de la recherche', 'error');
    }
  }

  // ===== DESTINATION MANAGEMENT =====
  setDestination(destination) {
    this.currentDestination = destination;
    storageService.setCurrentDestination(destination);

    const settings = storageService.getSettings();
    this.zoneRadius = settings.alertDistance || 1000;
    document.getElementById('zoneRadiusSlider').value = this.zoneRadius;
    this.updateZoneRadius(this.zoneRadius);

    mapService.setDestination(destination.lat, destination.lng, destination.name || destination.address);
    mapService.updateZoneCircle(destination.lat, destination.lng, this.zoneRadius);

    // Update UI
    const displayName = destination.shortName || destination.name?.split(',')[0] || destination.address;
    document.getElementById('destinationName').textContent = displayName;
    document.getElementById('destinationAddress').textContent = destination.address || '';

    // Afficher les coordonnées
    const coordsEl = document.getElementById('destinationCoords');
    if (coordsEl) {
      coordsEl.textContent = `📍 ${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}`;
    }

    document.getElementById('destinationDisplay').style.display = 'block';
    document.getElementById('startTrackingBtn').disabled = false;

    // Update trip info
    this.updateTripInfo();

    // Center map
    mapService.setCenter(destination.lat, destination.lng, 14);

    // Draw route if user location available
    if (this.userLocation) {
      mapService.updateRoute(
        this.userLocation.lat,
        this.userLocation.lng,
        destination.lat,
        destination.lng
      );
    }

    this.showToast('📍 Destination définie', 'success');
  }

  updateTripInfo() {
    if (!this.currentDestination || !this.userLocation) return;

    const distance = geolocationService.calculateDistance(
      this.userLocation.lat,
      this.userLocation.lng,
      this.currentDestination.lat,
      this.currentDestination.lng
    );

    const times = transportService.estimateTravelTimes(distance);

    document.getElementById('tripDistance').textContent = transportService.formatDistance(distance, this.units);
    document.getElementById('tripWalkTime').textContent = transportService.formatTime(times.walk);
    document.getElementById('tripDriveTime').textContent = transportService.formatTime(times.car);
    document.getElementById('tripTransitTime').textContent = transportService.formatTime(times.transit);
  }

  removeDestination() {
    this.currentDestination = null;
    storageService.clearCurrentDestination();

    document.getElementById('destinationDisplay').style.display = 'none';
    document.getElementById('startTrackingBtn').disabled = true;
    document.getElementById('trackingSection').style.display = 'none';
    document.getElementById('addressInput').value = '';

    mapService.clear();

    if (this.isTracking) {
      this.stopTracking();
    }
  }

  enableMapSelection() {
    const btn = document.getElementById('selectOnMapBtn');
    btn.classList.add('active');
    this.showToast('Cliquez sur la carte pour sélectionner', 'success');

    mapService.enableDestinationSelection((lat, lng) => {
      searchService.reverseGeocode(lat, lng).then(result => {
        if (result) {
          this.setDestination(result);
          mapService.disableDestinationSelection();
          btn.classList.remove('active');
        }
      });
    });
  }

  async centerOnCurrentLocation() {
    try {
      const position = await geolocationService.getCurrentPosition();
      const { latitude, longitude } = position.coords;
      this.userLocation = { lat: latitude, lng: longitude };
      mapService.setCenter(latitude, longitude, 15);
      mapService.updateCurrentPosition(latitude, longitude);
      document.getElementById('userCoordsText').textContent = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      this.showToast('📍 Position mise à jour', 'success');

      if (this.currentDestination) {
        mapService.updateRoute(latitude, longitude, this.currentDestination.lat, this.currentDestination.lng);
        this.updateTripInfo();
      }
    } catch (error) {
      if (this.userLocation) {
        mapService.setCenter(this.userLocation.lat, this.userLocation.lng, 13);
        this.showToast('Position GPS indisponible', 'error');
      } else {
        this.showToast('Activez la géolocalisation', 'error');
      }
    }
  }

  // ===== TRACKING =====
  async startTracking() {
    if (!this.currentDestination) {
      this.showToast('Définissez d\'abord une destination', 'error');
      return;
    }

    try {
      this.lastPositions = [];

      await geolocationService.startTracking(
        this.currentDestination,
        {
          onPositionUpdate: (position, distance) => {
            this.updateTrackingUI(position, distance);
          },
          onDistanceChange: (distance) => {
            this.updateDistance(distance);
          },
          onArrival: (distance) => {
            this.handleArrival(distance);
          }
        }
      );

      this.isTracking = true;
      document.getElementById('trackingSection').style.display = 'block';
      document.getElementById('startTrackingBtn').style.display = 'none';

      const initialPos = await geolocationService.getCurrentPosition();
      this.initialDistance = geolocationService.calculateDistance(
        initialPos.coords.latitude,
        initialPos.coords.longitude,
        this.currentDestination.lat,
        this.currentDestination.lng
      );

      this.showToast('🚀 Suivi démarré', 'success');

    } catch (error) {
      this.showToast('Activez la géolocalisation pour le suivi', 'error');
    }
  }

  stopTracking() {
    geolocationService.stopTracking();
    this.isTracking = false;

    document.getElementById('trackingSection').style.display = 'none';
    document.getElementById('startTrackingBtn').style.display = 'flex';
    document.getElementById('startTrackingBtn').disabled = false;

    alertService.stopSound();
    this.showToast('Suivi arrêté', 'success');
  }

  updateTrackingUI(position, distance) {
    const { latitude, longitude, speed, heading, accuracy, altitude } = position.coords;

    this.lastPositions.push({ lat: latitude, lng: longitude, time: Date.now() });
    if (this.lastPositions.length > 10) {
      this.lastPositions.shift();
    }

    this.currentSpeed = speed ? speed * 3.6 : this.calculateAverageSpeed();

    mapService.updateCurrentPosition(latitude, longitude);
    mapService.updateRoute(latitude, longitude, this.currentDestination.lat, this.currentDestination.lng);

    this.updateETA(distance);
    document.getElementById('speedValue').textContent =
      this.currentSpeed > 0 ? `${Math.round(this.currentSpeed)} km/h` : '--';

    const headingText = heading ? `${Math.round(heading)}° ${transportService.getCardinalDirection(heading)}` : '--';
    document.getElementById('headingValue').textContent = headingText;

    document.getElementById('accuracyValue').textContent = accuracy ? `±${Math.round(accuracy)}m` : '--';
    document.getElementById('altitudeValue').textContent = altitude ? `${Math.round(altitude)}m` : '--';
    document.getElementById('currentCoordsValue').textContent = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }

  calculateAverageSpeed() {
    if (this.lastPositions.length < 2) return 0;

    const first = this.lastPositions[0];
    const last = this.lastPositions[this.lastPositions.length - 1];

    const distance = geolocationService.calculateDistance(first.lat, first.lng, last.lat, last.lng);
    const timeMs = last.time - first.time;

    if (timeMs === 0) return 0;

    return (distance / (timeMs / 1000)) * 3.6;
  }

  updateETA(distance) {
    const etaElement = document.getElementById('etaValue');

    if (this.currentSpeed > 1) {
      const hoursRemaining = (distance / 1000) / this.currentSpeed;
      const minutesRemaining = Math.round(hoursRemaining * 60);

      if (minutesRemaining < 1) {
        etaElement.textContent = '< 1 min';
      } else if (minutesRemaining < 60) {
        etaElement.textContent = `${minutesRemaining} min`;
      } else {
        const hours = Math.floor(minutesRemaining / 60);
        const mins = minutesRemaining % 60;
        etaElement.textContent = `${hours}h${mins}`;
      }
    } else {
      etaElement.textContent = '--';
    }
  }

  updateDistance(distance) {
    const distanceElement = document.getElementById('distanceValue');

    distanceElement.classList.add('updated');
    setTimeout(() => distanceElement.classList.remove('updated'), 300);

    distanceElement.textContent = transportService.formatDistance(distance, this.units);

    if (this.initialDistance) {
      const progress = Math.max(0, Math.min(100, ((this.initialDistance - distance) / this.initialDistance) * 100));
      document.getElementById('progressFill').style.width = `${progress}%`;
    }

    if (distance <= this.zoneRadius && this.isTracking) {
      document.getElementById('statusText').textContent = '⚠️ Vous approchez de votre destination !';
    } else {
      document.getElementById('statusText').textContent = 'Suivi GPS actif';
    }
  }

  handleArrival(distance) {
    const distanceText = transportService.formatDistance(distance, this.units);

    alertService.triggerAlert(distance);
    document.getElementById('statusText').textContent = `🎉 Vous êtes arrivé ! (${distanceText})`;
    this.showToast(`🎉 Destination atteinte ! (${distanceText})`, 'success');
  }

  // ===== SETTINGS =====
  openSettings() {
    this.loadSettings();
    document.getElementById('settingsModal').classList.add('show');
  }

  closeSettings() {
    document.getElementById('settingsModal').classList.remove('show');
  }

  loadSettings() {
    const settings = storageService.getSettings();

    document.getElementById('alertTypeSelect').value = settings.alertType || 'all';
    document.getElementById('soundTypeSelect').value = settings.soundType || 'alarm';
    document.getElementById('themeSelect').value = settings.theme || 'dark';
    document.getElementById('unitsSelect').value = settings.units || 'metric';
    
    // Volume
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeValue = document.getElementById('volumeValue');
    if (volumeSlider && volumeValue) {
      const volume = settings.volume || 80;
      volumeSlider.value = volume;
      volumeValue.textContent = volume + '%';
      alertService.setVolume(volume / 100);
    }
    
    // Repeat count
    const repeatSelect = document.getElementById('repeatSelect');
    if (repeatSelect) {
      repeatSelect.value = settings.repeatCount !== undefined ? settings.repeatCount : 3;
      alertService.setRepeatCount(parseInt(repeatSelect.value));
    }

    // Update system status
    this.updateSystemStatus();

    // Check if app is installable
    this.checkInstallable();
  }

  // Mettre à jour l'état du système
  async updateSystemStatus() {
    const permissions = await alertService.checkPermissions();
    const audioStatus = await alertService.getDeviceAudioStatus();

    // Audio
    const audioEl = document.getElementById('audioStatus');
    if (audioEl) {
      if (permissions.audio && audioStatus.message.includes('actif')) {
        audioEl.className = 'status-item status-ok';
        audioEl.innerHTML = '<span class="status-icon">🔊</span><span class="status-text">Audio: Actif</span>';
      } else {
        audioEl.className = 'status-item status-warning';
        audioEl.innerHTML = '<span class="status-icon">🔇</span><span class="status-text">Audio: Touchez pour activer</span>';
      }
    }

    // Vibration
    const vibEl = document.getElementById('vibrationStatus');
    if (vibEl) {
      if (permissions.vibration) {
        vibEl.className = 'status-item status-ok';
        vibEl.innerHTML = '<span class="status-icon">📳</span><span class="status-text">Vibration: OK</span>';
      } else {
        vibEl.className = 'status-item status-error';
        vibEl.innerHTML = '<span class="status-icon">📴</span><span class="status-text">Vibration: Non supporté</span>';
      }
    }

    // Notifications
    const notifEl = document.getElementById('notifStatus');
    if (notifEl) {
      if (permissions.notification) {
        notifEl.className = 'status-item status-ok';
        notifEl.innerHTML = '<span class="status-icon">🔔</span><span class="status-text">Notifications: OK</span>';
      } else if (Notification.permission === 'denied') {
        notifEl.className = 'status-item status-error';
        notifEl.innerHTML = '<span class="status-icon">🔕</span><span class="status-text">Notifications: Bloquées</span>';
      } else {
        notifEl.className = 'status-item status-warning';
        notifEl.innerHTML = '<span class="status-icon">🔔</span><span class="status-text">Notifications: À autoriser</span>';
      }
    }

    // GPS
    const gpsEl = document.getElementById('gpsStatus');
    if (gpsEl) {
      if (this.userLocation && this.userLocation.source === 'gps') {
        gpsEl.className = 'status-item status-ok';
        gpsEl.innerHTML = '<span class="status-icon">📍</span><span class="status-text">GPS: Actif</span>';
      } else if (this.userLocation) {
        gpsEl.className = 'status-item status-warning';
        gpsEl.innerHTML = '<span class="status-icon">📍</span><span class="status-text">GPS: Via IP</span>';
      } else {
        gpsEl.className = 'status-item status-error';
        gpsEl.innerHTML = '<span class="status-icon">📍</span><span class="status-text">GPS: Inactif</span>';
      }
    }
  }

  // Activer toutes les permissions
  async enableAllPermissions() {
    this.showToast('🔓 Activation des permissions...', 'info');

    // 1. Audio
    const audioResult = await alertService.forceEnableAudio();
    
    // 2. Notifications
    const notifResult = await alertService.requestNotificationPermission();
    
    // 3. GPS
    if (navigator.geolocation) {
      try {
        await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000
          });
        });
      } catch (e) {
        console.log('GPS permission:', e);
      }
    }

    // Mettre à jour le statut
    await this.updateSystemStatus();

    // Message récapitulatif
    const permissions = await alertService.checkPermissions();
    let message = '✅ Permissions activées:\n';
    message += permissions.audio ? '• Audio ✓\n' : '• Audio ✗\n';
    message += permissions.vibration ? '• Vibration ✓\n' : '• Vibration ✗\n';
    message += permissions.notification ? '• Notifications ✓\n' : '• Notifications ✗\n';

    this.showToast(message.includes('✗') ? '⚠️ Certaines permissions manquent' : '✅ Tout est activé !', 
                   message.includes('✗') ? 'warning' : 'success');
  }

  // Vérifier si l'app est installable
  checkInstallable() {
    const installSection = document.getElementById('installSection');
    
    // Vérifier si déjà installé
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone;
    
    if (isStandalone) {
      if (installSection) installSection.style.display = 'none';
      return;
    }

    // Capturer l'événement d'installation
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      if (installSection) installSection.style.display = 'block';
    });
  }

  // Prompt d'installation
  async promptInstall() {
    if (!this.deferredInstallPrompt) {
      // Afficher les instructions manuelles
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      if (isIOS) {
        alert('📲 Pour installer Terminus sur iOS:\n\n1. Appuyez sur le bouton Partager (📤)\n2. Faites défiler et tapez "Sur l\'écran d\'accueil"\n3. Tapez "Ajouter"');
      } else {
        alert('📲 Pour installer Terminus:\n\n• Chrome/Edge: Cliquez sur l\'icône d\'installation dans la barre d\'adresse\n• Firefox: Ajoutez la page aux favoris\n• Safari: Utilisez "Ajouter à l\'écran d\'accueil"');
      }
      return;
    }

    this.deferredInstallPrompt.prompt();
    const { outcome } = await this.deferredInstallPrompt.userChoice;
    
    if (outcome === 'accepted') {
      this.showToast('✅ Application installée !', 'success');
    }
    
    this.deferredInstallPrompt = null;
    document.getElementById('installSection').style.display = 'none';
  }

  // ===== FAVORITES =====
  openFavorites() {
    this.displayFavorites();
    document.getElementById('favoritesModal').classList.add('show');
  }

  closeFavorites() {
    document.getElementById('favoritesModal').classList.remove('show');
  }

  displayFavorites() {
    const favorites = storageService.getFavorites();
    const container = document.getElementById('favoritesList');

    if (favorites.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucun favori pour le moment.<br>Ajoutez des destinations fréquentes !</p>';
      return;
    }

    container.innerHTML = favorites.map(fav => `
      <div class="favorite-item">
        <div class="favorite-info" onclick="app.useFavorite('${fav.id}')">
          <div class="favorite-name">${fav.name?.split(',')[0] || fav.address}</div>
          <div class="favorite-address">${this.truncateText(fav.address, 50)}</div>
        </div>
        <div class="favorite-actions">
          <button type="button" class="favorite-btn" onclick="app.useFavorite('${fav.id}')" title="Utiliser">📍</button>
          <button type="button" class="favorite-btn" onclick="app.removeFavorite('${fav.id}')" title="Supprimer">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  useFavorite(id) {
    const favorites = storageService.getFavorites();
    const favorite = favorites.find(fav => fav.id === id);

    if (favorite) {
      this.setDestination(favorite);
      this.closeFavorites();
    }
  }

  removeFavorite(id) {
    if (confirm('Supprimer ce favori ?')) {
      storageService.removeFavorite(id);
      this.displayFavorites();
      this.showToast('Favori supprimé', 'success');
    }
  }

  addToFavorites() {
    if (!this.currentDestination) return;

    const success = storageService.addFavorite(this.currentDestination);

    if (success) {
      const btn = document.getElementById('addToFavoritesBtn');
      btn.style.transform = 'scale(1.3)';
      btn.style.color = '#ffd700';
      setTimeout(() => {
        btn.style.transform = '';
        btn.style.color = '';
      }, 300);

      this.showToast('⭐ Ajouté aux favoris', 'success');
    } else {
      this.showToast('Déjà dans les favoris', 'error');
    }
  }

  // ===== TOAST NOTIFICATIONS =====
  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer') || document.body;

    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Initialize
let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new TerminusApp();
  window.app = app;
});
