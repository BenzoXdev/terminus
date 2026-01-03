// Service d'alertes pour Terminus
class AlertService {
  constructor() {
    this.audioContext = null;
    this.currentAlarm = null;
    this.isPlaying = false;
    this.hasTriggered = false;
    this.initAudio();
    this.requestNotificationPermission();
  }

  // Initialiser le contexte audio
  initAudio() {
    // On initialise le contexte audio au premier clic utilisateur
    document.addEventListener('click', () => {
      if (!this.audioContext) {
        try {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
          console.error('Erreur initialisation audio:', error);
        }
      }
    }, { once: true });
  }

  // Demander la permission pour les notifications
  async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.log('Permission notification non demandée');
      }
    }
  }

  // Déclencher une alerte
  async triggerAlert(distance) {
    if (this.hasTriggered) return; // Éviter les déclenchements multiples
    this.hasTriggered = true;

    const settings = storageService.getSettings();
    const alertType = settings.alertType;

    const promises = [];

    if (alertType === 'all' || alertType === 'sound') {
      promises.push(this.playSound(settings.soundType));
    }

    if (alertType === 'all' || alertType === 'vibration') {
      this.vibrate();
    }

    if (alertType === 'all' || alertType === 'notification') {
      promises.push(this.showNotification(distance));
    }

    await Promise.all(promises);

    // Reset après 30 secondes pour permettre un nouveau déclenchement
    setTimeout(() => {
      this.hasTriggered = false;
    }, 30000);
  }

  // Jouer un son d'alarme
  playSound(type = 'classic') {
    return new Promise((resolve) => {
      if (!this.audioContext) {
        try {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
          console.error('Erreur création contexte audio:', error);
          resolve();
          return;
        }
      }

      // S'assurer que le contexte est actif
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      if (this.isPlaying) {
        resolve();
        return;
      }

      this.isPlaying = true;

      try {
        const now = this.audioContext.currentTime;

        switch (type) {
          case 'classic':
            this.playClassicAlarm(now);
            break;
          case 'gentle':
            this.playGentleAlarm(now);
            break;
          case 'urgent':
            this.playUrgentAlarm(now);
            break;
          case 'melody':
            this.playMelodyAlarm(now);
            break;
          default:
            this.playClassicAlarm(now);
        }

        setTimeout(() => {
          this.isPlaying = false;
          resolve();
        }, 2000);

      } catch (error) {
        console.error('Erreur lecture son:', error);
        this.isPlaying = false;
        resolve();
      }
    });
  }

  playClassicAlarm(startTime) {
    const notes = [800, 1000, 800, 1000, 800];
    notes.forEach((freq, i) => {
      this.playTone(freq, startTime + i * 0.2, 0.15);
    });
  }

  playGentleAlarm(startTime) {
    const notes = [523, 659, 784]; // C5, E5, G5
    notes.forEach((freq, i) => {
      this.playTone(freq, startTime + i * 0.4, 0.35, 'sine', 0.2);
    });
  }

  playUrgentAlarm(startTime) {
    for (let i = 0; i < 8; i++) {
      this.playTone(1200, startTime + i * 0.1, 0.05);
      this.playTone(800, startTime + i * 0.1 + 0.05, 0.05);
    }
  }

  playMelodyAlarm(startTime) {
    const melody = [
      { freq: 659, dur: 0.15 }, // E5
      { freq: 784, dur: 0.15 }, // G5
      { freq: 880, dur: 0.15 }, // A5
      { freq: 784, dur: 0.15 }, // G5
      { freq: 659, dur: 0.3 },  // E5
    ];
    let time = startTime;
    melody.forEach(note => {
      this.playTone(note.freq, time, note.dur, 'triangle', 0.25);
      time += note.dur + 0.05;
    });
  }

  playTone(frequency, startTime, duration, type = 'sine', volume = 0.3) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + duration - 0.05);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);

    this.currentAlarm = oscillator;
  }

  // Arrêter le son
  stopSound() {
    if (this.currentAlarm) {
      try {
        this.currentAlarm.stop();
        this.currentAlarm = null;
        this.isPlaying = false;
      } catch (error) {
        // L'oscillator peut déjà être arrêté
      }
    }
  }

  // Faire vibrer l'appareil
  vibrate() {
    if ('vibrate' in navigator) {
      try {
        // Pattern de vibration plus élaboré
        navigator.vibrate([
          200, 100, 200, 100, 200, 200,
          200, 100, 200, 100, 200
        ]);
        return true;
      } catch (error) {
        console.error('Erreur vibration:', error);
        return false;
      }
    }
    return false;
  }

  // Afficher une notification
  async showNotification(distance) {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      const distanceText = distance < 1000
        ? `${distance}m`
        : `${(distance / 1000).toFixed(1)}km`;

      try {
        const notification = new Notification('🚂 Terminus - Destination proche !', {
          body: `Vous êtes à ${distanceText} de votre destination.\nPréparez-vous à descendre !`,
          icon: 'assets/icons/icon-192x192.png',
          badge: 'assets/icons/icon-72x72.png',
          tag: 'terminus-arrival',
          requireInteraction: true,
          vibrate: [200, 100, 200]
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        // Fermer automatiquement après 10 secondes
        setTimeout(() => {
          notification.close();
        }, 10000);

        return true;
      } catch (error) {
        console.error('Erreur notification:', error);
        return false;
      }
    } else if (Notification.permission === 'default') {
      await this.requestNotificationPermission();
      return false;
    }

    return false;
  }

  // Réinitialiser le déclencheur
  resetTrigger() {
    this.hasTriggered = false;
  }

  // Tester une alerte spécifique
  testAlert(type) {
    switch (type) {
      case 'sound':
        this.playSound(storageService.getSettings().soundType);
        break;
      case 'vibration':
        this.vibrate();
        break;
      case 'notification':
        this.showNotification(500);
        break;
      default:
        this.triggerAlert(500);
    }
  }
}

// Instance globale
const alertService = new AlertService();
