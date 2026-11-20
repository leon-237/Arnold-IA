import { adminClient } from "../../lib/supabase.js";
import { getPlan } from "../../lib/plans.js";
import { activatePlan } from "../../lib/supabase.js";
import { verifyHs256 } from "../../lib/jwt.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const body = req.body || {};
  // CamPay signe la notification : JWT HS256 avec la clé « webhook » de l'application.
  const payload = verifyHs256(body.signature, process.env.CAMPAY_WEBHOOK_KEY);
  if (!payload) return res.status(401).json({ error: "Signature invalide." });
  if (payload.reference && payload.reference !== body.reference) {
    return res.status(401).json({ error: "Référence incohérente." });
  }

  const db = adminClient();
  const { data: pay } = await db
    .from("payments")
    .select("id,user_id,plan,amount,status,provider")
    .eq("provider", "campay")
    .eq("provider_ref", body.reference)
    .maybeSingle();
  if (!pay) return res.status(404).json({ error: "Paiement inconnu." });

  try {
    if (body.status === "SUCCESSFUL") {
      const plan = getPlan(pay.plan);
      if (Number(body.amount) && Number(body.amount) !== plan.amount) {
        await db
          .from("payments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", pay.id);
        return res.status(400).json({ error: "Montant incohérent." });
      }
      await activatePlan({
        db,
        userId: pay.user_id,
        plan: pay.plan,
        days: plan.days,
        quota: plan.quota,
        providerRef: body.reference,
        provider: "campay",
        amount: plan.amount,
        currency: "XAF",
      });
    } else if (body.status === "FAILED") {
      await db
        .from("payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", pay.id)
        .eq("status", "pending");
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
