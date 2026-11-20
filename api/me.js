import { adminClient, userFromRequest } from "../lib/supabase.js";
import { FREE_PER_DAY } from "../lib/plans.js";

// Statut de l'utilisateur : abonnement actif et analyses restantes.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Méthode non autorisée" });
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: "Connexion requise.", code: "AUTH_REQUIRED" });

  const db = adminClient();
  const nowIso = new Date().toISOString();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [{ data: subs }, { count: freeToday }] = await Promise.all([
    db
      .from("subscriptions")
      .select("plan,quota,used,ends_at")
      .eq("user_id", user.id)
      .gt("ends_at", nowIso)
      .order("ends_at"),
    db
      .from("analysis_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("source", "free")
      .gte("created_at", startOfDay.toISOString()),
  ]);

  const active = (subs || []).find((s) => s.used < s.quota) || null;
  res.status(200).json({
    email: user.email,
    subscription: active
      ? { plan: active.plan, remaining: active.quota - active.used, endsAt: active.ends_at }
      : null,
    freeRemaining: Math.max(0, FREE_PER_DAY - (freeToday || 0)),
  });
}
