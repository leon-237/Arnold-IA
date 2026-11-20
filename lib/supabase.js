import { createClient } from "@supabase/supabase-js";

// Client serveur : clé service_role, jamais exposée au navigateur.
export function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Vérifie le JWT Supabase envoyé par le navigateur et renvoie l'utilisateur.
export async function userFromRequest(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

// Active un plan après paiement confirmé. Idempotent grâce à payments.status.
export async function activatePlan({
  db,
  userId,
  plan,
  days,
  quota,
  providerRef,
  provider,
  amount,
  currency,
}) {
  const { data: existing } = await db
    .from("payments")
    .select("id,status")
    .eq("provider_ref", providerRef)
    .maybeSingle();

  if (existing?.status === "succeeded") return { alreadyDone: true };

  if (existing) {
    await db
      .from("payments")
      .update({ status: "succeeded", updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await db.from("payments").insert({
      user_id: userId,
      provider,
      provider_ref: providerRef,
      plan,
      amount,
      currency,
      status: "succeeded",
    });
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);
  const { error } = await db.from("subscriptions").insert({
    user_id: userId,
    plan,
    quota,
    used: 0,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
  });
  if (error) throw error;
  return { alreadyDone: false, endsAt: endsAt.toISOString() };
}
