# 🎯 Terminus

**Réveillez-vous à destination** — Application web intelligente de réveil GPS pour ne plus jamais rater votre arrêt.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-brightgreen.svg)](https://web.dev/progressive-web-apps/)
[![Version](https://img.shields.io/badge/version-3.0.0-cyan.svg)](https://github.com/benzoXdev/terminus)

---

## ✨ Fonctionnalités

### 🗺️ Carte Interactive
- Carte OpenStreetMap avec mode sombre/clair
- Sélection de destination par clic ou recherche
- Zone d'alerte personnalisable (100m à 10km)
- Affichage du trajet en temps réel
- Légende et contrôles de carte intuitifs

### 🔍 Recherche Robuste Multi-Source
- **Nominatim** (OpenStreetMap) - source principale
- **Photon** (Komoot) - fallback automatique
- Autocomplétion intelligente avec icônes
- Recherche par adresse, coordonnées GPS ou code postal
- Cache intelligent des résultats
- Support des formats de coordonnées (décimal, DMS)

### 📍 Informations Utilisateur Enrichies
- Position GPS précise ou approximation IP
- Affichage ville, région, pays avec drapeau
- Météo en temps réel (Open-Meteo API)
- Fuseau horaire et heure locale
- Précision GPS et informations appareil

### 🚌 Transports à Proximité
- Détection automatique des arrêts (Overpass API)
- Gares, métros, bus, tramways, aéroports
- Affichage des lignes et opérateurs
- Distance et temps estimé

### 🔔 Système d'Alertes Complet
- **Son** — Alarme personnalisable (3 types)
- **Vibration** — Support mobile/tablette
- **Notification Push** — Même en arrière-plan

### 📊 Suivi en Temps Réel
- Distance restante
- Vitesse actuelle
- Direction (boussole)
- Estimation du temps d'arrivée (ETA)
- Altitude et précision GPS
- Barre de progression

### 💾 Stockage Local
- Sauvegarde automatique des favoris
- Préférences utilisateur persistantes
- Dernière destination mémorisée
- Fonctionne hors ligne (PWA)

### 🌓 Mode Sombre/Clair
- Thème sombre par défaut
- Thème clair disponible
- Détection automatique du système
- Transition fluide

### 📱 Multi-Plateforme
- ✅ PC (Windows, Mac, Linux)
- ✅ Mobile (Android, iOS)
- ✅ Tablette
- ✅ PWA installable

---

## 🚀 Installation

### Option 1 : Utilisation en ligne
Visitez [terminus.app](https://benzoXdev.github.io/terminus) (à venir)

### Option 2 : Installation locale

```bash
# Cloner le repository
git clone https://github.com/benzoXdev/terminus.git
cd terminus

# Serveur local (choisir une option)
npx http-server -p 8080
# ou
python -m http.server 8080

# Ouvrir dans le navigateur
# http://localhost:8080
```

### Option 3 : Installer comme PWA
1. Ouvrez l'application dans Chrome/Edge/Safari
2. Cliquez sur "Installer" dans la barre d'adresse
3. L'application sera disponible comme une app native

---

## 🛠️ Technologies

| Technologie | Utilisation |
|-------------|-------------|
| **HTML5** | Structure sémantique |
| **CSS3** | Design moderne, animations, thèmes |
| **JavaScript ES6+** | Logique applicative |
| **Leaflet.js** | Carte interactive |
| **OpenStreetMap** | Données cartographiques |
| **Nominatim + Photon** | Géocodage multi-source |
| **Overpass API** | Transports publics |
| **Open-Meteo** | Météo temps réel |
| **Service Worker** | Mode offline, PWA |
| **Web APIs** | Geolocation, Vibration, Notifications |

---

## 📁 Structure du Projet

```
terminus/
├── index.html              # Page principale
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── css/
│   ├── style.css          # Styles principaux
│   └── animations.css     # Animations CSS
├── js/
│   ├── config.js          # Configuration globale
│   ├── app.js             # Application principale
│   ├── map.js             # Service carte Leaflet
│   ├── search.js          # Recherche multi-source
│   ├── geolocation.js     # Service GPS
│   ├── transport.js       # Transports publics
│   ├── user-info.js       # Infos utilisateur
│   ├── alerts.js          # Système d'alertes
│   └── storage.js         # LocalStorage
├── assets/
│   ├── icons/             # Icônes PWA + logo
│   └── sounds/            # Sons d'alarme
└── README.md
```

---

## 🔧 Configuration

Modifiez `js/config.js` pour personnaliser :

```javascript
const CONFIG = {
  defaults: {
    alertDistance: 1000,    // Distance d'alerte en mètres
    theme: 'dark',          // 'dark', 'light', 'auto'
    units: 'metric',        // 'metric' ou 'imperial'
  },
  limits: {
    zoneRadiusMin: 100,     // Zone minimum
    zoneRadiusMax: 10000,   // Zone maximum
  },
  // ...
};
```

---

## 🌐 APIs Utilisées

| API | Fonction | Limite |
|-----|----------|--------|
| Nominatim | Géocodage principal | 1 req/s |
| Photon | Géocodage fallback | Illimité |
| Overpass | Transports OSM | 10k req/jour |
| Open-Meteo | Météo | 10k req/jour |
| ipapi.co | Géolocalisation IP | 1k req/jour |

---

## 📋 Navigateurs Supportés

| Navigateur | Version |
|------------|---------|
| Chrome | 80+ |
| Firefox | 75+ |
| Safari | 14+ |
| Edge | 80+ |
| Opera | 67+ |

---

## 🤝 Contribution

Les contributions sont les bienvenues !

1. Fork le projet
2. Créez une branche (`git checkout -b feature/amazing`)
3. Committez (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing`)
5. Ouvrez une Pull Request

---

## 🌐 Déploiement GitHub Pages

### Activation simple (2 minutes)

1. **Allez sur les paramètres du dépôt** :
   - [https://github.com/BenzoXdev/terminus/settings/pages](https://github.com/BenzoXdev/terminus/settings/pages)

2. **Configurez la source** :
   - **Source** : Sélectionnez **"Deploy from a branch"**
   - **Branch** : Choisissez **`main`**
   - **Folder** : `/ (root)`
   - Cliquez **Save**

3. **Attendez 1-2 minutes** puis visitez :
   - **https://benzoxdev.github.io/terminus/**

✅ Votre application PWA sera en ligne et fonctionnelle !

> 📖 Guide détaillé : [docs/DEPLOY.md](docs/DEPLOY.md)

---

## 📄 Licence

Ce projet est sous licence [MIT](LICENSE).

---

## 👨‍💻 Auteur

**Amar Benkherouf**

- GitHub: [@benzoXdev](https://github.com/benzoXdev)
- Projet: [Terminus](https://github.com/benzoXdev/terminus)

---

## 🙏 Remerciements

Inspiré par les meilleures applications de transport :
- Google Maps
- Citymapper
- Transit
- Moovit
- HERE WeGo

---

<div align="center">
  <br>
  <strong>⦿ Terminus</strong>
  <br>
  <em>Ne ratez plus jamais votre arrêt</em>
  <br><br>
  Made with ❤️ by Amar Benkherouf
</div>
