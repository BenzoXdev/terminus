// Application principale Terminus
class TerminusApp {
  constructor() {
    this.currentDestination = null;
    this.destinations = []; // Liste de destinations pour multi-étapes
    this.currentDestinationIndex = 0; // Index de la destination actuelle
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
    this.tripStartTime = null;
    this.tripStartLocation = null;
    this.tripMaxSpeed = 0;
    this.tripSpeeds = [];

    this.init();
  }

  async init() {
    this.initTheme();
    mapService.init('map');
    this.loadSettings();

    // Vérifier si on est en mode visualisation de partage
    if (shareService.isViewingShare()) {
      const shareId = shareService.getShareIdFromUrl();
      if (shareId) {
        this.initShareViewer(shareId);
        return; // Ne pas initialiser l'app normale
      }
    }

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

    // Share position
    document.getElementById('sharePositionBtn')?.addEventListener('click', () => {
      this.startSharingPosition();
    });

    // Destination
    document.getElementById('removeDestinationBtn').addEventListener('click', () => {
      this.removeDestination();
    });

    document.getElementById('addToFavoritesBtn').addEventListener('click', () => {
      this.addToFavorites();
    });

    document.getElementById('addToRouteBtn')?.addEventListener('click', () => {
      if (this.currentDestination) {
        this.addDestinationToRoute(this.currentDestination);
      }
    });

    // Settings
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.openSettings();
    });

    document.getElementById('closeSettingsBtn').addEventListener('click', () => {
      this.closeSettings();
    });

    // History
    document.getElementById('historyBtn').addEventListener('click', () => {
      this.openHistory();
    });

    document.getElementById('closeHistoryBtn').addEventListener('click', () => {
      this.closeHistory();
    });

    // Calendar
    document.getElementById('calendarBtn')?.addEventListener('click', () => {
      this.openCalendar();
    });

    document.getElementById('closeCalendarBtn')?.addEventListener('click', () => {
      this.closeCalendar();
    });

    document.getElementById('importCalendarBtn')?.addEventListener('click', () => {
      document.getElementById('calendarFileInput').click();
    });

    document.getElementById('calendarFileInput')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await this.importCalendar(file);
      }
    });

    // History tabs
    document.querySelectorAll('.history-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchHistoryTab(tabName);
      });
    });

    // History actions
    document.getElementById('exportHistoryBtn')?.addEventListener('click', () => {
      this.exportHistory();
    });

    document.getElementById('importHistoryBtn')?.addEventListener('click', () => {
      this.importHistory();
    });

    document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
      this.clearHistory();
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

    document.getElementById('historyModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'historyModal') this.closeHistory();
    });

    document.getElementById('calendarModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'calendarModal') this.closeCalendar();
    });

    document.getElementById('favoritesModal').addEventListener('click', (e) => {
      if (e.target.id === 'favoritesModal') this.closeFavorites();
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeSettings();
        this.closeHistory();
        this.closeCalendar();
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

  async displayTransportStops(stops) {
    const section = document.getElementById('transportSection');
    const list = document.getElementById('transportList');

    if (!stops || stops.length === 0) {
      section.style.display = 'none';
      return;
    }

    // Obtenir les horaires en temps réel pour chaque arrêt
    const stopsWithDepartures = await Promise.all(
      stops.slice(0, 5).map(async stop => {
        const departures = await transportService.getRealtimeDepartures(stop);
        return { ...stop, departures };
      })
    );

    list.innerHTML = stopsWithDepartures.map(stop => {
      const departuresHtml = stop.departures && stop.departures.departures
        ? stop.departures.departures.slice(0, 3).map(dep => {
            const statusClass = dep.status === 'arriving' ? 'departure-arriving' : 
                               dep.status === 'soon' ? 'departure-soon' : 'departure-scheduled';
            return `<span class="departure-time ${statusClass}">${transportService.formatDepartureTime(dep)}</span>`;
          }).join('')
        : '<span class="departure-time">Horaires non disponibles</span>';

      return `
        <div class="transport-item" data-lat="${stop.lat}" data-lng="${stop.lng}" data-name="${stop.name}" data-stop-id="${stop.id}">
          <span class="transport-item-icon">${stop.icon}</span>
          <div class="transport-item-info">
            <div class="transport-item-name">${this.truncateText(stop.name, 30)}</div>
            ${stop.lines ? `<div class="transport-item-lines">Lignes: ${stop.lines}</div>` : ''}
            <div class="transport-item-departures">${departuresHtml}</div>
          </div>
          <div class="transport-item-meta">
            <div class="transport-item-distance">${transportService.formatDistance(stop.distance, this.units)}</div>
            <button type="button" class="transport-refresh-btn" onclick="app.refreshStopDepartures('${stop.id}')" title="Rafraîchir">🔄</button>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.transport-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Ne pas déclencher si on clique sur le bouton refresh
        if (e.target.closest('.transport-refresh-btn')) return;

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

  // Rafraîchir les horaires d'un arrêt
  async refreshStopDepartures(stopId) {
    if (!this.userLocation) return;

    try {
      const stops = await transportService.findNearbyStops(
        this.userLocation.lat,
        this.userLocation.lng,
        1000
      );

      const stop = stops.find(s => s.id.toString() === stopId.toString());
      if (!stop) return;

      const departures = await transportService.getRealtimeDepartures(stop);
      
      // Mettre à jour l'affichage
      const item = document.querySelector(`[data-stop-id="${stopId}"]`);
      if (item && departures) {
        const departuresHtml = departures.departures.slice(0, 3).map(dep => {
          const statusClass = dep.status === 'arriving' ? 'departure-arriving' : 
                             dep.status === 'soon' ? 'departure-soon' : 'departure-scheduled';
          return `<span class="departure-time ${statusClass}">${transportService.formatDepartureTime(dep)}</span>`;
        }).join('');

        const departuresEl = item.querySelector('.transport-item-departures');
        if (departuresEl) {
          departuresEl.innerHTML = departuresHtml;
        }
      }

      this.showToast('🔄 Horaires mis à jour', 'success');
    } catch (error) {
      this.showToast('Erreur de rafraîchissement', 'error');
    }
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
  setDestination(destination, addToRoute = false) {
    if (addToRoute && this.destinations.length > 0) {
      // Ajouter à l'itinéraire
      this.addDestinationToRoute(destination);
      return;
    }

    // Mode simple : une seule destination
    this.currentDestination = destination;
    this.destinations = [destination];
    this.currentDestinationIndex = 0;
    storageService.setCurrentDestination(destination);

    this.updateDestinationUI();
    this.showToast('📍 Destination définie', 'success');
  }

  // Ajouter une destination à l'itinéraire
  addDestinationToRoute(destination) {
    this.destinations.push(destination);
    this.updateDestinationsList();
    this.updateMapWithAllDestinations();
    this.showToast(`📍 Étape ${this.destinations.length} ajoutée`, 'success');
  }

  // Mettre à jour l'UI de destination
  updateDestinationUI() {
    if (!this.currentDestination) return;

    const settings = storageService.getSettings();
    this.zoneRadius = settings.alertDistance || 1000;
    document.getElementById('zoneRadiusSlider').value = this.zoneRadius;
    this.updateZoneRadius(this.zoneRadius);

    // Afficher la destination actuelle
    const displayName = this.currentDestination.shortName || this.currentDestination.name?.split(',')[0] || this.currentDestination.address;
    document.getElementById('destinationName').textContent = displayName;
    document.getElementById('destinationAddress').textContent = this.currentDestination.address || '';

    // Afficher les coordonnées
    const coordsEl = document.getElementById('destinationCoords');
    if (coordsEl) {
      coordsEl.textContent = `📍 ${this.currentDestination.lat.toFixed(5)}, ${this.currentDestination.lng.toFixed(5)}`;
    }

    // Afficher l'indicateur multi-étapes
    if (this.destinations.length > 1) {
      const stepIndicator = document.getElementById('stepIndicator');
      if (stepIndicator) {
        stepIndicator.textContent = `Étape ${this.currentDestinationIndex + 1}/${this.destinations.length}`;
        stepIndicator.style.display = 'block';
      }
    } else {
      const stepIndicator = document.getElementById('stepIndicator');
      if (stepIndicator) stepIndicator.style.display = 'none';
    }

    document.getElementById('destinationDisplay').style.display = 'block';
    document.getElementById('startTrackingBtn').disabled = false;

    // Mettre à jour la carte
    mapService.setDestination(this.currentDestination.lat, this.currentDestination.lng, displayName);
    mapService.updateZoneCircle(this.currentDestination.lat, this.currentDestination.lng, this.zoneRadius);

    // Mettre à jour la liste des destinations
    this.updateDestinationsList();
    if (this.destinations.length > 1) {
      this.updateMapWithAllDestinations();
    }

    // Update trip info
    this.updateTripInfo();

    // Center map
    mapService.setCenter(this.currentDestination.lat, this.currentDestination.lng, 14);

    // Draw route if user location available
    if (this.userLocation) {
      mapService.updateRoute(
        this.userLocation.lat,
        this.userLocation.lng,
        this.currentDestination.lat,
        this.currentDestination.lng
      );
    }
  }

  // Mettre à jour la liste des destinations dans l'UI
  updateDestinationsList() {
    const container = document.getElementById('destinationsList');
    if (!container) return;

    if (this.destinations.length <= 1) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    container.innerHTML = this.destinations.map((dest, index) => {
      const name = dest.shortName || dest.name?.split(',')[0] || dest.address;
      const isActive = index === this.currentDestinationIndex;
      
      return `
        <div class="destination-step ${isActive ? 'active' : ''}" data-index="${index}">
          <div class="step-number">${index + 1}</div>
          <div class="step-info">
            <div class="step-name">${name}</div>
            <div class="step-address">${dest.address || ''}</div>
          </div>
          <div class="step-actions">
            ${index > 0 ? `<button type="button" class="step-btn" onclick="app.moveDestination(${index}, -1)" title="Monter">↑</button>` : ''}
            ${index < this.destinations.length - 1 ? `<button type="button" class="step-btn" onclick="app.moveDestination(${index}, 1)" title="Descendre">↓</button>` : ''}
            <button type="button" class="step-btn" onclick="app.removeDestinationStep(${index})" title="Supprimer">🗑️</button>
            <button type="button" class="step-btn" onclick="app.goToDestination(${index})" title="Aller à">📍</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Mettre à jour la carte avec toutes les destinations
  updateMapWithAllDestinations() {
    if (this.destinations.length === 0) return;

    // Effacer les marqueurs précédents
    mapService.clearAllDestinations();

    // Ajouter tous les marqueurs
    this.destinations.forEach((dest, index) => {
      const name = dest.shortName || dest.name?.split(',')[0] || dest.address;
      mapService.addDestinationMarker(dest.lat, dest.lng, name, index + 1, index === this.currentDestinationIndex);
    });

    // Dessiner les routes entre les étapes
    if (this.destinations.length > 1) {
      for (let i = 0; i < this.destinations.length - 1; i++) {
        const from = this.destinations[i];
        const to = this.destinations[i + 1];
        mapService.drawRouteBetween(from.lat, from.lng, to.lat, to.lng, i);
      }
    }

    // Ajuster la vue pour voir toutes les destinations
    if (this.destinations.length > 1) {
      const bounds = this.destinations.map(d => [d.lat, d.lng]);
      mapService.fitBounds(bounds);
    }
  }

  // Aller à une destination spécifique
  goToDestination(index) {
    if (index >= 0 && index < this.destinations.length) {
      this.currentDestinationIndex = index;
      this.currentDestination = this.destinations[index];
      this.updateDestinationUI();
      this.updateDestinationsList();
    }
  }

  // Déplacer une destination dans la liste
  moveDestination(index, direction) {
    if (index + direction < 0 || index + direction >= this.destinations.length) return;

    const dest = this.destinations.splice(index, 1)[0];
    this.destinations.splice(index + direction, 0, dest);

    // Mettre à jour l'index actuel
    if (this.currentDestinationIndex === index) {
      this.currentDestinationIndex = index + direction;
    } else if (this.currentDestinationIndex === index + direction) {
      this.currentDestinationIndex = index;
    }

    this.updateDestinationsList();
    this.updateMapWithAllDestinations();
    this.updateDestinationUI();
  }

  // Supprimer une étape de l'itinéraire
  removeDestinationStep(index) {
    if (this.destinations.length <= 1) {
      this.showToast('Au moins une destination est requise', 'error');
      return;
    }

    if (confirm('Supprimer cette étape ?')) {
      this.destinations.splice(index, 1);

      // Ajuster l'index actuel
      if (this.currentDestinationIndex >= this.destinations.length) {
        this.currentDestinationIndex = this.destinations.length - 1;
      } else if (this.currentDestinationIndex > index) {
        this.currentDestinationIndex--;
      }

      this.currentDestination = this.destinations[this.currentDestinationIndex];
      this.updateDestinationsList();
      this.updateMapWithAllDestinations();
      this.updateDestinationUI();
      this.showToast('Étape supprimée', 'success');
    }
  }

  // Passer à l'étape suivante automatiquement
  goToNextDestination() {
    if (this.currentDestinationIndex < this.destinations.length - 1) {
      this.currentDestinationIndex++;
      this.currentDestination = this.destinations[this.currentDestinationIndex];
      this.updateDestinationUI();
      this.updateDestinationsList();
      this.updateMapWithAllDestinations();
      
      // Redémarrer le suivi pour la nouvelle destination
      if (this.isTracking) {
        this.stopTracking();
        setTimeout(() => {
          this.startTracking();
        }, 1000);
      }

      this.showToast(`📍 Étape ${this.currentDestinationIndex + 1}/${this.destinations.length}`, 'success');
    } else {
      // Toutes les étapes terminées
      this.showToast('🎉 Toutes les étapes terminées !', 'success');
      if (this.isTracking) {
        this.stopTracking();
      }
    }
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

    // Activer l'audio pour iOS
    await alertService.forceEnableAudio();

    try {
      this.lastPositions = [];

      // Définir le rayon d'alerte
      const alertRadius = this.zoneRadius || storageService.getSettings().alertDistance || 1000;

      const result = await geolocationService.startTracking(
        this.currentDestination,
        {
          onPositionUpdate: (position, distance, metrics) => {
            this.updateTrackingUI(position, distance, metrics);
          },
          onDistanceChange: (distance) => {
            this.updateDistance(distance);
          },
          onArrival: (distance, position) => {
            this.handleArrival(distance, position);
          },
          onError: (error) => {
            this.showToast(error.message, 'error');
          }
        },
        { alertRadius }
      );

      this.isTracking = true;
      this.initialDistance = result.distance;
      
      // Enregistrer le début du trajet
      this.tripStartTime = Date.now();
      this.tripStartLocation = {
        lat: result.position.coords.latitude,
        lng: result.position.coords.longitude
      };
      this.tripMaxSpeed = 0;
      this.tripSpeeds = [];
      
      document.getElementById('trackingSection').style.display = 'block';
      document.getElementById('startTrackingBtn').style.display = 'none';

      // Afficher un message de confirmation
      const accuracy = result.position.coords.accuracy;
      if (accuracy > 100) {
        this.showToast(`📍 Suivi démarré (précision: ±${Math.round(accuracy)}m)\n⚠️ Allez à l'extérieur pour un GPS plus précis`, 'warning');
      } else {
        this.showToast(`📍 Suivi GPS actif (±${Math.round(accuracy)}m)`, 'success');
      }

    } catch (error) {
      this.showToast('Activez la géolocalisation pour le suivi', 'error');
    }
  }

  stopTracking() {
    // Arrêter le partage si actif
    shareService.stopSharing();

    // Sauvegarder le trajet dans l'historique
    if (this.tripStartTime && this.tripStartLocation && this.currentDestination) {
      const endTime = Date.now();
      const duration = Math.floor((endTime - this.tripStartTime) / 1000);
      
      // Obtenir la position finale
      const currentPos = geolocationService.currentPosition;
      const endLocation = currentPos ? {
        lat: currentPos.coords.latitude,
        lng: currentPos.coords.longitude
      } : this.currentDestination;

      // Calculer la distance totale parcourue
      let totalDistance = 0;
      if (this.lastPositions && this.lastPositions.length >= 2) {
        for (let i = 1; i < this.lastPositions.length; i++) {
          const prev = this.lastPositions[i - 1];
          const curr = this.lastPositions[i];
          // Utiliser la méthode de calcul de distance
          const R = 6371000; // Rayon de la Terre en mètres
          const dLat = (curr.lat - prev.lat) * Math.PI / 180;
          const dLon = (curr.lng - prev.lng) * Math.PI / 180;
          const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(prev.lat * Math.PI / 180) * Math.cos(curr.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          totalDistance += Math.round(R * c);
        }
      } else {
        // Utiliser la distance initiale si pas assez de positions
        totalDistance = this.initialDistance || 0;
      }

      // Calculer la vitesse moyenne
      const averageSpeed = this.tripSpeeds.length > 0
        ? Math.round(this.tripSpeeds.reduce((a, b) => a + b, 0) / this.tripSpeeds.length)
        : 0;

      // Sauvegarder le trajet
      historyService.saveTrip({
        startTime: this.tripStartTime,
        endTime: endTime,
        startLat: this.tripStartLocation.lat,
        startLng: this.tripStartLocation.lng,
        startAddress: 'Position de départ',
        endLat: endLocation.lat,
        endLng: endLocation.lng,
        endAddress: this.currentDestination.name || this.currentDestination.address || 'Destination',
        distance: totalDistance,
        duration: duration,
        averageSpeed: averageSpeed,
        maxSpeed: this.tripMaxSpeed,
        transportMode: this.detectTransportMode(averageSpeed)
      });
    }

    geolocationService.stopTracking();
    this.isTracking = false;

    // Réinitialiser les variables de trajet
    this.tripStartTime = null;
    this.tripStartLocation = null;
    this.tripMaxSpeed = 0;
    this.tripSpeeds = [];

    document.getElementById('trackingSection').style.display = 'none';
    document.getElementById('startTrackingBtn').style.display = 'flex';
    document.getElementById('startTrackingBtn').disabled = false;

    alertService.stopAll();
    this.showToast('Suivi arrêté', 'success');
  }

  // Détecter le mode de transport basé sur la vitesse
  detectTransportMode(avgSpeed) {
    if (avgSpeed < 5) return 'walking';
    if (avgSpeed < 15) return 'bike';
    if (avgSpeed < 50) return 'car';
    if (avgSpeed < 100) return 'train';
    return 'unknown';
  }

  updateTrackingUI(position, distance, metrics = null) {
    const { latitude, longitude, accuracy, altitude } = position.coords;

    // Mettre à jour la carte
    mapService.updateCurrentPosition(latitude, longitude);
    if (this.currentDestination) {
      mapService.updateRoute(latitude, longitude, this.currentDestination.lat, this.currentDestination.lng);
    }

    // Afficher la distance
    const distanceText = distance >= 1000 
      ? `${(distance / 1000).toFixed(1)} km` 
      : `${Math.round(distance)} m`;
    document.getElementById('distanceValue').textContent = distanceText;

    // Vitesse
    if (metrics && metrics.speedKmh !== null && metrics.speedKmh > 0) {
      document.getElementById('speedValue').textContent = `${metrics.speedKmh} km/h`;
      this.currentSpeed = metrics.speedKmh;
      
      // Enregistrer pour l'historique
      this.tripSpeeds.push(metrics.speedKmh);
      if (metrics.speedKmh > this.tripMaxSpeed) {
        this.tripMaxSpeed = metrics.speedKmh;
      }
    } else {
      document.getElementById('speedValue').textContent = 'Stationnaire';
    }

    // Direction
    if (metrics && metrics.headingText) {
      document.getElementById('headingValue').textContent = `${metrics.headingText} (${Math.round(metrics.heading)}°)`;
    } else {
      document.getElementById('headingValue').textContent = '--';
    }

    // Précision avec indicateur de qualité
    let accuracyText = '--';
    if (accuracy) {
      const accRound = Math.round(accuracy);
      if (accRound < 20) {
        accuracyText = `🟢 ±${accRound}m (Excellent)`;
      } else if (accRound < 50) {
        accuracyText = `🟢 ±${accRound}m (Très bon)`;
      } else if (accRound < 100) {
        accuracyText = `🟡 ±${accRound}m (Bon)`;
      } else if (accRound < 500) {
        accuracyText = `🟠 ±${accRound}m (Moyen)`;
      } else {
        accuracyText = `🔴 ±${accRound}m (Faible - GPS non disponible)`;
      }
    }
    document.getElementById('accuracyValue').textContent = accuracyText;

    // Altitude
    if (altitude !== null && !isNaN(altitude)) {
      document.getElementById('altitudeValue').textContent = `${Math.round(altitude)}m`;
    } else {
      document.getElementById('altitudeValue').textContent = '--';
    }

    // Coordonnées
    document.getElementById('currentCoordsValue').textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

    // ETA
    this.updateETA(distance, metrics);

    // Message de statut
    this.updateTrackingStatus(distance);
  }

  updateTrackingStatus(distance) {
    const statusEl = document.getElementById('statusText');
    if (!statusEl) return;

    const zoneRadius = this.zoneRadius || 1000;
    
    if (distance <= zoneRadius) {
      statusEl.innerHTML = `<span class="status-arrived">🎯 DANS LA ZONE ! (${Math.round(distance)}m)</span>`;
    } else if (distance <= zoneRadius * 1.5) {
      statusEl.innerHTML = `<span class="status-approaching">⚠️ Vous approchez ! (${Math.round(distance)}m)</span>`;
    } else {
      statusEl.textContent = `En route... (${Math.round(distance)}m restants)`;
    }
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

  updateETA(distance, metrics = null) {
    const etaElement = document.getElementById('etaValue');
    if (!etaElement) return;

    // Utiliser la vitesse actuelle ou estimer
    let speed = this.currentSpeed || (metrics?.speedKmh) || 0;

    if (speed > 1) {
      // Calcul basé sur la vitesse actuelle
      const hoursRemaining = (distance / 1000) / speed;
      const minutesRemaining = Math.round(hoursRemaining * 60);

      if (minutesRemaining < 1) {
        etaElement.textContent = '< 1 min';
      } else if (minutesRemaining < 60) {
        etaElement.textContent = `~${minutesRemaining} min`;
      } else {
        const hours = Math.floor(minutesRemaining / 60);
        const mins = minutesRemaining % 60;
        etaElement.textContent = `~${hours}h${mins.toString().padStart(2, '0')}`;
      }
    } else {
      // Estimer avec vitesse de marche (5 km/h)
      const walkingSpeed = 5;
      const hoursRemaining = (distance / 1000) / walkingSpeed;
      const minutesRemaining = Math.round(hoursRemaining * 60);

      if (minutesRemaining < 1) {
        etaElement.textContent = '< 1 min 🚶';
      } else if (minutesRemaining < 60) {
        etaElement.textContent = `~${minutesRemaining} min 🚶`;
      } else {
        const hours = Math.floor(minutesRemaining / 60);
        const mins = minutesRemaining % 60;
        etaElement.textContent = `~${hours}h${mins.toString().padStart(2, '0')} 🚶`;
      }
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

  async handleArrival(distance, position) {
    const distanceText = distance >= 1000 
      ? `${(distance / 1000).toFixed(1)} km` 
      : `${Math.round(distance)} m`;

    console.log('🎯 ARRIVÉE DÉCLENCHÉE !', { distance, distanceText });

    // Afficher le message
    const statusEl = document.getElementById('statusText');
    if (statusEl) {
      statusEl.innerHTML = `<span class="status-arrived">🎉 VOUS ÊTES ARRIVÉ ! (${distanceText})</span>`;
    }

    // Déclencher les alertes
    const settings = storageService.getSettings();
    const alertType = settings.alertType || 'all';

    const stepInfo = this.destinations.length > 1 
      ? `Étape ${this.currentDestinationIndex + 1}/${this.destinations.length}`
      : '';

    const alertOptions = {
      title: '🎯 Terminus - Arrivée !',
      body: `${stepInfo ? stepInfo + ' : ' : ''}Vous êtes à ${distanceText} de votre destination !`,
      repeats: settings.repeatCount || 0, // 0 = jusqu'à désactivation
      sound: alertType === 'all' || alertType.includes('sound'),
      vibration: alertType === 'all' || alertType.includes('vibration'),
      notification: alertType === 'all' || alertType.includes('notification')
    };

    try {
      await alertService.triggerFullAlert(alertOptions);
    } catch (e) {
      console.error('Erreur alerte:', e);
    }

    // Toast
    this.showToast(`🎉 ${stepInfo ? stepInfo + ' ' : ''}Destination atteinte ! (${distanceText})`, 'success');

    // Si multi-destinations, passer à la suivante après 5 secondes
    if (this.destinations.length > 1 && this.currentDestinationIndex < this.destinations.length - 1) {
      setTimeout(() => {
        if (confirm(`Étape ${this.currentDestinationIndex + 1} terminée ! Passer à l'étape suivante ?`)) {
          this.goToNextDestination();
        }
      }, 5000);
    }
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

  // ===== HISTORY =====
  openHistory() {
    this.displayHistory();
    this.updateHistoryStats();
    document.getElementById('historyModal').classList.add('show');
  }

  closeHistory() {
    document.getElementById('historyModal').classList.remove('show');
  }

  switchHistoryTab(tabName) {
    // Update tabs
    document.querySelectorAll('.history-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update content
    document.getElementById('historyTripsTab').style.display = tabName === 'trips' ? 'block' : 'none';
    document.getElementById('historyStatsTab').style.display = tabName === 'stats' ? 'block' : 'none';

    if (tabName === 'stats') {
      this.displayDetailedStats();
    }
  }

  displayHistory() {
    const trips = historyService.getAllTrips();
    const container = document.getElementById('tripsList');

    if (trips.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucun trajet enregistré.<br>Les trajets terminés apparaîtront ici.</p>';
      return;
    }

    container.innerHTML = trips.map(trip => {
      const distance = historyService.formatDistance(trip.distance);
      const duration = historyService.formatDuration(trip.duration);
      const date = historyService.formatDate(trip.startTime);
      const speed = trip.averageSpeed > 0 ? `${trip.averageSpeed} km/h` : '--';

      return `
        <div class="trip-item">
          <div class="trip-header">
            <div class="trip-date">${date}</div>
            <button type="button" class="trip-delete" onclick="app.deleteTrip('${trip.id}')" title="Supprimer">🗑️</button>
          </div>
          <div class="trip-route">
            <div class="trip-from">📍 ${trip.startLocation.address}</div>
            <div class="trip-arrow">↓</div>
            <div class="trip-to">🎯 ${trip.endLocation.address}</div>
          </div>
          <div class="trip-metrics">
            <span class="trip-metric">📏 ${distance}</span>
            <span class="trip-metric">⏱️ ${duration}</span>
            <span class="trip-metric">🚗 ${speed}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  updateHistoryStats() {
    const stats = historyService.getStatistics();

    document.getElementById('statTotalTrips').textContent = stats.totalTrips;
    document.getElementById('statTotalDistance').textContent = `${stats.totalDistanceKm} km`;
    document.getElementById('statTotalTime').textContent = historyService.formatDuration(stats.totalDuration);
    document.getElementById('statTimeSaved').textContent = `${stats.totalTimeSaved} min`;
  }

  displayDetailedStats() {
    const stats = historyService.getStatistics();

    document.getElementById('statAvgDistance').textContent = historyService.formatDistance(stats.averageDistance);
    document.getElementById('statAvgDuration').textContent = historyService.formatDuration(stats.averageDuration);
    document.getElementById('statAvgSpeed').textContent = stats.averageSpeed > 0 ? `${stats.averageSpeed} km/h` : '--';

    if (stats.longestTrip) {
      document.getElementById('statLongestTrip').textContent = historyService.formatDistance(stats.longestTrip.distance);
    } else {
      document.getElementById('statLongestTrip').textContent = '--';
    }

    if (stats.fastestTrip) {
      document.getElementById('statMaxSpeed').textContent = `${stats.fastestTrip.maxSpeed} km/h`;
    } else {
      document.getElementById('statMaxSpeed').textContent = '--';
    }
  }

  deleteTrip(id) {
    if (confirm('Supprimer ce trajet de l\'historique ?')) {
      historyService.deleteTrip(id);
      this.displayHistory();
      this.updateHistoryStats();
      this.showToast('Trajet supprimé', 'success');
    }
  }

  exportHistory() {
    const json = historyService.exportHistory();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminus-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Historique exporté', 'success');
  }

  importHistory() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = historyService.importHistory(event.target.result);
        if (result.success) {
          this.displayHistory();
          this.updateHistoryStats();
          this.showToast(`${result.imported} trajets importés`, 'success');
        } else {
          this.showToast('Erreur d\'import: ' + result.message, 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  clearHistory() {
    if (confirm('⚠️ Supprimer TOUT l\'historique ? Cette action est irréversible.')) {
      historyService.clearHistory();
      this.displayHistory();
      this.updateHistoryStats();
      this.showToast('Historique effacé', 'success');
    }
  }

  // ===== CALENDAR =====
  openCalendar() {
    this.displayCalendarEvents();
    document.getElementById('calendarModal').classList.add('show');
  }

  closeCalendar() {
    document.getElementById('calendarModal').classList.remove('show');
  }

  async importCalendar(file) {
    try {
      this.showToast('📅 Import du calendrier...', 'info');
      const events = await calendarService.importICS(file);
      this.displayCalendarEvents();
      this.showToast(`${events.length} événements importés`, 'success');
    } catch (error) {
      this.showToast('Erreur d\'import: ' + error.message, 'error');
    }
  }

  displayCalendarEvents() {
    const container = document.getElementById('calendarEvents');
    const upcoming = calendarService.getUpcomingEvents(20);

    if (upcoming.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucun événement à venir.<br>Importez un fichier .ics pour commencer.</p>';
      return;
    }

    container.innerHTML = upcoming.map(event => {
      const date = calendarService.formatEventDate(event);
      const hasLocation = event.location && event.location.trim().length > 0;

      return `
        <div class="calendar-event">
          <div class="event-date">${date}</div>
          <div class="event-info">
            <div class="event-title">${event.summary || 'Sans titre'}</div>
            ${event.location ? `<div class="event-location">📍 ${event.location}</div>` : ''}
            ${event.description ? `<div class="event-description">${this.truncateText(event.description, 100)}</div>` : ''}
          </div>
          ${hasLocation ? `
            <button type="button" class="btn-secondary" onclick="app.setDestinationFromEvent('${event.id}')" title="Définir comme destination">
              🎯
            </button>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  async setDestinationFromEvent(eventId) {
    const event = calendarService.events.find(e => e.id === eventId);
    if (!event || !event.location) {
      this.showToast('Cet événement n\'a pas de localisation', 'error');
      return;
    }

    // Rechercher l'adresse
    this.showToast('🔍 Recherche de l\'adresse...', 'info');
    const locationResult = await calendarService.searchAddressInEvent(event);

    if (locationResult) {
      this.setDestination(locationResult);
      this.closeCalendar();
      this.showToast('📍 Destination définie depuis le calendrier', 'success');
    } else {
      // Essayer de géocoder directement la localisation
      try {
        const results = await searchService.search(event.location);
        if (results && results.length > 0) {
          this.setDestination(results[0]);
          this.closeCalendar();
          this.showToast('📍 Destination définie', 'success');
        } else {
          this.showToast('Adresse introuvable dans l\'événement', 'error');
        }
      } catch (e) {
        this.showToast('Erreur de recherche', 'error');
      }
    }
  }

  // ===== SHARE POSITION =====
  async startSharingPosition() {
    if (!this.isTracking) {
      this.showToast('Démarrez d\'abord le suivi', 'error');
      return;
    }

    try {
      const result = await shareService.startSharing({
        destination: this.currentDestination,
        duration: 3600000 // 1 heure
      });

      // Partager via l'API native ou copier
      const shareResult = await shareService.shareViaNative({
        shareUrl: result.shareUrl
      });

      if (shareResult.success) {
        if (shareResult.method === 'clipboard') {
          this.showToast('📋 Lien copié ! Partagez-le avec vos proches', 'success');
        } else {
          this.showToast('✅ Position partagée', 'success');
        }
      }

      // Afficher les infos de partage
      this.showShareInfo(result);
    } catch (error) {
      this.showToast('Erreur de partage: ' + error.message, 'error');
    }
  }

  showShareInfo(shareInfo) {
    const message = `📍 Position partagée !\n\nLien: ${shareInfo.shareUrl}\n\nExpire: ${shareInfo.expiresAt.toLocaleTimeString('fr-FR')}`;
    alert(message);
  }

  // Initialiser le visualiseur de partage
  initShareViewer(shareId) {
    // Modifier l'interface pour le mode visualisation
    document.querySelector('.main .container').innerHTML = `
      <div class="share-viewer">
        <div class="card">
          <h2>📍 Suivi de position en temps réel</h2>
          <div id="shareStatus">Chargement...</div>
          <div id="shareMap" style="height: 400px; margin-top: 20px;"></div>
          <div id="shareInfo" style="margin-top: 20px;"></div>
        </div>
      </div>
    `;

    // Initialiser la carte pour la visualisation
    mapService.init('shareMap');

    // Démarrer la mise à jour
    this.updateShareViewer(shareId);
    setInterval(() => this.updateShareViewer(shareId), 5000);
  }

  updateShareViewer(shareId) {
    const positions = shareService.getSharedPositions(shareId);

    if (!positions || !positions.isActive) {
      document.getElementById('shareStatus').textContent = 'Partage expiré ou arrêté';
      return;
    }

    const lastPos = positions.positions[positions.positions.length - 1];
    if (!lastPos) {
      document.getElementById('shareStatus').textContent = 'En attente de position...';
      return;
    }

    // Afficher le statut
    const timeRemaining = shareService.formatTimeRemaining(
      shareService.getShareData(shareId)?.expiry
    );
    document.getElementById('shareStatus').innerHTML = `
      <div>📍 Position mise à jour il y a ${Math.round((Date.now() - lastPos.timestamp) / 1000)}s</div>
      <div>⏱️ Expire dans: ${timeRemaining}</div>
    `;

    // Mettre à jour la carte
    mapService.setCenter(lastPos.lat, lastPos.lng, 15);
    mapService.updateCurrentPosition(lastPos.lat, lastPos.lng);

    // Afficher le trajet si plusieurs positions
    if (positions.positions.length > 1) {
      const path = positions.positions.map(p => [p.lat, p.lng]);
      if (mapService.routeLine) {
        mapService.map.removeLayer(mapService.routeLine);
      }
      mapService.routeLine = L.polyline(path, {
        color: '#00d9ff',
        weight: 3,
        opacity: 0.7
      }).addTo(mapService.map);
    }

    // Afficher les infos
    const info = document.getElementById('shareInfo');
    info.innerHTML = `
      <div>📍 ${lastPos.lat.toFixed(5)}, ${lastPos.lng.toFixed(5)}</div>
      ${lastPos.speed > 0 ? `<div>🚗 ${Math.round(lastPos.speed * 3.6)} km/h</div>` : ''}
      ${lastPos.accuracy ? `<div>📡 Précision: ±${Math.round(lastPos.accuracy)}m</div>` : ''}
    `;
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
