import { adminClient, userFromRequest } from "../lib/supabase.js";

const MODEL = "claude-haiku-5-5";
const MAX_TOKENS_CAP = 4000;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.APP_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) return res.status(500).json({ error: "Clé API non configurée sur le serveur." });

  // 1. Utilisateur connecté ?
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: "Connexion requise.", code: "AUTH_REQUIRED" });

  // 2. Quota : abonnement, sinon gratuit (2/jour), sinon refus.
  let source;
  try {
    const { data, error } = await adminClient().rpc("consume_analysis", { p_user: user.id });
    if (error) throw error;
    source = data;
  } catch (err) {
    return res.status(500).json({ error: "Impossible de vérifier le quota.", detail: err.message });
  }
  if (source === "denied") {
    return res.status(402).json({
      error: "Quota atteint : 2 analyses gratuites par jour. Choisis un abonnement pour continuer.",
      code: "QUOTA_EXCEEDED",
    });
  }

  // 3. Liste blanche des champs : le client ne peut pas choisir un autre modèle ni des outils libres.
  const { system, messages, tools } = req.body || {};
  if (typeof system !== "string" || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Requête invalide." });
  }
  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS_CAP,
    system,
    messages,
    tools:
      Array.isArray(tools) && tools.length
        ? tools.filter((t) => t?.type === "web_search_20250305" && t?.name === "web_search")
        : [],
  };

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    res.setHeader("X-Analysis-Source", source);
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
