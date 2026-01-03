// Configuration globale de Terminus
const CONFIG = {
  // App Info
  app: {
    name: 'Terminus',
    version: '3.0.0',
    description: 'Réveillez-vous à destination',
    author: 'Amar Benkherouf',
    authorUrl: 'https://github.com/benzoXdev',
    repository: 'https://github.com/benzoXdev/terminus',
    license: 'MIT'
  },

  // API Endpoints
  api: {
    // Géocodage
    nominatim: 'https://nominatim.openstreetmap.org',
    photon: 'https://photon.komoot.io/api',

    // IP Geolocation
    ipapi: 'https://ipapi.co/json/',
    ipapiFallback: 'https://ip-api.com/json/',

    // Météo
    openMeteo: 'https://api.open-meteo.com/v1/forecast',

    // Transport public
    overpass: 'https://overpass-api.de/api/interpreter',

    // Tuiles carte
    mapTiles: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    mapTilesDark: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
    mapAttribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  },

  // Paramètres par défaut
  defaults: {
    // Position par défaut (Montréal)
    location: {
      lat: 45.5017,
      lng: -73.5673,
      zoom: 13
    },

    // Alertes
    alertDistance: 1000, // mètres
    alertType: 'all', // 'sound', 'vibration', 'notification', 'all'
    soundType: 'alarm1',

    // Thème
    theme: 'dark',

    // Unités
    units: 'metric', // 'metric' ou 'imperial'

    // Tracking
    trackingAccuracy: 'high', // 'high', 'balanced', 'low'
    trackingInterval: 5000, // ms
  },

  // Limites
  limits: {
    // Recherche
    searchResultsMax: 10,
    autocompleteDelay: 300, // ms
    cacheTimeout: 5 * 60 * 1000, // 5 minutes

    // Zone d'alerte
    zoneRadiusMin: 100, // mètres
    zoneRadiusMax: 10000, // mètres

    // Favoris
    maxFavorites: 50,

    // API
    apiTimeout: 10000, // ms
    apiRetries: 2
  },

  // Vitesses moyennes (km/h) pour estimation
  speeds: {
    walk: 5,
    bike: 15,
    car: 40,
    transit: 25
  },

  // Types de transport
  transportTypes: {
    train: { icon: '🚉', label: 'Train/Gare', osmTag: 'railway=station' },
    subway: { icon: '🚇', label: 'Métro', osmTag: 'station=subway' },
    bus: { icon: '🚌', label: 'Bus', osmTag: 'highway=bus_stop' },
    tram: { icon: '🚊', label: 'Tramway', osmTag: 'railway=tram_stop' },
    ferry: { icon: '⛴️', label: 'Ferry', osmTag: 'amenity=ferry_terminal' },
    airport: { icon: '✈️', label: 'Aéroport', osmTag: 'aeroway=aerodrome' }
  },

  // Codes météo WMO
  weatherCodes: {
    0: { description: 'Ciel dégagé', iconDay: '☀️', iconNight: '🌙' },
    1: { description: 'Principalement dégagé', iconDay: '🌤️', iconNight: '🌙' },
    2: { description: 'Partiellement nuageux', iconDay: '⛅', iconNight: '☁️' },
    3: { description: 'Couvert', iconDay: '☁️', iconNight: '☁️' },
    45: { description: 'Brouillard', iconDay: '🌫️', iconNight: '🌫️' },
    48: { description: 'Brouillard givrant', iconDay: '🌫️', iconNight: '🌫️' },
    51: { description: 'Bruine légère', iconDay: '🌧️', iconNight: '🌧️' },
    53: { description: 'Bruine modérée', iconDay: '🌧️', iconNight: '🌧️' },
    55: { description: 'Bruine dense', iconDay: '🌧️', iconNight: '🌧️' },
    61: { description: 'Pluie légère', iconDay: '🌧️', iconNight: '🌧️' },
    63: { description: 'Pluie modérée', iconDay: '🌧️', iconNight: '🌧️' },
    65: { description: 'Pluie forte', iconDay: '🌧️', iconNight: '🌧️' },
    71: { description: 'Neige légère', iconDay: '❄️', iconNight: '❄️' },
    73: { description: 'Neige modérée', iconDay: '❄️', iconNight: '❄️' },
    75: { description: 'Neige forte', iconDay: '❄️', iconNight: '❄️' },
    77: { description: 'Grains de neige', iconDay: '🌨️', iconNight: '🌨️' },
    80: { description: 'Averses légères', iconDay: '🌦️', iconNight: '🌧️' },
    81: { description: 'Averses modérées', iconDay: '🌦️', iconNight: '🌧️' },
    82: { description: 'Averses violentes', iconDay: '⛈️', iconNight: '⛈️' },
    95: { description: 'Orage', iconDay: '⛈️', iconNight: '⛈️' },
    96: { description: 'Orage avec grêle', iconDay: '⛈️', iconNight: '⛈️' },
    99: { description: 'Orage violent', iconDay: '⛈️', iconNight: '⛈️' }
  },

  // Directions cardinales
  cardinalDirections: [
    { min: 348.75, max: 360, label: 'N', full: 'Nord' },
    { min: 0, max: 11.25, label: 'N', full: 'Nord' },
    { min: 11.25, max: 33.75, label: 'NNE', full: 'Nord-Nord-Est' },
    { min: 33.75, max: 56.25, label: 'NE', full: 'Nord-Est' },
    { min: 56.25, max: 78.75, label: 'ENE', full: 'Est-Nord-Est' },
    { min: 78.75, max: 101.25, label: 'E', full: 'Est' },
    { min: 101.25, max: 123.75, label: 'ESE', full: 'Est-Sud-Est' },
    { min: 123.75, max: 146.25, label: 'SE', full: 'Sud-Est' },
    { min: 146.25, max: 168.75, label: 'SSE', full: 'Sud-Sud-Est' },
    { min: 168.75, max: 191.25, label: 'S', full: 'Sud' },
    { min: 191.25, max: 213.75, label: 'SSO', full: 'Sud-Sud-Ouest' },
    { min: 213.75, max: 236.25, label: 'SO', full: 'Sud-Ouest' },
    { min: 236.25, max: 258.75, label: 'OSO', full: 'Ouest-Sud-Ouest' },
    { min: 258.75, max: 281.25, label: 'O', full: 'Ouest' },
    { min: 281.25, max: 303.75, label: 'ONO', full: 'Ouest-Nord-Ouest' },
    { min: 303.75, max: 326.25, label: 'NO', full: 'Nord-Ouest' },
    { min: 326.25, max: 348.75, label: 'NNO', full: 'Nord-Nord-Ouest' }
  ],

  // Messages d'erreur
  errors: {
    geolocationDenied: 'Accès à la localisation refusé. Veuillez autoriser l\'accès dans les paramètres.',
    geolocationUnavailable: 'Localisation non disponible. Vérifiez votre connexion GPS.',
    geolocationTimeout: 'Délai de localisation dépassé. Réessayez.',
    networkError: 'Erreur réseau. Vérifiez votre connexion internet.',
    searchError: 'Erreur lors de la recherche. Réessayez.',
    noResults: 'Aucun résultat trouvé.',
    invalidCoords: 'Coordonnées invalides.',
    notificationDenied: 'Notifications non autorisées.'
  },

  // Messages de succès
  success: {
    destinationSet: '📍 Destination définie',
    trackingStarted: '🚀 Suivi démarré',
    trackingStopped: 'Suivi arrêté',
    favoriteAdded: '⭐ Ajouté aux favoris',
    favoriteRemoved: 'Favori supprimé',
    positionUpdated: '📍 Position mise à jour',
    arrived: '🎉 Vous êtes arrivé !'
  }
};

// Freeze config pour éviter les modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.app);
Object.freeze(CONFIG.api);
Object.freeze(CONFIG.defaults);
Object.freeze(CONFIG.limits);
Object.freeze(CONFIG.speeds);
Object.freeze(CONFIG.transportTypes);
Object.freeze(CONFIG.weatherCodes);
Object.freeze(CONFIG.errors);
Object.freeze(CONFIG.success);

