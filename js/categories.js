// Catégories et emojis pour Terminus
const PLACE_CATEGORIES = {
  // 🚆 TRANSPORTS
  transport: {
    train: { emoji: '🚉', label: 'Gare', keywords: ['gare', 'train', 'station', 'railway', 'sncf', 'tgv'] },
    subway: { emoji: '🚇', label: 'Métro', keywords: ['metro', 'métro', 'subway', 'underground'] },
    bus: { emoji: '🚌', label: 'Bus', keywords: ['bus', 'autobus', 'bus_stop', 'bus_station'] },
    tram: { emoji: '🚊', label: 'Tramway', keywords: ['tram', 'tramway', 'light_rail'] },
    airport: { emoji: '✈️', label: 'Aéroport', keywords: ['airport', 'aéroport', 'aerodrome', 'aeroport'] },
    ferry: { emoji: '⛴️', label: 'Ferry', keywords: ['ferry', 'port', 'harbour', 'harbor'] },
    taxi: { emoji: '🚕', label: 'Taxi', keywords: ['taxi', 'cab'] },
    parking: { emoji: '🅿️', label: 'Parking', keywords: ['parking', 'car_park'] },
    fuel: { emoji: '⛽', label: 'Station-service', keywords: ['fuel', 'gas_station', 'petrol', 'essence'] },
    charging: { emoji: '🔌', label: 'Borne recharge', keywords: ['charging', 'ev_charging', 'electric'] }
  },

  // 🏪 COMMERCES
  shopping: {
    supermarket: { emoji: '🛒', label: 'Supermarché', keywords: ['supermarket', 'supermarché', 'grocery'] },
    mall: { emoji: '🏬', label: 'Centre commercial', keywords: ['mall', 'shopping_centre', 'shopping_center'] },
    shop: { emoji: '🏪', label: 'Magasin', keywords: ['shop', 'store', 'retail'] },
    clothes: { emoji: '👕', label: 'Vêtements', keywords: ['clothes', 'fashion', 'boutique'] },
    electronics: { emoji: '📱', label: 'Électronique', keywords: ['electronics', 'computer', 'mobile'] },
    bakery: { emoji: '🥖', label: 'Boulangerie', keywords: ['bakery', 'boulangerie', 'bread'] },
    butcher: { emoji: '🥩', label: 'Boucherie', keywords: ['butcher', 'boucherie', 'meat'] },
    pharmacy: { emoji: '💊', label: 'Pharmacie', keywords: ['pharmacy', 'pharmacie', 'chemist', 'drugstore'] },
    florist: { emoji: '💐', label: 'Fleuriste', keywords: ['florist', 'flowers', 'fleuriste'] },
    jewelry: { emoji: '💎', label: 'Bijouterie', keywords: ['jewelry', 'jewellery', 'bijouterie'] },
    bookshop: { emoji: '📚', label: 'Librairie', keywords: ['books', 'bookshop', 'library'] },
    optician: { emoji: '👓', label: 'Opticien', keywords: ['optician', 'optique', 'glasses'] }
  },

  // 🍽️ RESTAURATION
  food: {
    restaurant: { emoji: '🍽️', label: 'Restaurant', keywords: ['restaurant', 'dining'] },
    fastfood: { emoji: '🍔', label: 'Fast-food', keywords: ['fast_food', 'fastfood', 'burger', 'mcdonalds'] },
    cafe: { emoji: '☕', label: 'Café', keywords: ['cafe', 'coffee', 'café', 'starbucks'] },
    bar: { emoji: '🍺', label: 'Bar', keywords: ['bar', 'pub', 'brewery'] },
    pizza: { emoji: '🍕', label: 'Pizzeria', keywords: ['pizza', 'pizzeria', 'italian'] },
    sushi: { emoji: '🍣', label: 'Sushi', keywords: ['sushi', 'japanese', 'japonais'] },
    icecream: { emoji: '🍦', label: 'Glacier', keywords: ['ice_cream', 'glacier', 'gelato'] },
    bakery_food: { emoji: '🥐', label: 'Pâtisserie', keywords: ['pastry', 'patisserie', 'croissant'] }
  },

  // 🏨 HÉBERGEMENT
  accommodation: {
    hotel: { emoji: '🏨', label: 'Hôtel', keywords: ['hotel', 'hôtel', 'motel', 'inn'] },
    hostel: { emoji: '🛏️', label: 'Auberge', keywords: ['hostel', 'auberge', 'youth_hostel'] },
    camping: { emoji: '⛺', label: 'Camping', keywords: ['camp', 'camping', 'caravan'] },
    apartment: { emoji: '🏢', label: 'Appartement', keywords: ['apartment', 'flat', 'airbnb'] }
  },

  // 🏛️ CULTURE & LOISIRS
  culture: {
    museum: { emoji: '🏛️', label: 'Musée', keywords: ['museum', 'musée', 'gallery'] },
    theatre: { emoji: '🎭', label: 'Théâtre', keywords: ['theatre', 'theater', 'théâtre'] },
    cinema: { emoji: '🎬', label: 'Cinéma', keywords: ['cinema', 'movie', 'film'] },
    library: { emoji: '📖', label: 'Bibliothèque', keywords: ['library', 'bibliothèque'] },
    concert: { emoji: '🎵', label: 'Salle de concert', keywords: ['concert', 'music_venue', 'nightclub'] },
    casino: { emoji: '🎰', label: 'Casino', keywords: ['casino', 'gambling'] },
    zoo: { emoji: '🦁', label: 'Zoo', keywords: ['zoo', 'aquarium', 'animal'] },
    amusement: { emoji: '🎢', label: 'Parc d\'attractions', keywords: ['amusement', 'theme_park', 'attraction'] }
  },

  // ⚽ SPORTS
  sports: {
    stadium: { emoji: '🏟️', label: 'Stade', keywords: ['stadium', 'stade', 'arena'] },
    gym: { emoji: '🏋️', label: 'Salle de sport', keywords: ['gym', 'fitness', 'sport'] },
    pool: { emoji: '🏊', label: 'Piscine', keywords: ['pool', 'swimming', 'piscine'] },
    tennis: { emoji: '🎾', label: 'Tennis', keywords: ['tennis', 'court'] },
    golf: { emoji: '⛳', label: 'Golf', keywords: ['golf', 'course'] },
    ski: { emoji: '⛷️', label: 'Station de ski', keywords: ['ski', 'snowboard', 'winter_sports'] }
  },

  // 🏥 SANTÉ
  health: {
    hospital: { emoji: '🏥', label: 'Hôpital', keywords: ['hospital', 'hôpital', 'clinic', 'clinique'] },
    doctor: { emoji: '👨‍⚕️', label: 'Médecin', keywords: ['doctor', 'médecin', 'doctors'] },
    dentist: { emoji: '🦷', label: 'Dentiste', keywords: ['dentist', 'dentiste', 'dental'] },
    veterinary: { emoji: '🐾', label: 'Vétérinaire', keywords: ['veterinary', 'vet', 'animal_hospital'] }
  },

  // 🎓 ÉDUCATION
  education: {
    school: { emoji: '🏫', label: 'École', keywords: ['school', 'école', 'primary', 'secondary'] },
    university: { emoji: '🎓', label: 'Université', keywords: ['university', 'université', 'college', 'campus'] },
    kindergarten: { emoji: '💒', label: 'Crèche', keywords: ['kindergarten', 'nursery', 'creche'] }
  },

  // 🏢 SERVICES
  services: {
    bank: { emoji: '🏦', label: 'Banque', keywords: ['bank', 'banque', 'atm'] },
    post: { emoji: '📮', label: 'Poste', keywords: ['post_office', 'poste', 'mail'] },
    police: { emoji: '👮', label: 'Police', keywords: ['police', 'gendarmerie'] },
    fire: { emoji: '🚒', label: 'Pompiers', keywords: ['fire_station', 'pompiers'] },
    townhall: { emoji: '🏛️', label: 'Mairie', keywords: ['townhall', 'mairie', 'city_hall', 'government'] },
    embassy: { emoji: '🏳️', label: 'Ambassade', keywords: ['embassy', 'consulate', 'ambassade'] }
  },

  // 🌳 NATURE & PLEIN AIR
  nature: {
    park: { emoji: '🌳', label: 'Parc', keywords: ['park', 'parc', 'garden', 'jardin'] },
    beach: { emoji: '🏖️', label: 'Plage', keywords: ['beach', 'plage', 'seaside', 'coast'] },
    mountain: { emoji: '⛰️', label: 'Montagne', keywords: ['mountain', 'montagne', 'peak', 'summit'] },
    lake: { emoji: '🏞️', label: 'Lac', keywords: ['lake', 'lac', 'pond', 'reservoir'] },
    forest: { emoji: '🌲', label: 'Forêt', keywords: ['forest', 'forêt', 'wood', 'nature_reserve'] },
    viewpoint: { emoji: '🔭', label: 'Point de vue', keywords: ['viewpoint', 'panorama', 'lookout'] }
  },

  // 🏙️ LIEUX
  places: {
    city: { emoji: '🏙️', label: 'Ville', keywords: ['city', 'ville', 'town', 'municipality'] },
    village: { emoji: '🏘️', label: 'Village', keywords: ['village', 'hamlet'] },
    district: { emoji: '📍', label: 'Quartier', keywords: ['district', 'neighbourhood', 'suburb', 'arrondissement'] },
    monument: { emoji: '🗼', label: 'Monument', keywords: ['monument', 'memorial', 'landmark', 'tower'] },
    castle: { emoji: '🏰', label: 'Château', keywords: ['castle', 'château', 'palace', 'fortress'] },
    church: { emoji: '⛪', label: 'Église', keywords: ['church', 'église', 'chapel', 'cathedral'] },
    mosque: { emoji: '🕌', label: 'Mosquée', keywords: ['mosque', 'mosquée'] },
    synagogue: { emoji: '🕍', label: 'Synagogue', keywords: ['synagogue'] },
    temple: { emoji: '🛕', label: 'Temple', keywords: ['temple', 'shrine', 'buddhist'] }
  }
};

// Fonction pour obtenir l'emoji d'un lieu
function getPlaceEmoji(type, category, name, tags = {}) {
  const searchTerms = [
    type?.toLowerCase(),
    category?.toLowerCase(),
    name?.toLowerCase(),
    tags?.amenity?.toLowerCase(),
    tags?.shop?.toLowerCase(),
    tags?.tourism?.toLowerCase(),
    tags?.leisure?.toLowerCase(),
    tags?.building?.toLowerCase()
  ].filter(Boolean);

  // Rechercher dans toutes les catégories
  for (const [catKey, catValue] of Object.entries(PLACE_CATEGORIES)) {
    for (const [placeKey, placeValue] of Object.entries(catValue)) {
      for (const keyword of placeValue.keywords) {
        for (const term of searchTerms) {
          if (term.includes(keyword) || keyword.includes(term)) {
            return {
              emoji: placeValue.emoji,
              label: placeValue.label,
              category: catKey,
              type: placeKey
            };
          }
        }
      }
    }
  }

  // Emoji par défaut basé sur le type général
  if (type) {
    if (type.includes('restaurant') || type.includes('food')) return { emoji: '🍽️', label: 'Restaurant', category: 'food', type: 'restaurant' };
    if (type.includes('shop') || type.includes('store')) return { emoji: '🏪', label: 'Magasin', category: 'shopping', type: 'shop' };
    if (type.includes('hotel') || type.includes('accommodation')) return { emoji: '🏨', label: 'Hôtel', category: 'accommodation', type: 'hotel' };
    if (type.includes('station')) return { emoji: '🚉', label: 'Station', category: 'transport', type: 'train' };
  }

  return { emoji: '📍', label: 'Lieu', category: 'places', type: 'default' };
}

// Options de filtrage
const FILTER_OPTIONS = {
  sortBy: [
    { value: 'distance_asc', label: '📍 Plus proche', icon: '↑' },
    { value: 'distance_desc', label: '📍 Plus loin', icon: '↓' },
    { value: 'name_asc', label: '🔤 A → Z', icon: 'A' },
    { value: 'name_desc', label: '🔤 Z → A', icon: 'Z' },
    { value: 'type', label: '📁 Par type', icon: '📁' }
  ],
  categories: [
    { value: 'all', label: '🌐 Tout', emoji: '🌐' },
    { value: 'transport', label: '🚆 Transports', emoji: '🚆' },
    { value: 'shopping', label: '🛒 Commerces', emoji: '🛒' },
    { value: 'food', label: '🍽️ Restauration', emoji: '🍽️' },
    { value: 'accommodation', label: '🏨 Hébergement', emoji: '🏨' },
    { value: 'culture', label: '🏛️ Culture', emoji: '🏛️' },
    { value: 'sports', label: '⚽ Sports', emoji: '⚽' },
    { value: 'health', label: '🏥 Santé', emoji: '🏥' },
    { value: 'education', label: '🎓 Éducation', emoji: '🎓' },
    { value: 'services', label: '🏦 Services', emoji: '🏦' },
    { value: 'nature', label: '🌳 Nature', emoji: '🌳' },
    { value: 'places', label: '🏙️ Lieux', emoji: '🏙️' }
  ]
};

// Fonction de tri des résultats
function sortResults(results, sortBy) {
  const sorted = [...results];

  switch (sortBy) {
    case 'distance_asc':
      return sorted.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    case 'distance_desc':
      return sorted.sort((a, b) => (b.distance || 0) - (a.distance || 0));
    case 'name_asc':
      return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    case 'name_desc':
      return sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    case 'type':
      return sorted.sort((a, b) => (a.placeInfo?.category || '').localeCompare(b.placeInfo?.category || ''));
    default:
      return sorted;
  }
}

// Fonction de filtrage par catégorie
function filterByCategory(results, category) {
  if (!category || category === 'all') return results;
  return results.filter(r => r.placeInfo?.category === category);
}

// Prix moyens des transports (estimations générales)
const TRANSPORT_PRICES = {
  // Prix par km en euros (estimation)
  bus: { perKm: 0.10, base: 1.90, label: 'Bus urbain' },
  metro: { perKm: 0.15, base: 1.90, label: 'Métro' },
  tram: { perKm: 0.12, base: 1.90, label: 'Tramway' },
  train_regional: { perKm: 0.12, base: 3.00, label: 'TER' },
  train_intercity: { perKm: 0.08, base: 15.00, label: 'Intercités' },
  train_highspeed: { perKm: 0.10, base: 25.00, label: 'TGV' },
  taxi: { perKm: 1.50, base: 3.00, label: 'Taxi' },
  uber: { perKm: 1.20, base: 2.50, label: 'VTC' },
  flight: { perKm: 0.05, base: 50.00, label: 'Avion' },

  // Par pays (ajustements)
  countryMultipliers: {
    FR: 1.0,
    BE: 1.1,
    CH: 1.8,
    DE: 0.9,
    ES: 0.85,
    IT: 0.9,
    UK: 1.3,
    US: 0.7,
    CA: 0.8,
    default: 1.0
  }
};

// Estimer le prix d'un trajet
function estimateTransportPrice(distanceKm, transportType, countryCode = 'FR') {
  const prices = TRANSPORT_PRICES[transportType];
  if (!prices) return null;

  const multiplier = TRANSPORT_PRICES.countryMultipliers[countryCode] ||
                     TRANSPORT_PRICES.countryMultipliers.default;

  const price = (prices.base + (distanceKm * prices.perKm)) * multiplier;

  return {
    min: Math.max(1, Math.round((price * 0.8) * 100) / 100),
    max: Math.round((price * 1.2) * 100) / 100,
    average: Math.round(price * 100) / 100,
    currency: getCurrencyForCountry(countryCode),
    type: prices.label
  };
}

function getCurrencyForCountry(countryCode) {
  const currencies = {
    FR: '€', BE: '€', DE: '€', ES: '€', IT: '€', NL: '€', AT: '€', PT: '€', IE: '€', FI: '€',
    CH: 'CHF',
    UK: '£', GB: '£',
    US: '$', CA: '$',
    JP: '¥',
    default: '€'
  };
  return currencies[countryCode] || currencies.default;
}

// Formater le prix
function formatPrice(priceInfo) {
  if (!priceInfo) return '--';
  if (priceInfo.min === priceInfo.max) {
    return `${priceInfo.average}${priceInfo.currency}`;
  }
  return `${priceInfo.min}-${priceInfo.max}${priceInfo.currency}`;
}

