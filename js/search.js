// Service de recherche robuste multi-source pour Terminus
class SearchService {
  constructor() {
    this.sources = {
      nominatim: 'https://nominatim.openstreetmap.org',
      photon: 'https://photon.komoot.io/api',
    };
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.retryCount = 2;
    this.timeout = 10000;
  }

  // Recherche principale avec plus de résultats
  async search(query, userLocation = null, options = {}) {
    if (!query || query.trim().length < 2) return [];

    const cacheKey = `search:${query}:${userLocation?.lat?.toFixed(2) || ''}`;

    // Vérifier le cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.time < this.cacheTimeout) {
        return cached.data;
      }
    }

    // Rechercher avec les deux sources en parallèle pour plus de résultats
    const [nominatimResults, photonResults] = await Promise.all([
      this.searchNominatim(query, userLocation, { ...options, limit: 10 }),
      this.searchPhoton(query, userLocation, { limit: 8 })
    ]);

    // Combiner et dédupliquer les résultats
    let results = this.mergeResults(nominatimResults || [], photonResults || []);

    // Trier par pertinence et distance
    results = this.sortByRelevance(results, query, userLocation);

    // Limiter à 15 résultats max
    results = results.slice(0, 15);

    // Mettre en cache
    if (results.length > 0) {
      this.cache.set(cacheKey, { data: results, time: Date.now() });
    }

    return results;
  }

  // Fusionner et dédupliquer les résultats
  mergeResults(results1, results2) {
    const merged = [...results1];
    const seen = new Set(results1.map(r => `${r.lat?.toFixed(4)},${r.lng?.toFixed(4)}`));

    for (const result of results2) {
      const key = `${result.lat?.toFixed(4)},${result.lng?.toFixed(4)}`;
      if (!seen.has(key)) {
        merged.push(result);
        seen.add(key);
      }
    }

    return merged;
  }

  // Trier par pertinence
  sortByRelevance(results, query, userLocation) {
    const queryLower = query.toLowerCase();

    return results.sort((a, b) => {
      // Score de pertinence basé sur le nom
      const aNameMatch = (a.shortName || a.name || '').toLowerCase().includes(queryLower) ? 2 : 0;
      const bNameMatch = (b.shortName || b.name || '').toLowerCase().includes(queryLower) ? 2 : 0;

      // Bonus pour correspondance exacte
      const aExact = (a.shortName || '').toLowerCase() === queryLower ? 3 : 0;
      const bExact = (b.shortName || '').toLowerCase() === queryLower ? 3 : 0;

      // Score total
      const aScore = aNameMatch + aExact;
      const bScore = bNameMatch + bExact;

      if (aScore !== bScore) return bScore - aScore;

      // Sinon trier par distance
      if (userLocation && a.distance && b.distance) {
        return a.distance - b.distance;
      }

      return 0;
    });
  }

  // Recherche Nominatim améliorée
  async searchNominatim(query, userLocation, options = {}) {
    try {
      const limit = options.limit || 10;
      let url = `${this.sources.nominatim}/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1&extratags=1&namedetails=1`;

      // Biais géographique si position disponible
      if (userLocation) {
        // Viewbox large pour ne pas trop restreindre
        const delta = 5; // ~500km
        url += `&viewbox=${userLocation.lng - delta},${userLocation.lat + delta},${userLocation.lng + delta},${userLocation.lat - delta}&bounded=0`;
      }

      // Ajouter les pays acceptés pour plus de résultats
      url += '&accept-language=fr,en';

      const response = await this.fetchWithRetry(url, {
        headers: {
          'User-Agent': 'Terminus App v3.0 (https://github.com/benzoXdev/terminus)',
          'Accept-Language': 'fr,en'
        }
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.map(item => this.parseNominatimResult(item, userLocation));
    } catch (error) {
      console.error('Erreur Nominatim:', error);
      return [];
    }
  }

  // Recherche Photon améliorée
  async searchPhoton(query, userLocation, options = {}) {
    try {
      const limit = options.limit || 8;
      let url = `${this.sources.photon}?q=${encodeURIComponent(query)}&limit=${limit}&lang=fr`;

      if (userLocation) {
        url += `&lat=${userLocation.lat}&lon=${userLocation.lng}`;
      }

      const response = await this.fetchWithRetry(url);
      if (!response.ok) return [];

      const data = await response.json();
      return data.features?.map(item => this.parsePhotonResult(item, userLocation)) || [];
    } catch (error) {
      console.error('Erreur Photon:', error);
      return [];
    }
  }

  // Géocodage inverse robuste
  async reverseGeocode(lat, lng) {
    const cacheKey = `reverse:${lat.toFixed(5)},${lng.toFixed(5)}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.time < this.cacheTimeout) {
        return cached.data;
      }
    }

    // Essayer Nominatim
    let result = await this.reverseNominatim(lat, lng);

    // Fallback Photon
    if (!result) {
      result = await this.reversePhoton(lat, lng);
    }

    if (result) {
      this.cache.set(cacheKey, { data: result, time: Date.now() });
    }

    return result;
  }

  async reverseNominatim(lat, lng) {
    try {
      const url = `${this.sources.nominatim}/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&extratags=1&namedetails=1&zoom=18`;

      const response = await this.fetchWithRetry(url, {
        headers: {
          'User-Agent': 'Terminus App v3.0',
          'Accept-Language': 'fr,en'
        }
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (data.error) return null;

      return this.parseNominatimResult(data, { lat, lng });
    } catch (error) {
      return null;
    }
  }

  async reversePhoton(lat, lng) {
    try {
      const url = `${this.sources.photon}reverse?lat=${lat}&lon=${lng}&lang=fr`;

      const response = await this.fetchWithRetry(url);
      if (!response.ok) return null;

      const data = await response.json();
      if (data.features?.length > 0) {
        return this.parsePhotonResult(data.features[0], { lat, lng });
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Parser résultat Nominatim avec adresse complète
  parseNominatimResult(item, userLocation) {
    const address = item.address || {};
    const extratags = item.extratags || {};
    const namedetails = item.namedetails || {};
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);

    // Calculer distance si position utilisateur disponible
    let distance = null;
    if (userLocation) {
      distance = this.calculateDistance(userLocation.lat, userLocation.lng, lat, lng);
    }

    // Construire le nom court
    let shortName = namedetails.name || address.name || address.amenity || address.shop ||
                    address.tourism || address.building || '';

    if (!shortName && item.display_name) {
      shortName = item.display_name.split(',')[0];
    }

    // Construire l'adresse complète formatée
    const addressParts = [];

    // Numéro + rue
    if (address.house_number && address.road) {
      addressParts.push(`${address.house_number} ${address.road}`);
    } else if (address.road) {
      addressParts.push(address.road);
    } else if (address.pedestrian || address.street) {
      addressParts.push(address.pedestrian || address.street);
    }

    // Quartier
    if (address.neighbourhood || address.suburb || address.quarter) {
      addressParts.push(address.neighbourhood || address.suburb || address.quarter);
    }

    // Ville
    const city = address.city || address.town || address.village || address.municipality || address.hamlet;
    if (city) {
      addressParts.push(city);
    }

    // Code postal
    if (address.postcode) {
      addressParts.push(address.postcode);
    }

    // Pays
    if (address.country) {
      addressParts.push(address.country);
    }

    const fullAddress = addressParts.join(', ') || item.display_name;

    // Déterminer le type et l'icône
    const typeInfo = this.getTypeInfo(item.type, item.class, address, shortName);

    return {
      lat,
      lng,
      name: shortName || item.display_name,
      shortName,
      address: fullAddress,
      displayAddress: item.display_name,
      type: typeInfo.type,
      icon: typeInfo.icon,
      category: item.class,
      osmType: item.osm_type,
      osmId: item.osm_id,
      distance,
      importance: item.importance || 0,
      details: {
        houseNumber: address.house_number,
        street: address.road || address.street || address.pedestrian,
        neighbourhood: address.neighbourhood || address.suburb || address.quarter,
        city: city,
        district: address.city_district || address.district,
        county: address.county,
        state: address.state || address.province,
        postcode: address.postcode,
        country: address.country,
        countryCode: address.country_code?.toUpperCase(),
        website: extratags.website || extratags.url,
        phone: extratags.phone || extratags['contact:phone'],
        openingHours: extratags.opening_hours,
        wheelchair: extratags.wheelchair,
        operator: extratags.operator,
        cuisine: extratags.cuisine,
        stars: extratags.stars
      },
      tags: { ...address, ...extratags }
    };
  }

  // Parser résultat Photon avec adresse complète
  parsePhotonResult(item, userLocation) {
    const props = item.properties || {};
    const coords = item.geometry?.coordinates || [];
    const lat = coords[1];
    const lng = coords[0];

    if (!lat || !lng) return null;

    let distance = null;
    if (userLocation && lat && lng) {
      distance = this.calculateDistance(userLocation.lat, userLocation.lng, lat, lng);
    }

    // Nom court
    const shortName = props.name || props.street || props.city || '';

    // Construire l'adresse complète
    const addressParts = [];

    if (props.housenumber && props.street) {
      addressParts.push(`${props.housenumber} ${props.street}`);
    } else if (props.street) {
      addressParts.push(props.street);
    }

    if (props.district) {
      addressParts.push(props.district);
    }

    if (props.city) {
      addressParts.push(props.city);
    }

    if (props.postcode) {
      addressParts.push(props.postcode);
    }

    if (props.state) {
      addressParts.push(props.state);
    }

    if (props.country) {
      addressParts.push(props.country);
    }

    const fullAddress = addressParts.join(', ');

    const typeInfo = this.getTypeInfo(props.osm_value, props.osm_key, props, shortName);

    return {
      lat,
      lng,
      name: shortName || fullAddress,
      shortName,
      address: fullAddress,
      type: typeInfo.type,
      icon: typeInfo.icon,
      category: props.osm_key,
      distance,
      details: {
        houseNumber: props.housenumber,
        street: props.street,
        city: props.city,
        district: props.district,
        state: props.state,
        country: props.country,
        countryCode: props.countrycode?.toUpperCase(),
        postcode: props.postcode
      },
      tags: props
    };
  }

  // Déterminer le type et l'icône avec plus de précision
  getTypeInfo(type, category, data, name) {
    const typeLower = (type || '').toLowerCase();
    const catLower = (category || '').toLowerCase();
    const nameLower = (name || '').toLowerCase();
    const allTerms = `${typeLower} ${catLower} ${nameLower}`;

    // Transport
    if (allTerms.match(/\b(gare|train|railway|station|sncf|tgv|intercit|ter)\b/)) {
      return { type: 'train', icon: '🚉' };
    }
    if (allTerms.match(/\b(metro|métro|subway|underground|rer)\b/)) {
      return { type: 'metro', icon: '🚇' };
    }
    if (allTerms.match(/\b(bus|autobus|bus_stop|bus_station|arrêt)\b/)) {
      return { type: 'bus', icon: '🚌' };
    }
    if (allTerms.match(/\b(aéroport|airport|aerodrome|aeroport|cdg|orly)\b/)) {
      return { type: 'airport', icon: '✈️' };
    }
    if (allTerms.match(/\b(tram|tramway|light_rail)\b/)) {
      return { type: 'tram', icon: '🚊' };
    }
    if (allTerms.match(/\b(ferry|port|harbour|harbor|bateau)\b/)) {
      return { type: 'ferry', icon: '⛴️' };
    }
    if (allTerms.match(/\b(parking|car_park|stationnement)\b/)) {
      return { type: 'parking', icon: '🅿️' };
    }
    if (allTerms.match(/\b(fuel|gas_station|petrol|essence|station.service)\b/)) {
      return { type: 'fuel', icon: '⛽' };
    }

    // Restauration
    if (allTerms.match(/\b(restaurant|dining|brasserie|bistro)\b/)) {
      return { type: 'restaurant', icon: '🍽️' };
    }
    if (allTerms.match(/\b(fast.food|burger|mcdonalds|kfc|quick)\b/)) {
      return { type: 'fastfood', icon: '🍔' };
    }
    if (allTerms.match(/\b(cafe|café|coffee|starbucks)\b/)) {
      return { type: 'cafe', icon: '☕' };
    }
    if (allTerms.match(/\b(bar|pub|brewery|bière)\b/)) {
      return { type: 'bar', icon: '🍺' };
    }
    if (allTerms.match(/\b(pizza|pizzeria)\b/)) {
      return { type: 'pizza', icon: '🍕' };
    }
    if (allTerms.match(/\b(sushi|japonais|japanese)\b/)) {
      return { type: 'sushi', icon: '🍣' };
    }
    if (allTerms.match(/\b(boulangerie|bakery|pain|bread)\b/)) {
      return { type: 'bakery', icon: '🥖' };
    }
    if (allTerms.match(/\b(patisserie|pastry|gâteau)\b/)) {
      return { type: 'pastry', icon: '🥐' };
    }

    // Commerces
    if (allTerms.match(/\b(supermarket|supermarché|carrefour|leclerc|auchan|lidl|aldi)\b/)) {
      return { type: 'supermarket', icon: '🛒' };
    }
    if (allTerms.match(/\b(mall|centre.commercial|shopping)\b/)) {
      return { type: 'mall', icon: '🏬' };
    }
    if (allTerms.match(/\b(pharmacy|pharmacie|chemist)\b/)) {
      return { type: 'pharmacy', icon: '💊' };
    }
    if (catLower === 'shop' || typeLower === 'shop') {
      return { type: 'shop', icon: '🏪' };
    }

    // Hébergement
    if (allTerms.match(/\b(hotel|hôtel|motel|inn|novotel|ibis|mercure)\b/)) {
      return { type: 'hotel', icon: '🏨' };
    }
    if (allTerms.match(/\b(hostel|auberge|youth)\b/)) {
      return { type: 'hostel', icon: '🛏️' };
    }

    // Santé
    if (allTerms.match(/\b(hospital|hôpital|clinic|clinique|urgence)\b/)) {
      return { type: 'hospital', icon: '🏥' };
    }
    if (allTerms.match(/\b(doctor|médecin|cabinet)\b/)) {
      return { type: 'doctor', icon: '👨‍⚕️' };
    }

    // Éducation
    if (allTerms.match(/\b(university|université|faculté|campus)\b/)) {
      return { type: 'university', icon: '🎓' };
    }
    if (allTerms.match(/\b(school|école|lycée|collège)\b/)) {
      return { type: 'school', icon: '🏫' };
    }

    // Culture
    if (allTerms.match(/\b(museum|musée)\b/)) {
      return { type: 'museum', icon: '🏛️' };
    }
    if (allTerms.match(/\b(theatre|theater|théâtre)\b/)) {
      return { type: 'theatre', icon: '🎭' };
    }
    if (allTerms.match(/\b(cinema|cinéma|movie)\b/)) {
      return { type: 'cinema', icon: '🎬' };
    }

    // Nature
    if (allTerms.match(/\b(beach|plage|seaside|bord.mer)\b/)) {
      return { type: 'beach', icon: '🏖️' };
    }
    if (allTerms.match(/\b(park|parc|jardin|garden)\b/)) {
      return { type: 'park', icon: '🌳' };
    }
    if (allTerms.match(/\b(mountain|montagne|sommet|peak)\b/)) {
      return { type: 'mountain', icon: '⛰️' };
    }
    if (allTerms.match(/\b(forest|forêt|bois)\b/)) {
      return { type: 'forest', icon: '🌲' };
    }
    if (allTerms.match(/\b(lake|lac)\b/)) {
      return { type: 'lake', icon: '🏞️' };
    }

    // Lieux
    if (typeLower === 'city' || allTerms.match(/\b(ville|city|métropole)\b/)) {
      return { type: 'city', icon: '🏙️' };
    }
    if (typeLower === 'town') {
      return { type: 'town', icon: '🏘️' };
    }
    if (typeLower === 'village') {
      return { type: 'village', icon: '🏘️' };
    }
    if (allTerms.match(/\b(monument|memorial|statue|tour|tower)\b/)) {
      return { type: 'monument', icon: '🗼' };
    }
    if (allTerms.match(/\b(church|église|cathedral|cathédrale|chapelle)\b/)) {
      return { type: 'church', icon: '⛪' };
    }
    if (allTerms.match(/\b(mosque|mosquée)\b/)) {
      return { type: 'mosque', icon: '🕌' };
    }
    if (allTerms.match(/\b(castle|château|palace|palais)\b/)) {
      return { type: 'castle', icon: '🏰' };
    }

    // Services
    if (allTerms.match(/\b(bank|banque|atm|distributeur)\b/)) {
      return { type: 'bank', icon: '🏦' };
    }
    if (allTerms.match(/\b(post|poste|mail)\b/)) {
      return { type: 'post', icon: '📮' };
    }
    if (allTerms.match(/\b(police|gendarmerie|commissariat)\b/)) {
      return { type: 'police', icon: '👮' };
    }
    if (allTerms.match(/\b(mairie|town.hall|city.hall|hôtel.de.ville)\b/)) {
      return { type: 'townhall', icon: '🏛️' };
    }

    // Sports
    if (allTerms.match(/\b(stadium|stade|arena)\b/)) {
      return { type: 'stadium', icon: '🏟️' };
    }
    if (allTerms.match(/\b(gym|fitness|sport|salle)\b/)) {
      return { type: 'gym', icon: '🏋️' };
    }
    if (allTerms.match(/\b(pool|piscine|swimming)\b/)) {
      return { type: 'pool', icon: '🏊' };
    }

    // Type par défaut selon la catégorie OSM
    if (catLower === 'amenity') return { type: 'amenity', icon: '📍' };
    if (catLower === 'tourism') return { type: 'tourism', icon: '🗺️' };
    if (catLower === 'leisure') return { type: 'leisure', icon: '🎯' };
    if (catLower === 'building') return { type: 'building', icon: '🏠' };
    if (catLower === 'highway') return { type: 'road', icon: '🛣️' };
    if (catLower === 'place') return { type: 'place', icon: '📍' };

    return { type: 'place', icon: '📍' };
  }

  // Recherche intelligente de coordonnées
  parseCoordinates(query) {
    if (!query) return null;

    // Nettoyer la query
    const cleaned = query.trim().replace(/\s+/g, ' ');

    // Format décimal : 45.5017, -73.5673 ou 45.5017 -73.5673
    const decimalMatch = cleaned.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (decimalMatch) {
      const lat = parseFloat(decimalMatch[1]);
      const lng = parseFloat(decimalMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }

    // Format DMS : 48°51'24"N 2°17'42"E
    const dmsMatch = cleaned.match(/(\d+)[°]\s*(\d+)?['′]?\s*(\d+\.?\d*)?["″]?\s*([NSns])\s*(\d+)[°]\s*(\d+)?['′]?\s*(\d+\.?\d*)?["″]?\s*([EWew])/);
    if (dmsMatch) {
      let lat = parseInt(dmsMatch[1]) + (parseInt(dmsMatch[2] || 0) / 60) + (parseFloat(dmsMatch[3] || 0) / 3600);
      let lng = parseInt(dmsMatch[5]) + (parseInt(dmsMatch[6] || 0) / 60) + (parseFloat(dmsMatch[7] || 0) / 3600);

      if (dmsMatch[4].toUpperCase() === 'S') lat = -lat;
      if (dmsMatch[8].toUpperCase() === 'W') lng = -lng;

      return { lat, lng };
    }

    return null;
  }

  // Recherche par code postal
  async searchPostalCode(postalCode, countryCode = null) {
    const cleanCode = postalCode.replace(/\s+/g, ' ').trim();
    let query = cleanCode;

    // Ajouter le pays si spécifié
    if (countryCode) {
      query = `${cleanCode}, ${countryCode}`;
    }

    return this.search(query, null, { limit: 8 });
  }

  // Fetch avec retry et timeout
  async fetchWithRetry(url, options = {}, retries = this.retryCount) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (retries > 0 && error.name !== 'AbortError') {
        await this.delay(300);
        return this.fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Calculer la distance (Haversine) en mètres
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Rayon de la Terre en mètres
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  // Vider le cache
  clearCache() {
    this.cache.clear();
  }
}

// Instance globale
const searchService = new SearchService();
