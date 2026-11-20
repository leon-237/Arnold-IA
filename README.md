# ARNOLD · Football Intelligence AI

Application React (Vite) d'analyse de matchs de football : prédictions de score,
statistiques, confrontations directes, blessés/suspendus et modes FC (FC24 4v4,
FC25 3v3, FC26 5v5). Les analyses sont générées par Claude via une route serveur.

## Stack

- React 18 + Vite 7
- Route serverless `api/arnold.js` (proxy vers l'API Anthropic, clé gardée côté serveur)
- ESLint 9 (config plate) et Prettier 3

## Installation

```bash
npm install
```

## Variables d'environnement

| Variable        | Où                       | Rôle                                         |
| --------------- | ------------------------ | -------------------------------------------- |
| `ANTHROPIC_KEY` | Serveur (Vercel / local) | Clé API Anthropic utilisée par `/api/arnold` |

Ne jamais préfixer cette clé par `VITE_` : elle ne doit pas être exposée au navigateur.

## Scripts

| Commande               | Effet                                      |
| ---------------------- | ------------------------------------------ |
| `npm run dev`          | Serveur de développement Vite              |
| `npm run build`        | Build de production dans `dist/`           |
| `npm run preview`      | Prévisualisation du build                  |
| `npm run lint`         | ESLint sur tout le projet                  |
| `npm run format`       | Formatage Prettier (`src`, `api`, configs) |
| `npm run format:check` | Vérifie le formatage sans modifier         |

## Structure

```
api/arnold.js        Route serverless → API Anthropic
src/App.jsx          Interface, prompt système, modes FC, historique
src/main.jsx         Point d'entrée React
public/              Favicon et ressources statiques
```

## Remarques

- L'historique des feedbacks (scores réels saisis par l'utilisateur) est stocké dans
  `localStorage` et résumé dans le prompt système, avec le taux de vainqueurs prédits justes.
- Le modèle utilisé est défini dans `src/App.jsx` (`callArnold`).
