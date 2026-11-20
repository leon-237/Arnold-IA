import { useEffect, useState } from "react";
import { supabase, authHeaders } from "./supabase.js";

const C = {
  bg: "#070B0D",
  surf: "#0d1114",
  bdr: "#192022",
  acc: "#00D4AA",
  t: "#C8D4D0",
  muted: "#5a6868",
  red: "#ef4444",
};
const mono = "'DM Mono', monospace";

const card = {
  background: C.surf,
  border: `1px solid ${C.bdr}`,
  borderRadius: 10,
  padding: 16,
};
const input = {
  width: "100%",
  padding: "9px 11px",
  background: "#090c0e",
  border: `1px solid ${C.bdr}`,
  borderRadius: 6,
  color: C.t,
  fontSize: 14,
  fontFamily: mono,
};
const btn = (on = true) => ({
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: "none",
  background: on ? "linear-gradient(135deg,#00D4AA,#0077FF)" : "#141414",
  color: "#fff",
  fontWeight: 800,
  letterSpacing: 1,
  fontFamily: mono,
  fontSize: 12,
  cursor: on ? "pointer" : "not-allowed",
});

// ── Connexion par lien magique ──────────────────────────────
export function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = chargement
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!supabase) {
    return (
      <div style={{ padding: 40, color: C.red, fontFamily: mono, fontSize: 12 }}>
        Configuration manquante : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.
      </div>
    );
  }
  if (session === undefined) {
    return (
      <div style={{ padding: 40, color: C.muted, fontFamily: mono, fontSize: 12 }}>Chargement…</div>
    );
  }
  if (session) return children;

  const sendLink = async (e) => {
    e.preventDefault();
    setError("");
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (err) setError(err.message);
    else setSent(true);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: C.bg,
      }}
    >
      <div style={{ ...card, width: "100%", maxWidth: 380 }}>
        <div
          style={{ fontSize: 18, fontWeight: 900, letterSpacing: 4, color: C.acc, marginBottom: 4 }}
        >
          ARNOLD
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 16, fontFamily: mono }}>
          Connexion par e-mail
        </div>
        {sent ? (
          <div style={{ color: C.t, fontSize: 13, lineHeight: 1.6 }}>
            Lien envoyé à <b>{email}</b>. Ouvre-le depuis cet appareil pour te connecter.
          </div>
        ) : (
          <form onSubmit={sendLink} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
              style={input}
            />
            <button type="submit" disabled={!email || !supabase} style={btn(!!email && !!supabase)}>
              RECEVOIR LE LIEN
            </button>
            {error && <div style={{ color: C.red, fontSize: 12 }}>{error}</div>}
          </form>
        )}
      </div>
    </div>
  );
}

// ── Page d'abonnement ───────────────────────────────────────
const PLANS = [
  {
    key: "pass5",
    label: "Pass 5 jours",
    price: "2 000 XAF",
    detail: "4 analyses valables 5 jours",
  },
  { key: "monthly", label: "Mensuel", price: "13 000 XAF / mois", detail: "10 analyses par mois" },
];

export function PricingPanel() {
  const [status, setStatus] = useState(null);
  const [plan, setPlan] = useState(null); // plan choisi pour Mobile Money
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch("/api/me", { headers: await authHeaders() });
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    } catch {
      return null; /* hors ligne : on garde l'état précédent */
    }
  };

  useEffect(() => {
    let alive = true;
    loadStatus().then((data) => {
      if (alive && data) setStatus(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const payStripe = async (planKey) => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/payments/stripe-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Paiement impossible");
      window.location.assign(data.url);
    } catch (err) {
      setMsg(err.message);
      setBusy(false);
    }
  };

  const payCampay = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/payments/campay-collect", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ plan: plan.key, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Demande impossible");
      setMsg(
        "Valide la demande de paiement sur ton téléphone. Cette page se met à jour automatiquement.",
      );
      // Interroge le statut pendant ~2 minutes
      for (let i = 0; i < 24; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const s = await loadStatus();
        if (s?.subscription?.plan === plan.key) break;
      }
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={card}>
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              letterSpacing: 2,
              fontFamily: mono,
              marginBottom: 8,
            }}
          >
            TON ACCÈS
          </div>
          {status ? (
            <div style={{ fontSize: 13, color: C.t, lineHeight: 1.7 }}>
              <div>
                Gratuit aujourd'hui : <b style={{ color: C.acc }}>{status.freeRemaining}</b> / 2
              </div>
              {status.subscription ? (
                <div>
                  Abonnement {status.subscription.plan === "pass5" ? "Pass 5 jours" : "mensuel"} :{" "}
                  <b style={{ color: C.acc }}>{status.subscription.remaining}</b> analyse(s)
                  restantes, jusqu'au{" "}
                  {new Date(status.subscription.endsAt).toLocaleDateString("fr-FR")}
                </div>
              ) : (
                <div style={{ color: C.muted }}>Aucun abonnement actif.</div>
              )}
            </div>
          ) : (
            <div style={{ color: C.muted, fontSize: 12 }}>Chargement du statut…</div>
          )}
          <button
            onClick={signOut}
            style={{
              marginTop: 10,
              background: "transparent",
              border: "none",
              color: C.muted,
              fontSize: 11,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Se déconnecter
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            gap: 12,
          }}
        >
          {PLANS.map((p) => (
            <div key={p.key} style={card}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.t, marginBottom: 4 }}>
                {p.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.acc, fontFamily: mono }}>
                {p.price}
              </div>
              <div style={{ fontSize: 12, color: C.muted, margin: "6px 0 14px" }}>{p.detail}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button disabled={busy} onClick={() => payStripe(p.key)} style={btn(!busy)}>
                  PAYER PAR CARTE
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setPlan(p);
                    setMsg("");
                  }}
                  style={{
                    ...btn(!busy),
                    background: "transparent",
                    border: `1px solid ${C.bdr}`,
                    color: C.acc,
                  }}
                >
                  MOBILE MONEY (ORANGE / MTN)
                </button>
              </div>
            </div>
          ))}
        </div>

        {plan && (
          <div style={card}>
            <div style={{ fontSize: 12, color: C.t, marginBottom: 8 }}>
              Mobile Money · {plan.label} ({plan.price})
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="2376XXXXXXXX"
                style={{ ...input, flex: 1 }}
              />
              <button
                disabled={busy || !phone}
                onClick={payCampay}
                style={{ ...btn(!busy && !!phone), width: "auto", padding: "10px 16px" }}
              >
                PAYER
              </button>
            </div>
          </div>
        )}

        {msg && <div style={{ fontSize: 12, color: C.t, lineHeight: 1.6 }}>{msg}</div>}

        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
          Gratuit : 2 analyses par jour. Les analyses comptent à chaque envoi au moteur. Le mensuel
          se renouvelle automatiquement par carte ; par Mobile Money, il faut repayer chaque mois.
        </div>
      </div>
    </div>
  );
}
