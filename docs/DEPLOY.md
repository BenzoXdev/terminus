# 🚀 Guide de déploiement GitHub Pages

## Méthode simple (recommandée)

### 1. Activer GitHub Pages

1. Allez sur : **Settings** → **Pages** dans votre dépôt
2. Sous **"Source"**, sélectionnez : **"Deploy from a branch"**
3. Choisissez la branche : **`main`**
4. Dossier : **`/ (root)`**
5. Cliquez **Save**

### 2. Votre site sera disponible à :

**https://benzoxdev.github.io/terminus/**

---

## Méthode GitHub Actions (avancée)

Si vous préférez utiliser GitHub Actions :

1. Allez sur : **Settings** → **Pages**
2. Sous **"Source"**, sélectionnez : **"GitHub Actions"**
3. Le workflow `.github/workflows/deploy.yml` se déclenchera automatiquement

---

## ⚠️ Important pour PWA

Pour que le Service Worker fonctionne en production :

1. Le site doit être servi en **HTTPS** (automatique avec GitHub Pages)
2. Le `manifest.json` doit pointer vers les bonnes URLs
3. Tous les fichiers doivent être accessibles

---

## 🔧 Vérification

Après activation, attendez 1-2 minutes puis visitez :
- https://benzoxdev.github.io/terminus/

Si vous voyez l'application Terminus, c'est bon ! 🎉

