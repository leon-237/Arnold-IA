// Tarifs et quotas. Source unique pour Stripe, CamPay et le serveur.
export const PLANS = {
  pass5: {
    label: "Pass 5 jours",
    amount: 2000, // XAF
    quota: 4, // analyses
    days: 5,
    stripeMode: "payment", // paiement unique
  },
  monthly: {
    label: "Abonnement mensuel",
    amount: 13000, // XAF
    quota: 10, // analyses
    days: 30,
    stripeMode: "subscription", // renouvelé chaque mois
  },
};

export const FREE_PER_DAY = 2;
export const CURRENCY = "XAF";

export function getPlan(key) {
  return Object.prototype.hasOwnProperty.call(PLANS, key) ? PLANS[key] : null;
}
