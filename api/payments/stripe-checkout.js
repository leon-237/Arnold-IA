import Stripe from "stripe";
import { adminClient, userFromRequest } from "../../lib/supabase.js";
import { getPlan, CURRENCY } from "../../lib/plans.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: "Connexion requise.", code: "AUTH_REQUIRED" });

  const plan = getPlan(req.body?.plan);
  if (!plan) return res.status(400).json({ error: "Plan inconnu." });

  const planKey = req.body.plan;
  const appUrl = process.env.APP_URL;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const isSub = plan.stripeMode === "subscription";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: plan.stripeMode,
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY.toLowerCase(),
            unit_amount: plan.amount, // XAF : pas de décimales
            product_data: { name: `ARNOLD · ${plan.label}` },
            ...(isSub ? { recurring: { interval: "month" } } : {}),
          },
        },
      ],
      metadata: { user_id: user.id, plan: planKey },
      ...(isSub ? { subscription_data: { metadata: { user_id: user.id, plan: planKey } } } : {}),
      success_url: `${appUrl}/?paid=stripe`,
      cancel_url: `${appUrl}/?paid=cancel`,
    });

    const { error } = await adminClient().from("payments").insert({
      user_id: user.id,
      provider: "stripe",
      provider_ref: session.id,
      plan: planKey,
      amount: plan.amount,
      currency: CURRENCY,
      status: "pending",
    });
    if (error) throw error;

    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
