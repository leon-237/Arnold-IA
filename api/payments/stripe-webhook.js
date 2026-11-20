import Stripe from "stripe";
import { getPlan } from "../../lib/plans.js";
import { adminClient, activatePlan } from "../../lib/supabase.js";

// Stripe exige le corps brut pour vérifier la signature.
export const config = { api: { bodyParser: false } };

async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event;
  try {
    const raw = await readRaw(req);
    event = stripe.webhooks.constructEvent(
      raw,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    return res.status(400).json({ error: `Signature invalide : ${err.message}` });
  }

  const db = adminClient();

  try {
    // Premier paiement (pass 5 jours ou premier mois)
    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      if (s.payment_status !== "paid") return res.status(200).json({ received: true });
      const planKey = s.metadata?.plan;
      const plan = getPlan(planKey);
      if (!plan) return res.status(200).json({ received: true, ignored: "plan inconnu" });

      await activatePlan({
        db,
        userId: s.metadata.user_id,
        plan: planKey,
        days: plan.days,
        quota: plan.quota,
        providerRef: s.id,
        provider: "stripe",
        amount: plan.amount,
        currency: "XAF",
      });
    }

    // Renouvellement mensuel
    if (event.type === "invoice.paid") {
      const inv = event.data.object;
      if (inv.billing_reason !== "subscription_cycle")
        return res.status(200).json({ received: true });
      const subId = inv.subscription ?? inv.parent?.subscription_details?.subscription;
      if (!subId) return res.status(200).json({ received: true });

      const sub = await stripe.subscriptions.retrieve(subId);
      const planKey = sub.metadata?.plan;
      const plan = getPlan(planKey);
      if (!plan) return res.status(200).json({ received: true, ignored: "plan inconnu" });

      await activatePlan({
        db,
        userId: sub.metadata.user_id,
        plan: planKey,
        days: plan.days,
        quota: plan.quota,
        providerRef: inv.id,
        provider: "stripe",
        amount: plan.amount,
        currency: "XAF",
      });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    // 500 : Stripe réessaiera l'événement.
    return res.status(500).json({ error: err.message });
  }
}
