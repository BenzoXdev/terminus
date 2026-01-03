// Système d'alertes amélioré pour Terminus
class AlertService {
  constructor() {
    this.audioContext = null;
    this.isPlaying = false;
    this.repeatCount = 0;
    this.maxRepeats = 3; // Par défaut 3 répétitions, 0 = infini
    this.repeatInterval = null;
    this.currentOscillator = null;
    this.volume = 1.0;
    this.isMuted = false;
    this.alertActive = false;
    
    // Sons prédéfinis
    this.sounds = {
      alarm: { frequencies: [880, 1100, 880, 1100], duration: 300, type: 'square' },
      bell: { frequencies: [1047, 1319, 1568], duration: 200, type: 'sine' },
      chime: { frequencies: [523, 659, 784, 1047], duration: 150, type: 'triangle' },
      urgent: { frequencies: [1000, 500, 1000, 500, 1000], duration: 150, type: 'sawtooth' },
      gentle: { frequencies: [440, 554, 659], duration: 400, type: 'sine' },
      train: { frequencies: [600, 800, 600, 800, 600, 800], duration: 250, type: 'square' }
    };
    
    this.selectedSound = 'alarm';
    this.vibrationPattern = [200, 100, 200, 100, 400];
    
    // Vérifier les permissions au démarrage
    this.checkPermissions();
  }

  // ===== INITIALISATION =====
  initAudioContext() {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.error('AudioContext non supporté:', e);
      }
    }
    
    // Reprendre si suspendu (requis sur iOS)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    return this.audioContext;
  }

  // ===== VÉRIFICATION DES PERMISSIONS =====
  async checkPermissions() {
    const permissions = {
      notification: false,
      vibration: false,
      audio: false,
      wakeLock: false
    };

    // Notifications
    if ('Notification' in window) {
      permissions.notification = Notification.permission === 'granted';
    }

    // Vibration
    permissions.vibration = 'vibrate' in navigator;

    // Audio
    permissions.audio = !!(window.AudioContext || window.webkitAudioContext);

    // Wake Lock (garder l'écran allumé)
    permissions.wakeLock = 'wakeLock' in navigator;

    return permissions;
  }

  // ===== DEMANDER LA PERMISSION NOTIFICATION =====
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      return { success: false, message: 'Les notifications ne sont pas supportées sur ce navigateur.' };
    }

    if (Notification.permission === 'granted') {
      return { success: true, message: 'Notifications déjà autorisées !' };
    }

    if (Notification.permission === 'denied') {
      return { 
        success: false, 
        message: 'Les notifications sont bloquées. Allez dans les paramètres de votre navigateur pour les autoriser.',
        blocked: true
      };
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        return { success: true, message: 'Notifications autorisées !' };
      } else {
        return { success: false, message: 'Permission de notification refusée.' };
      }
    } catch (e) {
      return { success: false, message: 'Erreur lors de la demande de permission.' };
    }
  }

  // ===== SONS =====
  
  // Jouer un son avec répétition
  async playSound(soundName = null, options = {}) {
    const sound = this.sounds[soundName || this.selectedSound] || this.sounds.alarm;
    const repeats = options.repeats !== undefined ? options.repeats : this.maxRepeats;
    
    this.stopSound(); // Arrêter tout son en cours
    this.alertActive = true;
    this.repeatCount = 0;

    const playOnce = async () => {
      if (!this.alertActive) return;
      
      const ctx = this.initAudioContext();
      if (!ctx) return;

      const gainNode = ctx.createGain();
      gainNode.gain.value = this.isMuted ? 0 : this.volume;
      gainNode.connect(ctx.destination);

      for (let i = 0; i < sound.frequencies.length; i++) {
        if (!this.alertActive) break;
        
        const oscillator = ctx.createOscillator();
        oscillator.type = sound.type;
        oscillator.frequency.value = sound.frequencies[i];
        oscillator.connect(gainNode);
        
        this.currentOscillator = oscillator;
        oscillator.start();
        
        await this.delay(sound.duration);
        oscillator.stop();
        
        await this.delay(50); // Pause entre les notes
      }
    };

    const repeatLoop = async () => {
      if (!this.alertActive) return;
      
      await playOnce();
      this.repeatCount++;

      // 0 = répéter indéfiniment
      if (repeats === 0 || this.repeatCount < repeats) {
        this.repeatInterval = setTimeout(repeatLoop, 1000);
      } else {
        this.alertActive = false;
      }
    };

    await repeatLoop();
  }

  // Arrêter le son
  stopSound() {
    this.alertActive = false;
    
    if (this.repeatInterval) {
      clearTimeout(this.repeatInterval);
      this.repeatInterval = null;
    }
    
    if (this.currentOscillator) {
      try {
        this.currentOscillator.stop();
      } catch (e) {}
      this.currentOscillator = null;
    }
    
    this.isPlaying = false;
  }

  // Définir le nombre de répétitions
  setRepeatCount(count) {
    this.maxRepeats = count; // 0 = infini
  }

  // Définir le volume (0-1)
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  // Sélectionner un son
  selectSound(soundName) {
    if (this.sounds[soundName]) {
      this.selectedSound = soundName;
    }
  }

  // Liste des sons disponibles
  getAvailableSounds() {
    return Object.keys(this.sounds).map(key => ({
      id: key,
      name: this.getSoundDisplayName(key)
    }));
  }

  getSoundDisplayName(key) {
    const names = {
      alarm: '🔔 Alarme classique',
      bell: '🔔 Cloche',
      chime: '🎵 Carillon',
      urgent: '🚨 Urgent',
      gentle: '🎶 Doux',
      train: '🚂 Train'
    };
    return names[key] || key;
  }

  // Tester un son (une seule fois)
  async testSound(soundName = null) {
    const sound = this.sounds[soundName || this.selectedSound] || this.sounds.alarm;
    
    const ctx = this.initAudioContext();
    if (!ctx) return;

    const gainNode = ctx.createGain();
    gainNode.gain.value = this.isMuted ? 0.1 : this.volume; // Jouer quand même en test
    gainNode.connect(ctx.destination);

    for (const freq of sound.frequencies) {
      const oscillator = ctx.createOscillator();
      oscillator.type = sound.type;
      oscillator.frequency.value = freq;
      oscillator.connect(gainNode);
      oscillator.start();
      await this.delay(sound.duration);
      oscillator.stop();
      await this.delay(30);
    }
  }

  // ===== VIBRATION =====
  
  vibrate(pattern = null) {
    if (!('vibrate' in navigator)) {
      console.log('Vibration non supportée');
      return false;
    }

    try {
      navigator.vibrate(pattern || this.vibrationPattern);
      return true;
    } catch (e) {
      console.error('Erreur vibration:', e);
      return false;
    }
  }

  // Vibration continue jusqu'à arrêt
  startContinuousVibration() {
    this.alertActive = true;
    
    const vibrateLoop = () => {
      if (!this.alertActive) return;
      this.vibrate();
      this.repeatInterval = setTimeout(vibrateLoop, 1500);
    };
    
    vibrateLoop();
  }

  stopVibration() {
    this.alertActive = false;
    if (this.repeatInterval) {
      clearTimeout(this.repeatInterval);
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  }

  testVibration() {
    return this.vibrate([100, 50, 100, 50, 200]);
  }

  // Définir le pattern de vibration
  setVibrationPattern(pattern) {
    this.vibrationPattern = pattern;
  }

  // ===== NOTIFICATIONS =====
  
  async sendNotification(title, options = {}) {
    if (!('Notification' in window)) {
      return { success: false, message: 'Notifications non supportées' };
    }

    if (Notification.permission !== 'granted') {
      const result = await this.requestNotificationPermission();
      if (!result.success) return result;
    }

    try {
      const notification = new Notification(title, {
        body: options.body || 'Vous êtes arrivé à destination !',
        icon: options.icon || './assets/icons/logo.svg',
        badge: './assets/icons/logo.svg',
        tag: options.tag || 'terminus-alert',
        requireInteraction: options.requireInteraction !== false, // Reste visible
        vibrate: this.vibrationPattern,
        silent: false,
        actions: options.actions || [
          { action: 'stop', title: '✓ Arrêter' },
          { action: 'snooze', title: '⏰ Rappel 5min' }
        ]
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.onClick) options.onClick();
      };

      return { success: true, notification };
    } catch (e) {
      console.error('Erreur notification:', e);
      return { success: false, message: e.message };
    }
  }

  testNotification() {
    return this.sendNotification('🎯 Test Terminus', {
      body: 'Les notifications fonctionnent correctement !',
      requireInteraction: false
    });
  }

  // ===== ALERTE COMPLÈTE =====
  
  async triggerFullAlert(options = {}) {
    const results = {
      sound: false,
      vibration: false,
      notification: false
    };

    // Son
    if (options.sound !== false) {
      this.playSound(null, { repeats: options.repeats || this.maxRepeats });
      results.sound = true;
    }

    // Vibration
    if (options.vibration !== false) {
      this.startContinuousVibration();
      results.vibration = true;
    }

    // Notification
    if (options.notification !== false) {
      const notifResult = await this.sendNotification(
        options.title || '🎯 Terminus - Arrivée !',
        {
          body: options.body || 'Vous approchez de votre destination !',
          requireInteraction: true,
          onClick: () => this.stopAll()
        }
      );
      results.notification = notifResult.success;
    }

    // Wake Lock - garder l'écran allumé
    if ('wakeLock' in navigator) {
      try {
        await navigator.wakeLock.request('screen');
      } catch (e) {
        console.log('Wake Lock non disponible');
      }
    }

    return results;
  }

  stopAll() {
    this.stopSound();
    this.stopVibration();
    this.alertActive = false;
  }

  // ===== ÉTAT DU VOLUME =====
  
  async getDeviceAudioStatus() {
    const status = {
      muted: false,
      volume: 1,
      vibrationMode: false,
      silentMode: false,
      canDetect: false,
      message: ''
    };

    // Essayer de détecter via l'AudioContext
    try {
      const ctx = this.initAudioContext();
      if (ctx) {
        // Créer un oscillateur de test silencieux
        const analyser = ctx.createAnalyser();
        const oscillator = ctx.createOscillator();
        oscillator.connect(analyser);
        
        // Vérifier si le contexte audio est en état suspendu (souvent = silencieux sur mobile)
        if (ctx.state === 'suspended') {
          status.silentMode = true;
          status.message = '🔇 Audio suspendu - Touchez l\'écran pour activer';
        } else if (ctx.state === 'running') {
          status.canDetect = true;
          status.message = '🔊 Audio actif';
        }
      }
    } catch (e) {
      status.message = 'Impossible de détecter l\'état audio';
    }

    // Vérifier le support de la vibration
    status.vibrationMode = 'vibrate' in navigator;

    return status;
  }

  // Forcer l'activation de l'audio (nécessite une interaction utilisateur)
  async forceEnableAudio() {
    try {
      const ctx = this.initAudioContext();
      
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
        
        // Jouer un son silencieux pour "débloquer" l'audio sur iOS
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0.001; // Presque silencieux
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.1);
        
        return { success: true, message: '🔊 Audio activé !' };
      }
      
      return { success: true, message: 'Audio déjà actif' };
    } catch (e) {
      return { success: false, message: 'Impossible d\'activer l\'audio' };
    }
  }

  // ===== ARRIÈRE-PLAN =====
  
  // Demander l'autorisation de fonctionner en arrière-plan
  async requestBackgroundPermission() {
    const capabilities = {
      serviceWorker: 'serviceWorker' in navigator,
      backgroundSync: 'sync' in (window.ServiceWorkerRegistration?.prototype || {}),
      periodicSync: 'periodicSync' in (window.ServiceWorkerRegistration?.prototype || {}),
      wakeLock: 'wakeLock' in navigator,
      notifications: 'Notification' in window
    };

    let message = '📱 Fonctionnement en arrière-plan:\n\n';

    if (capabilities.serviceWorker) {
      message += '✅ Service Worker actif\n';
    }

    if (capabilities.notifications && Notification.permission === 'granted') {
      message += '✅ Notifications activées\n';
    } else {
      message += '⚠️ Activez les notifications pour les alertes en arrière-plan\n';
    }

    if (capabilities.wakeLock) {
      message += '✅ Wake Lock supporté (écran allumé)\n';
    }

    message += '\n💡 Conseils pour iOS/Android:\n';
    message += '• Ne fermez pas l\'application\n';
    message += '• Gardez l\'écran allumé ou utilisez le suivi\n';
    message += '• Activez les notifications\n';
    message += '• Désactivez l\'économie de batterie pour cette app';

    return {
      capabilities,
      message,
      supported: capabilities.serviceWorker && capabilities.notifications
    };
  }

  // ===== UTILITAIRES =====
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Instance globale
const alertService = new AlertService();
