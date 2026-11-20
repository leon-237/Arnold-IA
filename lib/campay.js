// Client minimal de l'API CamPay (Mobile Money, Cameroun).
// Base de test : https://demo.campay.net/api — production : https://www.campay.net/api
const BASE = process.env.CAMPAY_BASE_URL || "https://demo.campay.net/api";

let cachedToken = null;
let cachedUntil = 0;

async function getToken() {
  if (cachedToken && Date.now() < cachedUntil) return cachedToken;
  const res = await fetch(`${BASE}/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.CAMPAY_USERNAME,
      password: process.env.CAMPAY_PASSWORD,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) throw new Error(`CamPay auth échouée (${res.status})`);
  cachedToken = data.token;
  cachedUntil = Date.now() + 50 * 60 * 1000; // le jeton expire ; on le renouvelle avant
  return cachedToken;
}

// Lance une demande de paiement. `phone` au format 2376XXXXXXXX.
export async function collect({ amount, phone, description, externalReference }) {
  const token = await getToken();
  const res = await fetch(`${BASE}/collect/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
    body: JSON.stringify({
      amount: String(amount),
      from: phone,
      description,
      external_reference: externalReference,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.reference) {
    throw new Error(data.message || `CamPay collect échoué (${res.status})`);
  }
  return data; // contient reference
}
