import { randomUUID } from "node:crypto";
import { adminClient, userFromRequest } from "../../lib/supabase.js";
import { getPlan, CURRENCY } from "../../lib/plans.js";
import { collect } from "../../lib/campay.js";

// Numéro camerounais au format 2376XXXXXXXX (9 chiffres après 237, commençant par 6).
const PHONE_RE = /^2376\d{8}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: "Connexion requise.", code: "AUTH_REQUIRED" });

  const planKey = req.body?.plan;
  const plan = getPlan(planKey);
  if (!plan) return res.status(400).json({ error: "Plan inconnu." });

  const phone = String(req.body?.phone || "").replace(/[\s+]/g, "");
  if (!PHONE_RE.test(phone)) {
    return res
      .status(400)
      .json({ error: "Numéro invalide. Format attendu : 2376XXXXXXXX (Orange ou MTN)." });
  }

  try {
    const result = await collect({
      amount: plan.amount,
      phone,
      description: `ARNOLD · ${plan.label}`,
      externalReference: randomUUID(),
    });

    const { error } = await adminClient().from("payments").insert({
      user_id: user.id,
      provider: "campay",
      provider_ref: result.reference,
      plan: planKey,
      amount: plan.amount,
      currency: CURRENCY,
      status: "pending",
    });
    if (error) throw error;

    // L'utilisateur valide la demande sur son téléphone ; le webhook confirme ensuite.
    return res.status(200).json({ reference: result.reference, status: "PENDING" });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
