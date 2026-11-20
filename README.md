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

## Mise en service (abonnements)

1. **Supabase** : créer un projet, puis exécuter `supabase/schema.sql` dans le SQL Editor.
   Dans Authentication → URL Configuration, renseigner l'URL de l'app (Site URL et redirections).
2. **Stripe** : créer une clé secrète, activer le XAF sur le compte, puis ajouter un webhook
   vers `/api/payments/stripe-webhook` pour `checkout.session.completed` et `invoice.paid`.
3. **CamPay** : récupérer `username` / `password` et la clé webhook de l'application ; configurer
   l'URL `/api/payments/campay-webhook` dans le tableau de bord CamPay.
4. Renseigner toutes les variables de `.env.example` dans Vercel.

Pour tester en local avec les routes `/api` : `npx vercel dev` (`npm run dev` ne sert pas les fonctions).

## Règles d'accès

- **Gratuit** : 2 analyses par jour (jour UTC).
- **Pass 5 jours** : 4 analyses valables 5 jours, 2 000 XAF (paiement unique, carte ou Mobile Money).
- **Mensuel** : 10 analyses valables 30 jours, 13 000 XAF. Renouvellement automatique par carte ;
  par Mobile Money (pas de prélèvement récurrent), il faut repayer chaque mois.

Les clés `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` et `CAMPAY_*` ne doivent jamais être
préfixées par `VITE_` : elles restent côté serveur.

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
- Le modèle est fixé côté serveur (`api/arnold.js`) : le client ne peut pas le choisir.
