// Service d'intégration calendrier pour Terminus
class CalendarService {
  constructor() {
    this.events = [];
  }

  // Parser un fichier ICS (iCalendar)
  parseICS(icsContent) {
    const events = [];
    const lines = icsContent.split(/\r?\n/);
    
    let currentEvent = null;
    let inEvent = false;
    let currentProperty = '';

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // Gérer les lignes continuées (commencent par un espace)
      if (line.startsWith(' ') && currentProperty) {
        line = currentProperty + line.substring(1);
      } else {
        currentProperty = '';
      }

      // Détecter le début d'un événement
      if (line === 'BEGIN:VEVENT') {
        inEvent = true;
        currentEvent = {
          id: null,
          summary: '',
          description: '',
          location: '',
          start: null,
          end: null,
          allDay: false,
          address: null
        };
        continue;
      }

      // Détecter la fin d'un événement
      if (line === 'END:VEVENT') {
        if (currentEvent && currentEvent.start) {
          // Extraire l'adresse de la localisation si possible
          if (currentEvent.location) {
            currentEvent.address = this.extractAddress(currentEvent.location);
          }
          events.push(currentEvent);
        }
        inEvent = false;
        currentEvent = null;
        continue;
      }

      if (!inEvent || !currentEvent) continue;

      // Parser les propriétés
      if (line.startsWith('SUMMARY:')) {
        currentEvent.summary = this.unescapeICS(line.substring(8));
      } else if (line.startsWith('DESCRIPTION:')) {
        currentEvent.description = this.unescapeICS(line.substring(12));
      } else if (line.startsWith('LOCATION:')) {
        currentEvent.location = this.unescapeICS(line.substring(9));
      } else if (line.startsWith('DTSTART')) {
        const dateStr = this.extractDateValue(line);
        currentEvent.start = this.parseICSDate(dateStr);
        currentEvent.allDay = !dateStr.includes('T');
      } else if (line.startsWith('DTEND') || line.startsWith('DTSTART')) {
        const dateStr = this.extractDateValue(line);
        currentEvent.end = this.parseICSDate(dateStr);
      } else if (line.startsWith('UID:')) {
        currentEvent.id = line.substring(4);
      }
    }

    return events;
  }

  // Extraire la valeur d'une date ICS
  extractDateValue(line) {
    const match = line.match(/[:;]([0-9TZ]+)/);
    return match ? match[1] : '';
  }

  // Parser une date ICS
  parseICSDate(dateStr) {
    // Format: YYYYMMDDTHHMMSS ou YYYYMMDD
    if (dateStr.length === 8) {
      // Date seule (all day)
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return new Date(`${year}-${month}-${day}`);
    } else if (dateStr.length >= 15) {
      // Date avec heure
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const hour = dateStr.substring(9, 11);
      const minute = dateStr.substring(11, 13);
      const second = dateStr.substring(13, 15);
      return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    }
    return null;
  }

  // Déséchapper les caractères ICS
  unescapeICS(text) {
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }

  // Extraire une adresse depuis une localisation
  extractAddress(location) {
    // Essayer de détecter une adresse dans la localisation
    // Format commun: "Nom du lieu, Adresse, Ville"
    const parts = location.split(',').map(p => p.trim());
    
    if (parts.length >= 2) {
      // Probablement une adresse
      return {
        name: parts[0],
        address: parts.slice(1).join(', '),
        fullAddress: location
      };
    }

    return {
      name: location,
      address: location,
      fullAddress: location
    };
  }

  // Importer un fichier ICS
  async importICS(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const events = this.parseICS(e.target.result);
          this.events = events;
          resolve(events);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
      reader.readAsText(file);
    });
  }

  // Obtenir les événements à venir
  getUpcomingEvents(limit = 10) {
    const now = new Date();
    return this.events
      .filter(event => event.start && event.start >= now)
      .sort((a, b) => a.start - b.start)
      .slice(0, limit);
  }

  // Obtenir les événements d'aujourd'hui
  getTodayEvents() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.events.filter(event => {
      if (!event.start) return false;
      const eventDate = new Date(event.start);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate >= today && eventDate < tomorrow;
    }).sort((a, b) => a.start - b.start);
  }

  // Obtenir les événements de cette semaine
  getThisWeekEvents() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return this.events.filter(event => {
      if (!event.start) return false;
      return event.start >= today && event.start < nextWeek;
    }).sort((a, b) => a.start - b.start);
  }

  // Formater la date d'un événement
  formatEventDate(event) {
    if (!event.start) return '';

    const date = new Date(event.start);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (eventDay.getTime() === today.getTime()) {
      return `Aujourd'hui ${event.allDay ? '' : date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (eventDay.getTime() === today.getTime() + 86400000) {
      return `Demain ${event.allDay ? '' : date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: event.allDay ? undefined : '2-digit',
        minute: event.allDay ? undefined : '2-digit'
      });
    }
  }

  // Rechercher une adresse dans un événement
  async searchAddressInEvent(event) {
    if (!event.address || !event.address.address) return null;

    try {
      // Utiliser le service de recherche pour géocoder l'adresse
      if (window.searchService) {
        const results = await searchService.search(event.address.address);
        if (results && results.length > 0) {
          return results[0];
        }
      }
    } catch (e) {
      console.log('Erreur géocodage événement:', e);
    }

    return null;
  }

  // Vider les événements
  clearEvents() {
    this.events = [];
  }
}

// Instance globale
const calendarService = new CalendarService();

