// Service d'informations utilisateur enrichies pour Terminus
class UserInfoService {
  constructor() {
    this.userInfo = null;
    this.locationDetails = null;
    this.weather = null;
    this.lastUpdate = null;
    this.watchId = null;
  }

  // Obtenir toutes les informations utilisateur
  async getUserInfo(forceRefresh = false) {
    if (!forceRefresh && this.userInfo && Date.now() - this.lastUpdate < 60000) {
      return this.userInfo;
    }

    try {
      // Essayer GPS d'abord (plus précis)
      let position = null;
      try {
        position = await this.getGPSPosition();
      } catch (e) {
        console.log('GPS indisponible:', e.message);
      }

      // Fallback sur IP si GPS échoue
      const ipInfo = await this.getIPInfo();

      // Déterminer la meilleure position
      let lat, lng, accuracy, source;
      if (position) {
        lat = position.coords.latitude;
        lng = position.coords.longitude;
        accuracy = position.coords.accuracy;
        source = 'gps';
      } else if (ipInfo.latitude && ipInfo.longitude) {
        lat = ipInfo.latitude;
        lng = ipInfo.longitude;
        accuracy = null;
        source = 'ip';
      } else {
        // Position par défaut
        lat = 45.5017;
        lng = -73.5673;
        source = 'default';
      }

      // Obtenir les détails de localisation via reverse geocoding
      let locationDetails = null;
      try {
        locationDetails = await this.reverseGeocode(lat, lng);
      } catch (e) {
        console.log('Reverse geocoding échoué');
      }

      // Combiner les informations
      this.userInfo = {
        position: {
          lat,
          lng,
          accuracy,
          altitude: position?.coords?.altitude || null,
          heading: position?.coords?.heading || null,
          speed: position?.coords?.speed || null,
          source
        },

        location: {
          // Priorité au reverse geocoding, puis IP
          displayName: locationDetails?.displayName || `${ipInfo.city || ''}, ${ipInfo.country_name || ''}`,
          street: locationDetails?.address?.road || null,
          houseNumber: locationDetails?.address?.houseNumber || null,
          neighbourhood: locationDetails?.address?.neighbourhood || locationDetails?.address?.suburb || null,
          city: locationDetails?.address?.city || ipInfo.city || null,
          district: locationDetails?.address?.district || null,
          postcode: locationDetails?.address?.postcode || ipInfo.postal || null,
          region: locationDetails?.address?.state || ipInfo.region || null,
          regionCode: ipInfo.region_code || null,
          country: locationDetails?.address?.country || ipInfo.country_name || null,
          countryCode: (locationDetails?.address?.countryCode || ipInfo.country_code || '').toUpperCase(),
          continent: ipInfo.continent_code || null,
          timezone: ipInfo.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          currency: ipInfo.currency || this.getCurrencyForCountry(ipInfo.country_code),
          languages: ipInfo.languages || navigator.language
        },

        network: {
          ip: ipInfo.ip || null,
          isp: ipInfo.org || null,
          connectionType: navigator.connection?.effectiveType || null,
          online: navigator.onLine
        },

        device: this.getDeviceInfo(),
        timestamp: Date.now()
      };

      this.lastUpdate = Date.now();
      return this.userInfo;

    } catch (error) {
      console.error('Erreur getUserInfo:', error);
      return this.getDefaultUserInfo();
    }
  }

  // Reverse geocoding précis
  async reverseGeocode(lat, lng) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&extratags=1&namedetails=1&zoom=18`,
        {
          headers: {
            'User-Agent': 'Terminus App v3.0',
            'Accept-Language': 'fr,en'
          }
        }
      );

      if (!response.ok) return null;

      const data = await response.json();
      const address = data.address || {};

      return {
        displayName: data.display_name,
        name: data.name || data.namedetails?.name,
        address: {
          houseNumber: address.house_number,
          road: address.road || address.pedestrian || address.street,
          neighbourhood: address.neighbourhood || address.suburb || address.quarter,
          city: address.city || address.town || address.village || address.municipality || address.hamlet,
          district: address.city_district || address.district || address.borough,
          county: address.county,
          state: address.state || address.province || address.region,
          postcode: address.postcode,
          country: address.country,
          countryCode: address.country_code?.toUpperCase()
        },
        type: data.type,
        category: data.category
      };
    } catch (error) {
      console.error('Erreur reverse geocoding:', error);
      return null;
    }
  }

  // Obtenir les infos IP avec plusieurs fallbacks
  async getIPInfo() {
    // Essayer ipapi.co d'abord
    try {
      const response = await fetch('https://ipapi.co/json/', {
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.log('ipapi.co échoué, essai fallback');
    }

    // Fallback ip-api.com
    try {
      const response = await fetch('https://ip-api.com/json/?fields=status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query', {
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          return {
            ip: data.query,
            city: data.city,
            region: data.regionName,
            region_code: data.region,
            country_name: data.country,
            country_code: data.countryCode,
            latitude: data.lat,
            longitude: data.lon,
            timezone: data.timezone,
            postal: data.zip,
            org: data.isp || data.org
          };
        }
      }
    } catch (e) {
      console.log('ip-api.com échoué');
    }

    // Fallback ipinfo.io
    try {
      const response = await fetch('https://ipinfo.io/json', {
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const data = await response.json();
        const [lat, lng] = (data.loc || '0,0').split(',').map(Number);
        return {
          ip: data.ip,
          city: data.city,
          region: data.region,
          country_name: data.country,
          country_code: data.country,
          latitude: lat,
          longitude: lng,
          timezone: data.timezone,
          postal: data.postal,
          org: data.org
        };
      }
    } catch (e) {
      console.log('ipinfo.io échoué');
    }

    return {};
  }

  // Obtenir la position GPS avec haute précision
  getGPSPosition(highAccuracy = true) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Géolocalisation non supportée'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position => resolve(position),
        error => {
          const messages = {
            1: 'Permission refusée',
            2: 'Position indisponible',
            3: 'Délai dépassé'
          };
          reject(new Error(messages[error.code] || 'Erreur GPS'));
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: 15000,
          maximumAge: 0
        }
      );
    });
  }

  // Surveiller la position en continu
  startWatching(callback) {
    if (!navigator.geolocation) return null;

    this.watchId = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude, accuracy, altitude, heading, speed } = position.coords;

        if (this.userInfo) {
          this.userInfo.position = {
            ...this.userInfo.position,
            lat: latitude,
            lng: longitude,
            accuracy,
            altitude,
            heading,
            speed,
            source: 'gps'
          };
        }

        if (callback) callback(position);
      },
      error => console.log('Watch error:', error),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      }
    );

    return this.watchId;
  }

  stopWatching() {
    if (this.watchId && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  // Météo en temps réel
  async getWeather(lat, lng) {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,is_day&timezone=auto`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (!response.ok) return null;

      const data = await response.json();
      const current = data.current;

      return {
        temperature: current.temperature_2m,
        feelsLike: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        windDirection: current.wind_direction_10m,
        weatherCode: current.weather_code,
        weatherDescription: this.getWeatherDescription(current.weather_code),
        weatherIcon: this.getWeatherIcon(current.weather_code, current.is_day),
        isDay: current.is_day === 1,
        timezone: data.timezone,
        elevation: data.elevation
      };
    } catch (error) {
      console.error('Erreur météo:', error);
      return null;
    }
  }

  getWeatherDescription(code) {
    const descriptions = {
      0: 'Ciel dégagé', 1: 'Principalement dégagé', 2: 'Partiellement nuageux', 3: 'Couvert',
      45: 'Brouillard', 48: 'Brouillard givrant',
      51: 'Bruine légère', 53: 'Bruine', 55: 'Bruine dense',
      56: 'Bruine verglaçante', 57: 'Bruine verglaçante dense',
      61: 'Pluie légère', 63: 'Pluie', 65: 'Pluie forte',
      66: 'Pluie verglaçante', 67: 'Pluie verglaçante forte',
      71: 'Neige légère', 73: 'Neige', 75: 'Neige forte',
      77: 'Grains de neige',
      80: 'Averses légères', 81: 'Averses', 82: 'Averses violentes',
      85: 'Averses de neige', 86: 'Averses de neige fortes',
      95: 'Orage', 96: 'Orage avec grêle', 99: 'Orage violent'
    };
    return descriptions[code] || 'Conditions variables';
  }

  getWeatherIcon(code, isDay) {
    const icons = {
      0: isDay ? '☀️' : '🌙',
      1: isDay ? '🌤️' : '🌙',
      2: isDay ? '⛅' : '☁️',
      3: '☁️',
      45: '🌫️', 48: '🌫️',
      51: '🌧️', 53: '🌧️', 55: '🌧️', 56: '🌧️', 57: '🌧️',
      61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️',
      71: '❄️', 73: '❄️', 75: '❄️', 77: '🌨️',
      80: '🌦️', 81: '🌧️', 82: '⛈️',
      85: '🌨️', 86: '🌨️',
      95: '⛈️', 96: '⛈️', 99: '⛈️'
    };
    return icons[code] || '🌡️';
  }

  // Infos appareil
  getDeviceInfo() {
    const ua = navigator.userAgent;

    let deviceType = 'desktop';
    if (/Mobile|Android|iPhone|iPod|Windows Phone|BlackBerry/i.test(ua)) {
      deviceType = 'mobile';
    } else if (/iPad|Tablet|PlayBook/i.test(ua)) {
      deviceType = 'tablet';
    }

    let os = 'Unknown';
    if (/Windows NT 10/i.test(ua)) os = 'Windows 10/11';
    else if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Mac OS X/i.test(ua)) os = 'macOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iOS|iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let browser = 'Unknown';
    if (/Chrome/i.test(ua) && !/Edge|Edg|OPR/i.test(ua)) browser = 'Chrome';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Edge|Edg/i.test(ua)) browser = 'Edge';
    else if (/OPR|Opera/i.test(ua)) browser = 'Opera';

    return {
      type: deviceType,
      typeEmoji: { desktop: '💻', mobile: '📱', tablet: '📱' }[deviceType],
      os,
      browser,
      language: navigator.language,
      languages: navigator.languages?.slice(0, 3).join(', ') || navigator.language,
      online: navigator.onLine,
      cookiesEnabled: navigator.cookieEnabled,
      screen: {
        width: screen.width,
        height: screen.height,
        pixelRatio: window.devicePixelRatio || 1
      },
      connection: navigator.connection ? {
        type: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : null
    };
  }

  getDefaultUserInfo() {
    return {
      position: { lat: 45.5017, lng: -73.5673, source: 'default' },
      location: { city: 'Montréal', region: 'Québec', country: 'Canada', countryCode: 'CA' },
      device: this.getDeviceInfo(),
      timestamp: Date.now()
    };
  }

  getCurrencyForCountry(code) {
    const currencies = {
      FR: 'EUR', BE: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR',
      CH: 'CHF', UK: 'GBP', GB: 'GBP', US: 'USD', CA: 'CAD', JP: 'JPY'
    };
    return currencies[code?.toUpperCase()] || 'EUR';
  }

  formatPosition(lat, lng, format = 'decimal') {
    if (format === 'dms') {
      return `${this.toDMS(lat, 'lat')} ${this.toDMS(lng, 'lng')}`;
    }
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  toDMS(coord, type) {
    const abs = Math.abs(coord);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60).toFixed(1);
    let dir = type === 'lat' ? (coord >= 0 ? 'N' : 'S') : (coord >= 0 ? 'E' : 'W');
    return `${deg}°${min}'${sec}"${dir}`;
  }

  // Drapeau emoji depuis code pays
  getCountryFlag(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '🌍';
    const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }

  // Formater l'affichage de la position
  formatLocationDisplay() {
    if (!this.userInfo) return 'Position inconnue';

    const loc = this.userInfo.location;
    const parts = [];

    if (loc.neighbourhood) parts.push(loc.neighbourhood);
    if (loc.city) parts.push(loc.city);
    if (loc.region && loc.region !== loc.city) parts.push(loc.region);

    return parts.length > 0 ? parts.join(', ') : loc.displayName || 'Position détectée';
  }
}

// Instance globale
const userInfoService = new UserInfoService();

