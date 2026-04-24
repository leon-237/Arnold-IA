/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// ARNOLD FOOTBALL AI v5 — SÉCURISÉ + ROBUSTE
// ============================================================

const API = "https://api.anthropic.com/v1/messages";

// ── FC Modes ─────────────────────────────────────────────────
const FC_MODES = {
  FC24_4v4: {
    label: "FC24 · 4v4 Rush", game: "EA FC 24", players: 4,
    goalkeeper: false, corners: false, penalties: false,
    goalSize: "Petites cages Volta", fieldSize: "~35 × 25 m",
    offside: false, blueCard: false,
    cards: "Jaunes/rouges standard", extraTime: "—",
    style: "Arcade / street / skill moves / créativité individuelle",
    notes: "Pas de gardien · Pas de corners · Pas de penaltys · Style Volta freestyle",
    color: "#FF6B35", colorDim: "rgba(255,107,53,0.1)"
  },
  FC25_5v5: {
    label: "FC25 · 5v5 Rush", game: "EA FC 25", players: 5,
    goalkeeper: true, corners: true, penalties: false,
    goalSize: "Cages 11v11 standard", fieldSize: "63.7 × 46.6 m",
    offside: "Dernier tiers uniquement", blueCard: false,
    cards: "Cartons standards", extraTime: "—",
    style: "Compétitif · passes latérales · pressing · collectif",
    notes: "Gardien IA · Course au ballon · CF indirects · Pas de penalty · Pas de carton bleu · Pas de prolongation",
    color: "#00D4AA", colorDim: "rgba(0,212,170,0.1)"
  },
  FC25_3v3: {
    label: "FC25 · 3v3 Rush", game: "EA FC 25", players: 3,
    goalkeeper: false, corners: false, penalties: false,
    goalSize: "Petites cages Volta", fieldSize: "~28 × 20 m",
    offside: false, blueCard: false,
    cards: "Cartons standards", extraTime: "—",
    style: "Ultra-rapide · individuel · skill moves · 1v1",
    notes: "Pas de gardien · Pas de corners · Plus arcade que le 4v4",
    color: "#A855F7", colorDim: "rgba(168,85,247,0.1)"
  }
};

// ── Date & Season Context ─────────────────────────────────────
function getLiveContext() {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, "0");
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const year = now.getFullYear();
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const monthName = months[now.getMonth()];
  const days = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
  const dayName = days[now.getDay()];

  const footballSeason = now.getMonth() >= 7
    ? `${year}-${year + 1}`
    : `${year - 1}-${year}`;

  const _m = now.getMonth() + 1;
  const uclPhase = _m >= 9 && _m <= 12 ? "Phase de ligue (sept-déc)"
    : _m === 1 || _m === 2 ? "Playoffs / 8e de finale aller (jan-fév)"
    : _m === 3 ? "8e de finale retour / Quarts aller"
    : _m === 4 ? "Quarts retour / Demis aller"
    : _m === 5 ? "Demis retour / Finale"
    : "Intersaison / Qualifications";

  return {
    dateISO: `${year}-${month}-${day}`,
    dateFR: `${dayName} ${day} ${monthName} ${year}`,
    year, month: parseInt(month), day: parseInt(day),
    footballSeason, uclPhase,
    timestamp: now.toISOString()
  };
}

// ── Dynamic System Prompt ─────────────────────────────────────
function buildSystem(extraPrompts = [], agentMode = "arnold") {
  const ctx = getLiveContext();

  const base = `Tu es ARNOLD, expert mondial en analyse football.

## CONTEXTE TEMPOREL — INJECTÉ AUTOMATIQUEMENT
⏰ Date exacte aujourd'hui : ${ctx.dateFR} (${ctx.dateISO})
📅 Saison football en cours : ${ctx.footballSeason}
🏆 Phase UCL approximative : ${ctx.uclPhase}
🌍 Année : ${ctx.year}

⚠️ RÈGLE ABSOLUE : Tu raisonnes TOUJOURS à partir de cette date. Tu ne fais jamais référence à des saisons passées comme "en cours". Tu n'inventes jamais de données futures. Si on te demande "les derniers matchs", c'est les matchs les plus récents à la date du ${ctx.dateISO}. Tu utilises toujours l'année ${ctx.year} dans tes recherches web.

## ARCHITECTURE DES DONNÉES

### ✅ WEB SEARCH — 4 requêtes ciblées uniquement
Utilise web_search pour ces données dynamiques SEULEMENT :
1. Forme récente : "[équipe] résultats matchs ${ctx.footballSeason}" ou "[équipe] derniers matchs ${ctx.year}"
2. Blessés/suspendus : "[équipe] blessés absents ${monthName(ctx.month)} ${ctx.year}"
3. H2H : "[équipe1] [équipe2] historique confrontations résultats"
4. Transferts/absences : "[équipe] transferts absences ${ctx.footballSeason}"

### ❌ PAS de web search pour :
- Moyennes saison, possession, xG → estimés en interne
- Logique tactique, compatibilité, prédiction → modèle interne
- Palmarès, historique long terme → connaissance interne

## FORMAT DE RÉPONSE — JSON STRICT
Réponds UNIQUEMENT en JSON valide. Aucun texte, aucun markdown autour.

Pour une analyse de match :
{
  "type": "analysis",
  "meta": {
    "team1": "Nom",
    "team2": "Nom",
    "competition": "Nom",
    "matchDate": "Date ou À venir",
    "season": "${ctx.footballSeason}",
    "analysisDate": "${ctx.dateISO}",
    "mode": "real",
    "webQueries": ["requête effectuée 1", "requête 2"]
  },
  "liveData": {
    "team1": {
      "last10": [
        {"date":"${ctx.year}-MM-DD","opponent":"Adversaire","score":"2-1","result":"V","competition":"UCL"}
      ],
      "injuries": [{"name":"Joueur","position":"ATT","returnDate":"estimée","severity":"grave|modérée|légère"}],
      "suspensions": [{"name":"Joueur","reason":"Cartons","matchesMissed":1}],
      "recentTransfers": [{"name":"Joueur","type":"arrivée","from":"Club","impact":"important"}]
    },
    "team2": {},
    "h2h": {
      "last5": [{"date":"YYYY-MM-DD","score":"1-0","winner":"équipe1|équipe2|nul","competition":"UCL"}],
      "team1Wins": 3, "team2Wins": 1, "draws": 1, "avgGoals": 2.4,
      "lastMeeting": "YYYY-MM-DD"
    }
  },
  "internalData": {
    "team1": {
      "avgGoalsScored": 2.1,
      "avgGoalsConceded": 0.9,
      "avgCorners": 6.8,
      "avgShotsOnTarget": 5.9,
      "avgPossession": 62,
      "yellowCardsTotal": 38,
      "xGPerMatch": 2.2,
      "cleanSheets": 11,
      "composition": "4-3-3",
      "compatibilityScore": 85,
      "compatibilityNote": "Explication compatibilité joueurs dans ce système",
      "tacticalStyle": "Pressing haut, transitions rapides",
      "strengths": ["Force 1", "Force 2"],
      "weaknesses": ["Faiblesse 1"],
      "keyPlayers": [{"name":"Nom","role":"Rôle","stat":"18 buts","impact":"crucial"}]
    },
    "team2": {}
  },
  "prediction": {
    "score1": 2, "score2": 1,
    "winner": "Équipe",
    "confidence": 68,
    "resultProbs": {"team1Win": 55, "draw": 25, "team2Win": 20},
    "btts": true,
    "over25": true,
    "keyReason": "Raison principale courte"
  },
  "keyFactors": [
    {"icon":"🔄","label":"Forme récente","tag":"LIVE","detail":"..."},
    {"icon":"🟨","label":"Suspensions","tag":"LIVE","detail":"..."},
    {"icon":"🤝","label":"H2H","tag":"LIVE","detail":"..."},
    {"icon":"📐","label":"Corners","tag":"LOCAL","detail":"..."},
    {"icon":"🎯","label":"Tirs cadrés","tag":"LOCAL","detail":"..."},
    {"icon":"⚖️","label":"Enjeux","tag":"LOCAL","detail":"..."}
  ],
  "tacticalNote": "Analyse tactique 4-5 phrases.",
  "sources": ["source web 1"]
}

Pour les modes FC (meta.mode = FC24_4v4 / FC25_5v5 / FC25_3v3) :
- Pas de web search sur la forme (données jeu vidéo non disponibles en ligne)
- Adapte les stats aux mécaniques FC (vitesse, dribble, tir, défense format réduit)
- Style équipes FC ≠ réalité
- Spécifiquement pour FC25_5v5 : Ne prends pas en compte les pénaltys, cartons bleus ou prolongations dans ton analyse, car ces éléments ne sont pas pertinents pour le calcul des paris (xbet).

Pour toute autre question : { "type": "chat", "message": "Réponse" }`;

  let system = base;
  if (agentMode === "tnt") system += `\n\nMode TNT actif : enrichis avec xG attendu, PPDA, pressing intensité, lignes défensives, transitions. Même format JSON.`;
  if (agentMode === "duvane") system += `\n\nMode DUVANE actif : priorité aux 10 derniers matchs, stats 3 derniers mois. Même format JSON.`;
  extraPrompts.forEach(p => { system += `\n\n## Programme Duvan — ${p.name}:\n${p.content}`; });

  return system;
}

function monthName(m) {
  return ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"][m-1];
}

// ── API Call (SÉCURISÉ) ───────────────────────────────────────
async function callArnold(messages, system) {
  const _key = 'process.env.VITE_ANTHROPIC_API_KEY';
  if (!_key || _key.trim() === "") {
    throw new Error("❌ Clé API non configurée dans le code.");
  }

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": _key.trim(),
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `Erreur HTTP ${res.status}`;
      throw new Error(`Erreur API Anthropic: ${errorMsg}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "Erreur API inconnue");
    
    const textContent = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    if (!textContent) throw new Error("Aucune réponse texte reçue de l'API");
    
    return textContent;
  } catch (err) {
    console.error("Erreur lors de l'appel à l'API:", err);
    throw err;
  }
}

// ── JSON Parser (ROBUSTE) ─────────────────────────────────────
function parseJSON(raw) {
  if (!raw || typeof raw !== "string") {
    return { type: "chat", message: "Aucune réponse reçue de l'IA." };
  }

  // Tentative 1 : Parser direct après nettoyage des blocs markdown
  try {
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    if (cleaned.startsWith("{")) {
      return JSON.parse(cleaned);
    }
  } catch {
    // Continue vers la tentative suivante
  }

  // Tentative 2 : Chercher le premier { et le dernier }
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const jsonStr = raw.substring(start, end + 1);
      return JSON.parse(jsonStr);
    }
  } catch {
    // Continue vers la tentative suivante
  }

  // Tentative 3 : Utiliser une regex pour extraire l'objet JSON
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch (e) {
    // Continue vers le fallback
  }

  // Fallback : retourner le texte brut comme message
  console.warn("Impossible de parser JSON, retour du texte brut:", raw);
  return { type: "chat", message: raw };
}

// ── Small Components ──────────────────────────────────────────
const FC = { V: "#22c55e", N: "#f59e0b", D: "#ef4444" };

function FormRow({ matches }) {
  if (!matches?.length) return null;
  return (
    <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
      {matches.slice(0, 10).map((m, i) => {
        const r = m.result || m;
        return (
          <div key={i} title={`${m.date || ""} vs ${m.opponent || ""} ${m.score || ""}`} style={{
            width: 15, height: 15, borderRadius: 3,
            background: FC[r] || "#2a2a2a",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 7, fontWeight: 900, color: "#fff",
            fontFamily: "'DM Mono', monospace", flexShrink: 0
          }}>{r}</div>
        );
      })}
    </div>
  );
}

function LiveTag({ type }) {
  const isLive = type === "LIVE";
  const c = isLive ? "#00D4AA" : "#4a5568";
  return (
    <span style={{ fontSize: 7, fontWeight: 700, color: c, background: `${c}18`, padding: "1px 5px", borderRadius: 3, fontFamily: "'DM Mono', monospace", display: "inline-flex", alignItems: "center" }}>{type}</span>
  );
}

function ProbBar({ t1, draw, t2, name1, name2 }) {
  const sum = (t1||0) + (draw||0) + (t2||0) || 100;
  const p1 = (t1/sum)*100, pD = (draw/sum)*100, p2 = (t2/sum)*100;
  return (
    <div style={{ width: "100%", height: 14, borderRadius: 7, background: "#111", display: "flex", overflow: "hidden", border: "1px solid #1a2a38" }}>
      <div title={`${name1}: ${p1.toFixed(1)}%`} style={{ width: `${p1}%`, background: "#3B82F6", transition: "width .6s ease" }} />
      <div title={`Nul: ${pD.toFixed(1)}%`} style={{ width: `${pD}%`, background: "#1e2a38", transition: "width .6s ease" }} />
      <div title={`${name2}: ${p2.toFixed(1)}%`} style={{ width: `${p2}%`, background: "#EF4444", transition: "width .6s ease" }} />
    </div>
  );
}

function AnimBar({ label, val1, val2, unit, delay }) {
  const [w, setW] = useState(0);
  useEffect(() => { setTimeout(() => setW(100), delay); }, []);
  const sum = (val1||0) + (val2||0) || 1;
  const p1 = (val1/sum)*100, p2 = (val2/sum)*100;
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "#444", marginBottom: 2, fontFamily: "'DM Mono', monospace" }}>
        <span>{val1}{unit}</span>
        <span style={{ color: "#1a1a1a" }}>{label}</span>
        <span>{val2}{unit}</span>
      </div>
      <div style={{ width: "100%", height: 3, background: "#0d0d0d", borderRadius: 2, display: "flex", overflow: "hidden" }}>
        <div style={{ width: w === 100 ? `${p1}%` : "0%", background: "#3B82F6", transition: "width .8s ease-out" }} />
        <div style={{ flex: 1 }} />
        <div style={{ width: w === 100 ? `${p2}%` : "0%", background: "#EF4444", transition: "width .8s ease-out" }} />
      </div>
    </div>
  );
}

function Timeline({ matches }) {
  return (
    <div style={{ display: "flex", gap: 3, marginTop: 5 }}>
      {matches.map((m, i) => (
        <div key={i} style={{ flex: 1, height: 18, background: FC[m.result] || "#111", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 900, color: "#fff", cursor: "help" }} title={`${m.date} vs ${m.opponent} (${m.score})`}>
          {m.result}
        </div>
      ))}
    </div>
  );
}

function H2H({ h2h, name1, name2 }) {
  return (
    <div style={{ background: "#0b0e10", border: "1px solid #192022", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 9 }}>
        <span style={{ fontSize: 8, color: "#2a3838", letterSpacing: 1.5, fontFamily: "'DM Mono', monospace" }}>CONFRONTATIONS DIRECTES</span>
        <LiveTag type="LIVE" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#3B82F6" }}>{h2h.team1Wins}</div>
          <div style={{ fontSize: 7, color: "#2a3838", letterSpacing: 1 }}>{name1?.toUpperCase()}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#444" }}>{h2h.draws}</div>
          <div style={{ fontSize: 7, color: "#2a3838", letterSpacing: 1 }}>NULS</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#EF4444" }}>{h2h.team2Wins}</div>
          <div style={{ fontSize: 7, color: "#2a3838", letterSpacing: 1 }}>{name2?.toUpperCase()}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {h2h.last5?.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 9, padding: "4px 6px", background: "#0d1114", borderRadius: 4, fontFamily: "'DM Mono', monospace" }}>
            <span style={{ color: "#2a3838" }}>{m.date}</span>
            <span style={{ color: "#444" }}>{m.competition}</span>
            <span style={{ fontWeight: 700, color: m.winner === "équipe1" ? "#3B82F6" : m.winner === "équipe2" ? "#EF4444" : "#f59e0b" }}>{m.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamCol({ live, internal, side }) {
  const color = side === "left" ? "#3B82F6" : "#EF4444";
  const lv = live || {};
  const it = internal || {};
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9 }}>
      {lv.injuries?.length > 0 && (
        <div style={{ background: "#0b0e10", border: `1px solid ${color}18`, borderRadius: 7, padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
            <span style={{ fontSize: 8, color: "#2a3838", letterSpacing: 1.5, fontFamily: "'DM Mono', monospace" }}>BLESSÉS / ABSENTS</span>
            <LiveTag type="LIVE" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {lv.injuries.map((j, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: j.severity === "grave" ? "#ef4444" : "#f59e0b" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#ccc", fontFamily: "'Barlow Condensed', sans-serif" }}>{j.name}</div>
                  <div style={{ fontSize: 8, color: "#333" }}>{j.position} · Retour: {j.returnDate}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {it.keyPlayers?.length > 0 && (
        <div style={{ background: "#0b0e10", border: `1px solid ${color}18`, borderRadius: 7, padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
            <span style={{ fontSize: 8, color: "#2a3838", letterSpacing: 1.5, fontFamily: "'DM Mono', monospace" }}>JOUEURS CLÉS</span>
            <LiveTag type="LOCAL" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {it.keyPlayers.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, flexShrink: 0 }}>⭐</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#ccc", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}>{p.name}</div>
                  <div style={{ fontSize: 8.5, color: "#333" }}>{p.role} · <span style={{ color }}>{p.stat}</span></div>
                </div>
                {p.impact === "crucial" && <span style={{ fontSize: 7.5, color, background: `${color}18`, padding: "1px 5px", borderRadius: 3, fontFamily: "'DM Mono', monospace" }}>KEY</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {lv.last10?.length > 0 && (
        <div style={{ background: "#0b0e10", border: `1px solid ${color}18`, borderRadius: 7, padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
            <span style={{ fontSize: 8, color: "#2a3838", letterSpacing: 1.5, fontFamily: "'DM Mono', monospace" }}>10 DERNIERS MATCHS</span>
            <LiveTag type="LIVE" />
          </div>
          <Timeline matches={lv.last10} />
        </div>
      )}
    </div>
  );
}

// ── Full Analysis Card ────────────────────────────────────────
function AnalysisCard({ data }) {
  const [vis, setVis] = useState(false);
  useEffect(() => { setTimeout(() => setVis(true), 50); }, []);

  if (data.type === "chat") return (
    <div style={{ padding: "13px 17px", background: "linear-gradient(135deg,rgba(0,212,170,0.05),rgba(0,80,180,0.03))", border: "1px solid rgba(0,212,170,0.11)", borderRadius: 11, fontSize: 13, color: "#c0c8c0", lineHeight: 1.75, fontFamily: "'Crimson Pro', serif", whiteSpace: "pre-wrap" }}>{data.message}</div>
  );

  const { meta, liveData, internalData, prediction, keyFactors, tacticalNote, sources } = data;
  const fcMode = meta?.mode !== "real" ? meta?.mode : null;
  const t1live = liveData?.team1 || {}, t2live = liveData?.team2 || {};
  const t1 = { name: meta?.team1, ...internalData?.team1 };
  const t2 = { name: meta?.team2, ...internalData?.team2 };
  const conf = prediction?.confidence || 0;
  const cC = conf >= 70 ? "#22c55e" : conf >= 50 ? "#f59e0b" : "#ef4444";

  const cmpBars = [
    ["Buts/m", t1.avgGoalsScored, t2.avgGoalsScored, ""],
    ["Enc/m", t1.avgGoalsConceded, t2.avgGoalsConceded, ""],
    ["Corners/m", t1.avgCorners, t2.avgCorners, ""],
    ["Tirs/m", t1.avgShotsOnTarget, t2.avgShotsOnTarget, ""],
    ["Possession", t1.avgPossession, t2.avgPossession, "%"],
    ["xG/m", t1.xGPerMatch, t2.xGPerMatch, ""],
  ].filter(([, v1, v2]) => v1 != null && v2 != null);

  return (
    <div style={{ opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(10px)", transition: "all .4s ease", display: "flex", flexDirection: "column", gap: 11 }}>

      {/* MATCH HEADER */}
      <div style={{ background: "linear-gradient(160deg,#0c1820,#0f1c28)", border: "1px solid #1a2a38", borderRadius: 13, padding: "15px 18px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 380, height: 180, background: "radial-gradient(ellipse,rgba(0,212,170,0.04) 0%,transparent 70%)", pointerEvents: "none" }} />

        {/* Meta */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 13, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9.5, color: "#00D4AA", letterSpacing: 2, fontFamily: "'DM Mono', monospace" }}>{(meta?.competition || "ANALYSE").toUpperCase()}</span>
          <span style={{ fontSize: 8.5, color: "#1e2a2a", fontFamily: "'DM Mono', monospace" }}>{meta?.season || ""}</span>
          {meta?.matchDate && <span style={{ fontSize: 8.5, color: "#2a3838", fontFamily: "'DM Mono', monospace" }}>{meta.matchDate}</span>}
          {fcMode && <span style={{ fontSize: 8.5, color: FC_MODES[fcMode]?.color, background: FC_MODES[fcMode]?.colorDim, padding: "1px 7px", borderRadius: 7, fontFamily: "'DM Mono', monospace" }}>🎮 {FC_MODES[fcMode]?.label}</span>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 5, alignItems: "center" }}>
            {meta?.analysisDate && (
              <span style={{ fontSize: 8.5, color: "#1e2828", fontFamily: "'DM Mono', monospace" }}>📅 {meta.analysisDate}</span>
            )}
            {meta?.webQueries?.length > 0 && (
              <span style={{ fontSize: 8.5, color: "#00D4AA", background: "rgba(0,212,170,0.07)", padding: "2px 8px", borderRadius: 9, display: "flex", alignItems: "center", gap: 3, fontFamily: "'DM Mono', monospace" }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#00D4AA", animation: "pulse 1.5s infinite", display: "inline-block" }} />
                {meta.webQueries.length} WEB
              </span>
            )}
          </div>
        </div>

        {/* Score */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "center" }}>
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#3B82F6", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 2, textTransform: "uppercase", lineHeight: 1.1 }}>{meta?.team1}</div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}><FormRow matches={t1live.last10} /></div>
          </div>
          <div style={{ background: "#080c10", border: "1px solid #1a2a38", borderRadius: 11, padding: "9px 20px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 40, fontWeight: 900, color: "#3B82F6", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{prediction?.score1 ?? "?"}</span>
            <span style={{ fontSize: 20, color: "#141414", lineHeight: 1 }}>–</span>
            <span style={{ fontSize: 40, fontWeight: 900, color: "#EF4444", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{prediction?.score2 ?? "?"}</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#EF4444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 2, textTransform: "uppercase", lineHeight: 1.1 }}>{meta?.team2}</div>
            <div style={{ marginTop: 4 }}><FormRow matches={t2live.last10} /></div>
          </div>
        </div>

        {/* Confidence + badges */}
        <div style={{ marginTop: 11, display: "flex", justifyContent: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9.5, color: cC, background: `${cC}13`, padding: "3px 13px", borderRadius: 9, fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>CONFIANCE {conf}%</span>
          {prediction?.btts && <span style={{ fontSize: 9.5, color: "#a855f7", background: "rgba(168,85,247,0.09)", padding: "3px 9px", borderRadius: 9, fontFamily: "'DM Mono', monospace" }}>BTTS ✓</span>}
          {prediction?.over25 && <span style={{ fontSize: 9.5, color: "#f59e0b", background: "rgba(245,158,11,0.09)", padding: "3px 9px", borderRadius: 9, fontFamily: "'DM Mono', monospace" }}>+2.5 ✓</span>}
        </div>
        {prediction?.keyReason && <div style={{ marginTop: 6, textAlign: "center", fontSize: 10, color: "#444", fontFamily: "'Crimson Pro', serif", fontStyle: "italic" }}>"{prediction.keyReason}"</div>}

        {prediction?.resultProbs && (
          <div style={{ marginTop: 11 }}>
            <ProbBar t1={prediction.resultProbs.team1Win} draw={prediction.resultProbs.draw} t2={prediction.resultProbs.team2Win} name1={meta?.team1} name2={meta?.team2} />
          </div>
        )}
      </div>

      {/* H2H */}
      {liveData?.h2h && <H2H h2h={liveData.h2h} name1={meta?.team1} name2={meta?.team2} />}

      {/* TEAM COLUMNS */}
      <div style={{ display: "flex", gap: 9 }}>
        <TeamCol live={t1live} internal={t1} side="left" />
        <TeamCol live={t2live} internal={t2} side="right" />
      </div>

      {/* COMPARISON BARS */}
      {cmpBars.length > 0 && (
        <div style={{ background: "#0b0e10", border: "1px solid #192022", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 9 }}>
            <span style={{ fontSize: 8, color: "#2a3838", letterSpacing: 1.5, fontFamily: "'DM Mono', monospace" }}>COMPARAISON</span>
            <LiveTag type="LOCAL" />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
            <span style={{ fontSize: 9.5, color: "#3B82F6", fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>{meta?.team1?.toUpperCase()}</span>
            <span style={{ fontSize: 9.5, color: "#EF4444", fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>{meta?.team2?.toUpperCase()}</span>
          </div>
          {cmpBars.map(([l, v1, v2, u], i) => <AnimBar key={l} label={l} val1={v1} val2={v2} unit={u} delay={i * 80} />)}
        </div>
      )}

      {/* KEY FACTORS */}
      {keyFactors?.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          {keyFactors.map((f, i) => (
            <div key={i} style={{ background: "#0b0e10", border: "1px solid #192022", borderRadius: 8, padding: "10px 11px", animation: `fadeSlide .4s ease ${i * 55}ms both` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                <span style={{ fontSize: 13 }}>{f.icon}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: "#bbb", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.8, flex: 1 }}>{f.label}</span>
                {f.tag && <LiveTag type={f.tag} />}
              </div>
              <p style={{ fontSize: 10, color: "#555", lineHeight: 1.5, fontFamily: "'Crimson Pro', serif" }}>{f.detail}</p>
            </div>
          ))}
        </div>
      )}

      {/* TACTICAL NOTE */}
      {tacticalNote && (
        <div style={{ padding: "12px 16px", background: "rgba(0,212,170,0.03)", border: "1px solid rgba(0,212,170,0.09)", borderRadius: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
            <span style={{ fontSize: 8, color: "#00D4AA", letterSpacing: 1.5, fontFamily: "'DM Mono', monospace" }}>NOTE TACTIQUE</span>
            <LiveTag type="LOCAL" />
          </div>
          <p style={{ fontSize: 11.5, color: "#c0c8c0", lineHeight: 1.7, fontFamily: "'Crimson Pro', serif" }}>{tacticalNote}</p>
        </div>
      )}

      {/* SOURCES */}
      {sources?.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {sources.map((s, i) => <span key={i} style={{ fontSize: 8.5, color: "#1e2020", background: "#0d1114", border: "1px solid #141414", borderRadius: 3, padding: "2px 5px", fontFamily: "'DM Mono', monospace" }}>🔗 {s}</span>)}
        </div>
      )}
    </div>
  );
}

// ── Pitch Visualizer ──────────────────────────────────────────
function Pitch({ mode }) {
  const m = FC_MODES[mode]; if (!m) return null;
  const W = mode === "FC25_5v5" ? 280 : mode === "FC24_4v4" ? 205 : 162;
  const H = mode === "FC25_5v5" ? 188 : mode === "FC24_4v4" ? 136 : 108;
  const cx = W / 2, cy = H / 2;
  const gW = mode === "FC25_5v5" ? 38 : 16, gD = mode === "FC25_5v5" ? 9 : 6;
  const pos = {
    FC25_5v5: [[.14,.5],[.25,.23],[.25,.77],[.38,.38],[.38,.62]],
    FC24_4v4: [[.19,.23],[.19,.77],[.32,.43],[.32,.57]],
    FC25_3v3: [[.19,.3],[.19,.7],[.35,.5]]
  };
  const pts = pos[mode] || [];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
      <svg width={W + 36} height={H + 46} style={{ overflow: "visible" }}>
        <defs><filter id="gfx"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g transform="translate(18,18)">
          <rect x={0} y={0} width={W} height={H} rx={5} fill="#0e1e0e" stroke={m.color} strokeWidth={1.7} filter="url(#gfx)" />
          <line x1={cx} y1={0} x2={cx} y2={H} stroke={m.color} strokeWidth={.7} strokeOpacity={.28} />
          <circle cx={cx} cy={cy} r={H * .15} fill="none" stroke={m.color} strokeWidth={.7} strokeOpacity={.28} />
          <circle cx={cx} cy={cy} r={3} fill={m.color} />
          {mode === "FC25_5v5" && <>
            <rect x={0} y={cy - H * .27} width={W * .2} height={H * .54} fill="none" stroke={m.color} strokeWidth={.7} strokeOpacity={.28} />
            <rect x={W - W * .2} y={cy - H * .27} width={W * .2} height={H * .54} fill="none" stroke={m.color} strokeWidth={.7} strokeOpacity={.28} />
            <line x1={W * .33} y1={0} x2={W * .33} y2={H} stroke="#FFD700" strokeWidth={.8} strokeDasharray="5,4" strokeOpacity={.48} />
            <line x1={W * .67} y1={0} x2={W * .67} y2={H} stroke="#FFD700" strokeWidth={.8} strokeDasharray="5,4" strokeOpacity={.48} />
            <text x={W * .165} y={H + 13} textAnchor="middle" fontSize={7} fill="#FFD700" fontFamily="monospace">hors-jeu →</text>
            <text x={W * .835} y={H + 13} textAnchor="middle" fontSize={7} fill="#FFD700" fontFamily="monospace">← hors-jeu</text>
          </>}
          <rect x={-gD} y={cy - gW / 2} width={gD} height={gW} fill="none" stroke="#ccc" strokeWidth={mode === "FC25_5v5" ? 2 : 1.3} />
          <rect x={W} y={cy - gW / 2} width={gD} height={gW} fill="none" stroke="#ccc" strokeWidth={mode === "FC25_5v5" ? 2 : 1.3} />
          {mode === "FC25_5v5" && <>
            <circle cx={12} cy={cy} r={6.5} fill="#FFD700" stroke="#000" strokeWidth={.7} />
            <text x={12} y={cy + 3.5} textAnchor="middle" fontSize={5} fill="#000" fontWeight="bold">GK</text>
            <circle cx={W - 12} cy={cy} r={6.5} fill="#FFD700" stroke="#000" strokeWidth={.7} />
            <text x={W - 12} y={cy + 3.5} textAnchor="middle" fontSize={5} fill="#000" fontWeight="bold">GK</text>
          </>}
          {pts.map((p, i) => <circle key={`b${i}`} cx={p[0] * W} cy={p[1] * H} r={5} fill="#3B82F6" stroke="#fff" strokeWidth={1} />)}
          {pts.map((p, i) => <circle key={`r${i}`} cx={(1 - p[0]) * W} cy={p[1] * H} r={5} fill="#EF4444" stroke="#fff" strokeWidth={1} />)}
          <text x={cx} y={H + 28} textAnchor="middle" fontSize={8} fill="#2a3838" fontFamily="monospace">{m.fieldSize}</text>
        </g>
      </svg>
      <div style={{ fontSize: 9, color: m.color, letterSpacing: 2, fontFamily: "'DM Mono', monospace" }}>{m.label.toUpperCase()}</div>
      <div style={{ fontSize: 9, color: "#2a3838", textAlign: "center", maxWidth: 260, lineHeight: 1.4 }}>{m.notes}</div>
    </div>
  );
}

// ── History Chart ─────────────────────────────────────────────
function HistChart({ history, color }) {
  if (!history?.length) return <div style={{ textAlign: "center", padding: 18, color: "#1e1e1e", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>Aucune analyse enregistrée</div>;
  const W = 360, H = 120, pL = 26, pB = 24, pT = 8, gW = W - pL - 8, gH = H - pT - pB;
  const maxV = Math.max(...history.map(h => Math.max(h.s1 || 0, h.s2 || 0)), 5);
  const step = history.length > 1 ? gW / (history.length - 1) : gW;
  const pt1 = history.map((h, i) => ({ x: pL + i * step, y: pT + gH - ((h.s1 || 0) / maxV) * gH }));
  const pt2 = history.map((h, i) => ({ x: pL + i * step, y: pT + gH - ((h.s2 || 0) / maxV) * gH }));
  return (
    <div>
      <svg width={W} height={H} style={{ overflow: "visible" }}>
        {[0,1,2,3,4].map(i => <line key={i} x1={pL} y1={pT+(i/4)*gH} x2={W-8} y2={pT+(i/4)*gH} stroke="#0d0d0d" strokeWidth={1}/>)}
        <line x1={pL} y1={pT} x2={pL} y2={pT+gH} stroke="#161616"/>
        <line x1={pL} y1={pT+gH} x2={W-8} y2={pT+gH} stroke="#161616"/>
        {history.length > 1 && <>
          <polyline points={pt1.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke="#3B82F6" strokeWidth={2.2} strokeLinejoin="round"/>
          <polyline points={pt2.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke="#EF4444" strokeWidth={2.2} strokeLinejoin="round"/>
        </>}
        {pt1.map((p,i) => <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="#3B82F6"/>
          <circle cx={pt2[i].x} cy={pt2[i].y} r={4} fill="#EF4444"/>
          <text x={p.x} y={pT+gH+14} textAnchor="middle" fontSize={7.5} fill="#252525" fontFamily="monospace">M{i+1}</text>
        </g>)}
        {[0,Math.round(maxV/2),maxV].map((v,i) => <text key={i} x={pL-4} y={pT+gH-(v/maxV)*gH+3} textAnchor="end" fontSize={7.5} fill="#252525" fontFamily="monospace">{v}</text>)}
      </svg>
      <div style={{ marginTop: 7, display: "flex", flexDirection: "column", gap: 3.5 }}>
        {history.map((h, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", background: "#0d1114", borderRadius: 5, fontSize: 10, fontFamily: "'DM Mono', monospace" }}>
            <span style={{ color: "#1e1e1e" }}>M{i+1}</span>
            <span style={{ color: "#444" }}>{h.t1} <span style={{ color: "#1a1a1a" }}>vs</span> {h.t2}</span>
            <span style={{ fontWeight: 700, color: h.s1 > h.s2 ? "#3B82F6" : h.s2 > h.s1 ? "#EF4444" : "#f59e0b" }}>{h.s1}–{h.s2}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────
function Typing() {
  const steps = ["🔍 Recherche forme récente (10 matchs)…", "🚑 Vérification blessés & suspendus…", "🤝 Récupération confrontations directes…", "📊 Analyse tactique & prédiction…"];
  const [step, setStep] = useState(0);
  useEffect(() => { const t = setInterval(() => setStep(s => (s + 1) % steps.length), 1700); return () => clearInterval(t); }, []);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#00D4AA,#0055CC)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>⚽</div>
      <div style={{ padding: "8px 12px", background: "rgba(0,212,170,0.04)", border: "1px solid rgba(0,212,170,0.1)", borderRadius: "4px 11px 11px 11px" }}>
        <span style={{ fontSize: 9.5, color: "#00D4AA", fontFamily: "'DM Mono', monospace", transition: "all .3s" }}>{steps[step]}</span>
      </div>
    </div>
  );
}

// ── Clock ─────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const ctx = getLiveContext();
  const hh = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  const ss = now.getSeconds().toString().padStart(2, "0");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <span style={{ fontSize: 9.5, color: "#00D4AA", fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>{ctx.dateFR.split(" ").slice(1).join(" ")}</span>
      <span style={{ fontSize: 8.5, color: "#1e2828", fontFamily: "'DM Mono', monospace" }}>{hh}:{mm}:{ss} · {ctx.footballSeason}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState("chat");
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [agent, setAgent] = useState("arnold");
  const [fcMode, setFcMode] = useState("FC25_5v5");
  const [fcT1, setFcT1] = useState("");
  const [fcT2, setFcT2] = useState("");
  const [fcS1, setFcS1] = useState("");
  const [fcS2, setFcS2] = useState("");
  const [fcHist, setFcHist] = useState({ FC24_4v4: [], FC25_5v5: [], FC25_3v3: [] });
  const [adminPrompts, setAdminPrompts] = useState([]);
  const [pName, setPName] = useState("");
  const [pContent, setPContent] = useState("");
  const [apiKey, setApiKey] = useState(localStorage.getItem("arnold_api_key") || "");
  const [showApiInput, setShowApiInput] = useState(!apiKey);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  useEffect(() => {
    const ctx = getLiveContext();
    // Use timeout to avoid synchronous setState within effect
    const t = setTimeout(() => setMsgs([{ role: "intro", parsed: { type: "chat", message: `Bonjour ! Je suis ARNOLD ⚽\n\n📅 Nous sommes le ${ctx.dateFR} — Saison ${ctx.footballSeason}\n\nMon contexte temporel est injecté à chaque requête. Je suis toujours à jour, peu importe quand tu me consultes.\n\nWeb search ciblé sur :\n🔄 Forme récente (10 derniers matchs)\n🚑 Blessés & suspendus actuels\n🤝 Confrontations directes (H2H)\n🔁 Transferts & absences récents\n\nStats générales, tactique et prédiction : modèle interne.\n\nQuel match analyser ?` } }]), 0);
    return () => clearTimeout(t);
  }, []);

  const getHistory = () => msgs.filter(m => m.role === "user" || m.role === "assistant").filter(m => m.content).map(m => ({ role: m.role, content: m.content }));

  const send = useCallback(async (override) => {
    const text = override || input.trim();
    if (!text || loading) return;
    if (!apiKey.trim()) {
      setShowApiInput(true);
      return;
    }
    setInput("");
    setMsgs(prev => [...prev, { role: "user", content: text, parsed: { type: "chat", message: text } }, { role: "typing" }]);
    setLoading(true);
    try {
      const system = buildSystem(adminPrompts, agent);
      const hist = [...getHistory(), { role: "user", content: text }];
      const raw = await callArnold(hist, system);
      const parsed = parseJSON(raw);
      if (tab === "fc" && fcT1 && fcT2 && parsed?.prediction) {
        setFcHist(prev => ({ ...prev, [fcMode]: [...prev[fcMode], { t1: fcT1, t2: fcT2, s1: parsed.prediction.score1 ?? 0, s2: parsed.prediction.score2 ?? 0 }] }));
      }
      setMsgs(prev => [...prev.filter(m => m.role !== "typing"), { role: "assistant", content: raw, parsed }]);
    } catch (err) {
      const errorMsg = err.message || "Erreur inconnue lors de l'appel à l'IA";
      setMsgs(prev => [...prev.filter(m => m.role !== "typing"), { role: "assistant", content: "", parsed: { type: "chat", message: `⚠️ ${errorMsg}` } }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, adminPrompts, agent, tab, fcT1, fcT2, fcMode, apiKey, getHistory]);

  const saveApiKey = (key) => {
    localStorage.setItem("arnold_api_key", key);
    setApiKey(key);
    setShowApiInput(false);
  };

  const launchFC = () => {
    if (!fcT1 || !fcT2) return;
    const m = FC_MODES[fcMode];
    const ctx = getLiveContext();
    const p = `Analyse ce match ${m.label} — ${ctx.dateFR} :
Équipe 1 : ${fcT1} | Équipe 2 : ${fcT2}
${fcS1 && fcS2 ? `Score : ${fcS1}–${fcS2}` : "Simulation à venir"}
Mode : ${fcMode} | ${m.notes} | Style : ${m.style}
Terrain : ${m.fieldSize} | Gardien : ${m.goalkeeper ? "Oui IA" : "Non"} | Corners : ${m.corners ? "Oui" : "Non"}
⚠️ Pas de web search sur la forme FC (jeu vidéo). meta.mode = "${fcMode}". JSON strict.`;
    setTab("chat");
    setTimeout(() => send(p), 80);
  };

  const C = { bg: "#070B0D", surf: "#0d1114", bdr: "#192022", acc: "#00D4AA", t: "#C8D4D0", muted: "#2a3838" };
  const tS = id => ({ padding: "8px 14px", border: "none", cursor: "pointer", borderRadius: "5px 5px 0 0", fontSize: 9.5, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'DM Mono', monospace", background: tab === id ? C.surf : "transparent", color: tab === id ? C.acc : C.muted, borderBottom: tab === id ? `2px solid ${C.acc}` : "2px solid transparent", transition: "all .2s" });
  const agC = { arnold: "#00D4AA", tnt: "#FF6B35", duvane: "#A855F7" };
  const agI = { arnold: "⚽", tnt: "🧠", duvane: "📡" };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.t, fontFamily: "'Barlow Condensed', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;600;700;800;900&family=DM+Mono:ital,wght@0,300;0,400;0,500&family=Crimson+Pro:ital,wght@0,400;1,300;1,400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#070B0D}::-webkit-scrollbar-thumb{background:#192022;border-radius:2px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.15}}
        @keyframes fadeSlide{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
        textarea:focus,input:focus{outline:none} button:active{transform:scale(.97)}
      `}</style>

      {/* API Key Modal */}
      {showApiInput && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: C.surf, border: `1px solid ${C.bdr}`, borderRadius: 13, padding: 24, maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 12, color: C.acc }}>🔐 Clé API Anthropic</h2>
            <p style={{ fontSize: 11, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>Entrez votre clé API Anthropic pour utiliser ARNOLD. Votre clé sera stockée localement dans le navigateur (localStorage) et ne sera jamais envoyée à un serveur tiers.</p>
            <input 
              type="password" 
              placeholder="sk-ant-..." 
              defaultValue={apiKey}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  saveApiKey(e.target.value);
                }
              }}
              style={{ width: "100%", padding: "10px 12px", background: "#090c0e", border: `1px solid ${C.bdr}`, borderRadius: 7, color: C.t, fontSize: 12, fontFamily: "'DM Mono', monospace", marginBottom: 12 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button 
                onClick={(e) => {
                  const input = e.target.parentElement.querySelector("input");
                  saveApiKey(input.value);
                }}
                style={{ flex: 1, padding: "10px", background: "linear-gradient(135deg,#00D4AA,#0077FF)", border: "none", borderRadius: 7, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}
              >
                ✓ CONFIRMER
              </button>
              <button 
                onClick={() => setShowApiInput(false)}
                style={{ flex: 1, padding: "10px", background: "transparent", border: `1px solid ${C.bdr}`, borderRadius: 7, color: C.muted, fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}
              >
                ✕ ANNULER
              </button>
            </div>
            <p style={{ fontSize: 9, color: "#666", marginTop: 12, textAlign: "center" }}>Vous pouvez obtenir une clé sur <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{ color: C.acc, textDecoration: "none" }}>console.anthropic.com</a></p>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ height: 52, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.bdr}`, background: "rgba(7,11,13,.98)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 27, height: 27, borderRadius: 6, background: "linear-gradient(135deg,#00D4AA,#0050CC)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚽</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 5, background: "linear-gradient(90deg,#00D4AA,#0088FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ARNOLD</div>
            <div style={{ fontSize: 7, color: C.muted, letterSpacing: 3, marginTop: -2 }}>FOOTBALL INTELLIGENCE AI</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {["arnold","tnt","duvane"].map(a => (
            <button key={a} onClick={() => setAgent(a)} style={{ padding: "4px 10px", borderRadius: 13, border: `1px solid ${agent===a ? agC[a] : C.bdr}`, background: agent===a ? `${agC[a]}12` : "transparent", color: agent===a ? agC[a] : C.muted, fontSize: 9, cursor: "pointer", fontFamily: "'DM Mono', monospace", letterSpacing: 1, display: "flex", alignItems: "center", gap: 4, transition: "all .2s" }}>
              {agI[a]} {a.toUpperCase()}{agent===a && <span style={{ width: 4, height: 4, borderRadius: "50%", background: agC[a], animation: "pulse 1.2s infinite" }} />}
            </button>
          ))}
          <button onClick={() => setShowApiInput(true)} style={{ padding: "4px 10px", borderRadius: 13, border: `1px solid ${C.bdr}`, background: "transparent", color: C.muted, fontSize: 9, cursor: "pointer", fontFamily: "'DM Mono', monospace", letterSpacing: 1, display: "flex", alignItems: "center", gap: 4 }}>
            🔐 CLÉ
          </button>
        </div>
        <LiveClock />
      </header>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.bdr}`, padding: "0 16px", gap: 2 }}>
        {[["chat","💬 Analyse"],["fc","🎮 Modes FC"],["history","📈 Historique"],["admin","⚙️ Admin"]].map(([id,l]) => (
          <button key={id} onClick={() => setTab(id)} style={tS(id)}>{l}</button>
        ))}
      </div>

      {/* CHAT */}
      {tab === "chat" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "7px 16px", borderBottom: `1px solid ${C.bdr}`, display: "flex", gap: 5, flexWrap: "wrap" }}>
            {[
              ["🏆 UCL", "Analyse un match de Champions League de cette semaine. Recherche la forme récente des deux équipes (10 derniers matchs), les blessés actuels, les suspensions et le H2H. Stats et tactique en interne."],
              ["🇫🇷 Ligue 1", "Analyse un match important Ligue 1 cette semaine. Web search : forme 10 matchs, blessés, H2H. Modèle prédictif en local."],
              ["🇬🇧 Premier League", "Analyse un match clé Premier League en ce moment. Données web : forme récente, absences, H2H. Tactique et compatibilité en local."],
              ["🇪🇸 La Liga", "Analyse un match La Liga de la journée. Web : forme, blessés, transferts récents. Local : stats, prédiction, tactique."],
              ["🎮 FC25 5v5", "Analyse FC25 5v5 Rush : PSG vs Real Madrid. Pas de web search sur la forme (jeu vidéo). meta.mode='FC25_5v5'."],
            ].map(([l, m]) => (
              <button key={l} onClick={() => send(m)} style={{ padding: "3.5px 10px", borderRadius: 11, border: `1px solid ${C.bdr}`, background: "transparent", color: "#444", fontSize: 9.5, cursor: "pointer", fontFamily: "'DM Mono', monospace", transition: "all .2s", whiteSpace: "nowrap" }}>{l}</button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {msgs.map((msg, i) => {
              if (msg.role === "typing") return <Typing key={i} />;
              if (msg.role === "user") return (
                <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ maxWidth: "58%", padding: "8px 12px", background: "rgba(255,107,53,0.06)", border: "1px solid rgba(255,107,53,0.12)", borderRadius: "11px 3px 11px 11px", fontSize: 12.5, color: "#b0b8b0", lineHeight: 1.65, fontFamily: "'Crimson Pro', serif" }}>{msg.content}</div>
                </div>
              );
              if (msg.role === "intro" || msg.role === "assistant") return (
                <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#00D4AA,#0050CC)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>⚽</div>
                  <div style={{ flex: 1, minWidth: 0 }}>{msg.parsed && <AnalysisCard data={msg.parsed} />}</div>
                </div>
              );
              return null;
            })}
            <div ref={endRef} />
          </div>

          <div style={{ padding: "11px 16px", borderTop: `1px solid ${C.bdr}`, background: C.surf }}>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", background: "#090c0e", border: `1px solid ${loading ? C.acc : C.bdr}`, borderRadius: 10, padding: "7px 10px", transition: "border-color .25s" }}>
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Quel match analyser ? (Entrée pour envoyer)" rows={1} style={{ flex: 1, background: "transparent", border: "none", color: C.t, fontSize: 12.5, fontFamily: "'Crimson Pro', serif", resize: "none", maxHeight: 90, lineHeight: 1.5 }} />
              <button onClick={() => send()} disabled={loading || !input.trim()} style={{ width: 29, height: 29, borderRadius: 6, border: "none", background: loading || !input.trim() ? "#141414" : "linear-gradient(135deg,#00D4AA,#0077FF)", color: "#fff", fontSize: 13, cursor: loading || !input.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{loading ? "⏳" : "↑"}</button>
            </div>
            <div style={{ fontSize: 8, color: "#141e1e", marginTop: 3.5, textAlign: "center", fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>
              {agent.toUpperCase()} · Date injectée automatiquement · Web Search ciblé · Entrée pour envoyer
            </div>
          </div>
        </div>
      )}

      {/* FC MODES */}
      {tab === "fc" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: 5, marginBottom: 3, background: "linear-gradient(90deg,#00D4AA,#A855F7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>MODES FC</h2>
            <p style={{ color: C.muted, fontSize: 9, letterSpacing: 2, marginBottom: 16 }}>FC24 / FC25 · Règles spécifiques · Styles FC ≠ réalité</p>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {Object.entries(FC_MODES).map(([k, m]) => (
                <button key={k} onClick={() => setFcMode(k)} style={{ padding: "6px 13px", borderRadius: 6, border: `2px solid ${fcMode===k ? m.color : C.bdr}`, background: fcMode===k ? m.colorDim : "transparent", color: fcMode===k ? m.color : "#3a3a3a", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1, fontWeight: fcMode===k ? 700 : 400, transition: "all .2s" }}>{m.label}</button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginBottom: 11 }}>
              <div style={{ background: C.surf, border: `1px solid ${C.bdr}`, borderRadius: 9, padding: 14 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: FC_MODES[fcMode].color, letterSpacing: 2, marginBottom: 11 }}>📋 RÈGLES</div>
                {[["Jeu",FC_MODES[fcMode].game],["Format",`${FC_MODES[fcMode].players}v${FC_MODES[fcMode].players}`],["Gardien",FC_MODES[fcMode].goalkeeper?"✅ IA":"❌"],["Corners",FC_MODES[fcMode].corners?"✅":"❌"],["Penaltys",FC_MODES[fcMode].penalties?"✅":"❌"],["Cages",FC_MODES[fcMode].goalSize],["Terrain",FC_MODES[fcMode].fieldSize],["Hors-jeu",typeof FC_MODES[fcMode].offside==="string"?FC_MODES[fcMode].offside:FC_MODES[fcMode].offside?"Oui":"❌"],["Cartons",FC_MODES[fcMode].cards],["Temps supp.",FC_MODES[fcMode].extraTime]].map(([k,v])=>(
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"4.5px 0", borderBottom:`1px solid ${C.bdr}`, fontSize:10 }}>
                    <span style={{ color:C.muted }}>{k}</span>
                    <span style={{ color:C.t, textAlign:"right", maxWidth:"57%" }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ background:C.surf, border:`1px solid ${C.bdr}`, borderRadius:9, padding:14, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Pitch mode={fcMode}/>
              </div>
            </div>
            <div style={{ background:C.surf, border:`1px solid ${FC_MODES[fcMode].color}38`, borderRadius:9, padding:14 }}>
              <div style={{ fontSize:9.5, fontWeight:700, color:FC_MODES[fcMode].color, letterSpacing:2, marginBottom:10 }}>⚡ ANALYSE</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:8, alignItems:"center", marginBottom:9 }}>
                <input value={fcT1} onChange={e=>setFcT1(e.target.value)} placeholder="Équipe 1" style={{ padding:"7px 9px", background:"#090c0e", border:`1px solid ${C.bdr}`, borderRadius:5, color:C.t, fontSize:11.5, fontFamily:"'Barlow Condensed', sans-serif", letterSpacing:1 }}/>
                <div style={{ fontSize:14, color:C.muted, fontWeight:900, textAlign:"center" }}>VS</div>
                <input value={fcT2} onChange={e=>setFcT2(e.target.value)} placeholder="Équipe 2" style={{ padding:"7px 9px", background:"#090c0e", border:`1px solid ${C.bdr}`, borderRadius:5, color:C.t, fontSize:11.5, fontFamily:"'Barlow Condensed', sans-serif", letterSpacing:1 }}/>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
                <span style={{ fontSize:9, color:C.muted }}>SCORE :</span>
                <input value={fcS1} onChange={e=>setFcS1(e.target.value)} placeholder="0" type="number" style={{ width:46, padding:"4px 0", textAlign:"center", background:"#090c0e", border:`1px solid ${C.bdr}`, borderRadius:4, color:"#3B82F6", fontSize:15, fontWeight:900, fontFamily:"'DM Mono', monospace" }}/>
                <span style={{ color:C.muted, fontSize:12 }}>–</span>
                <input value={fcS2} onChange={e=>setFcS2(e.target.value)} placeholder="0" type="number" style={{ width:46, padding:"4px 0", textAlign:"center", background:"#090c0e", border:`1px solid ${C.bdr}`, borderRadius:4, color:"#EF4444", fontSize:15, fontWeight:900, fontFamily:"'DM Mono', monospace" }}/>
                <button onClick={launchFC} disabled={loading || !fcT1 || !fcT2} style={{ flex:1, padding:"10px", borderRadius:5, border:"none", background:loading||!fcT1||!fcT2?"#141414":"linear-gradient(135deg,#00D4AA,#0077FF)", color:"#fff", fontSize:10, fontWeight:800, letterSpacing:2, cursor:loading||!fcT1||!fcT2?"not-allowed":"pointer", fontFamily:"'DM Mono', monospace" }}>LANCER LA PRÉDICTION</button>
              </div>
            </div>
            <div style={{ marginTop:9, padding:"8px 11px", background:"rgba(255,107,53,0.04)", border:"1px solid rgba(255,107,53,0.11)", borderRadius:6, fontSize:10, color:"#444", lineHeight:1.6, fontFamily:"'Crimson Pro', serif", fontStyle:"italic" }}>
              ⚠️ Dans les modes FC, les équipes n'ont pas forcément le même style qu'en réalité. Pas de web search sur la forme FC (données jeu vidéo non disponibles en ligne).
            </div>
          </div>
        </div>
      )}

      {/* HISTORY */}
      {tab === "history" && (
        <div style={{ flex:1, overflowY:"auto", padding:18 }}>
          <div style={{ maxWidth:740, margin:"0 auto" }}>
            <h2 style={{ fontSize:22, fontWeight:900, letterSpacing:5, marginBottom:3, background:"linear-gradient(90deg,#A855F7,#FF6B35)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>HISTORIQUE FC</h2>
            <p style={{ color:C.muted, fontSize:9, letterSpacing:2, marginBottom:16 }}>Évolution par mode</p>
            {Object.entries(FC_MODES).map(([k,m]) => (
              <div key={k} style={{ background:C.surf, border:`1px solid ${C.bdr}`, borderRadius:9, padding:14, marginBottom:11 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:11 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:m.color }}/>
                  <span style={{ fontSize:11, fontWeight:700, color:m.color, letterSpacing:2 }}>{m.label}</span>
                  <span style={{ marginLeft:"auto", fontSize:9, color:C.muted, background:`${m.color}12`, padding:"1px 8px", borderRadius:8, fontFamily:"'DM Mono', monospace" }}>{fcHist[k]?.length||0} analyses</span>
                </div>
                <HistChart history={fcHist[k]||[]} color={m.color}/>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADMIN */}
      {tab === "admin" && (
        <div style={{ flex:1, overflowY:"auto", padding:18 }}>
          <div style={{ maxWidth:680, margin:"0 auto" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
              <div style={{ width:38, height:38, borderRadius:8, background:"linear-gradient(135deg,#A855F7,#FF6B35)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>👑</div>
              <div>
                <h2 style={{ fontSize:19, fontWeight:900, letterSpacing:5, background:"linear-gradient(90deg,#A855F7,#FF6B35)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>DASHBOARD DUVAN</h2>
                <p style={{ fontSize:8, color:C.muted, letterSpacing:3 }}>INTERFACE ADMIN · ÉVOLUTION D'ARNOLD</p>
              </div>
            </div>

            {(() => { const ctx = getLiveContext(); return (
              <div style={{ background:"rgba(0,212,170,0.04)", border:"1px solid rgba(0,212,170,0.1)", borderRadius:9, padding:"11px 14px", marginBottom:14 }}>
                <div style={{ fontSize:8.5, color:"#00D4AA", letterSpacing:2, marginBottom:8, fontFamily:"'DM Mono', monospace" }}>📅 CONTEXTE TEMPOREL INJECTÉ</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  {[["Date","📅",ctx.dateFR],["Saison","🏆",ctx.footballSeason],["Phase UCL","🎯",ctx.uclPhase],["Timestamp","⏱️",ctx.timestamp.slice(0,19).replace("T"," ")]].map(([l,i,v])=>(
                    <div key={l} style={{ display:"flex", gap:5, alignItems:"center" }}>
                      <span style={{ fontSize:10 }}>{i}</span>
                      <div>
                        <div style={{ fontSize:7.5, color:C.muted, fontFamily:"'DM Mono', monospace" }}>{l}</div>
                        <div style={{ fontSize:9, color:"#00D4AA", fontFamily:"'DM Mono', monospace" }}>{v}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ); })()}

            <div style={{ background:C.surf, border:`1px solid ${C.bdr}`, borderRadius:9, padding:"11px 14px", marginBottom:14 }}>
              <div style={{ fontSize:8.5, color:C.muted, letterSpacing:2, marginBottom:9, fontFamily:"'DM Mono', monospace" }}>⚙️ LOGIQUE WEB SEARCH</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
                <div>
                  <div style={{ fontSize:8.5, color:"#22c55e", marginBottom:5, fontFamily:"'DM Mono', monospace" }}>✅ WEB SEARCH</div>
                  {["🔄 Forme récente (10 matchs)","🚑 Blessés & suspendus","🤝 H2H confrontations directes","🔁 Transferts / absences"].map(s=><div key={s} style={{ fontSize:9.5, color:"#444", marginBottom:2 }}>{s}</div>)}
                </div>
                <div>
                  <div style={{ fontSize:8.5, color:"#ef4444", marginBottom:5, fontFamily:"'DM Mono', monospace" }}>❌ LOCAL UNIQUEMENT</div>
                  {["📊 Stats générales saison","🧠 Modèles de prédiction","📚 Historique long terme","⚽ Logique tactique"].map(s=><div key={s} style={{ fontSize:9.5, color:"#444", marginBottom:2 }}>{s}</div>)}
                </div>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:9, marginBottom:14 }}>
              {[["Messages","💬",msgs.filter(m=>m.role==="user").length,"#00D4AA"],["Programmes","⚡",adminPrompts.length,"#A855F7"],["Analyses FC","🎮",Object.values(fcHist).flat().length,"#FF6B35"]].map(([l,ic,v,c])=>(
                <div key={l} style={{ background:C.surf, border:`1px solid ${C.bdr}`, borderRadius:8, padding:"11px 13px", textAlign:"center" }}>
                  <div style={{ fontSize:17, marginBottom:3 }}>{ic}</div>
                  <div style={{ fontSize:24, fontWeight:900, color:c, fontFamily:"'DM Mono', monospace" }}>{v}</div>
                  <div style={{ fontSize:8, color:C.muted, letterSpacing:1 }}>{l}</div>
                </div>
              ))}
            </div>

            <div style={{ background:C.surf, border:`1px solid ${C.bdr}`, borderRadius:9, padding:14, marginBottom:12 }}>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:2, color:"#A855F7", marginBottom:9 }}>🤖 AGENTS</div>
              {[["ARNOLD","Analyse football + modes FC + web search ciblé + date injectée","#00D4AA"],["TNT","Stats avancées xG/PPDA · enrichissement continu connaissances","#FF6B35"],["DUVANE","Collecte · optimisation · historiques · programmes Duvan","#A855F7"]].map(([n,r,c])=>(
                <div key={n} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderBottom:`1px solid ${C.bdr}` }}>
                  <div style={{ width:5, height:5, borderRadius:"50%", background:c, animation:"pulse 2s infinite" }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:9.5, fontWeight:700, color:c, letterSpacing:1 }}>{n}</div>
                    <div style={{ fontSize:9, color:C.muted }}>{r}</div>
                  </div>
                  <div style={{ fontSize:8, color:c, background:`${c}12`, padding:"1px 7px", borderRadius:7, fontFamily:"'DM Mono', monospace" }}>ACTIF</div>
                </div>
              ))}
            </div>

            <div style={{ background:C.surf, border:"1px solid rgba(168,85,247,.22)", borderRadius:9, padding:14, marginBottom:11 }}>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:2, color:"#A855F7", marginBottom:8 }}>➕ NOUVEAU PROGRAMME</div>
              <p style={{ fontSize:10, color:"#3a3a3a", lineHeight:1.5, marginBottom:9, fontFamily:"'Crimson Pro', serif" }}>Intégré immédiatement dans Arnold. Actif pour toutes les analyses suivantes, avec la date actuelle injectée.</p>
              <input value={pName} onChange={e=>setPName(e.target.value)} placeholder="Nom du programme" style={{ width:"100%", padding:"7px 9px", background:"#090c0e", border:`1px solid ${C.bdr}`, borderRadius:5, color:C.t, fontSize:9.5, fontFamily:"'DM Mono', monospace", letterSpacing:1, marginBottom:6 }}/>
              <textarea value={pContent} onChange={e=>setPContent(e.target.value)} placeholder="Ex : Pour chaque match Serie A, inclure le PPDA et les duels aériens." rows={4} style={{ width:"100%", padding:"7px 9px", background:"#090c0e", border:`1px solid ${C.bdr}`, borderRadius:5, color:C.t, fontSize:9.5, fontFamily:"'Crimson Pro', serif", lineHeight:1.5, resize:"vertical", marginBottom:6 }}/>
              <button onClick={()=>{ if(!pName||!pContent) return; const n=pName; setAdminPrompts(p=>[...p,{id:Date.now(),name:pName,content:pContent,date:new Date().toLocaleDateString("fr-FR")}]); setPName(""); setPContent(""); setMsgs(p=>[...p,{role:"intro",parsed:{type:"chat",message:`✅ Programme "${n}" intégré par DUVANE.`}}]); }} disabled={!pName||!pContent} style={{ width:"100%", padding:"8px", borderRadius:5, border:"none", background:pName&&pContent?"linear-gradient(135deg,#A855F7,#FF6B35)":"#0d0d0d", color:pName&&pContent?"#fff":"#1e1e1e", fontSize:9.5, fontWeight:800, letterSpacing:3, cursor:pName&&pContent?"pointer":"not-allowed", fontFamily:"'DM Mono', monospace" }}>⚡ INTÉGRER VIA DUVANE</button>
            </div>

            {adminPrompts.length > 0 && (
              <div style={{ background:C.surf, border:`1px solid ${C.bdr}`, borderRadius:9, padding:14 }}>
                <div style={{ fontSize:9, fontWeight:700, letterSpacing:2, color:"#A855F7", marginBottom:9 }}>📦 PROGRAMMES ACTIFS ({adminPrompts.length})</div>
                {adminPrompts.map(p=>(
                  <div key={p.id} style={{ padding:"8px 10px", background:"rgba(168,85,247,.04)", border:"1px solid rgba(168,85,247,.1)", borderRadius:6, marginBottom:6 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                      <span style={{ fontSize:9.5, fontWeight:700, color:"#A855F7" }}>{p.name}</span>
                      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                        <span style={{ fontSize:8, color:"#1e1e1e", fontFamily:"'DM Mono', monospace" }}>{p.date}</span>
                        <button onClick={()=>setAdminPrompts(pr=>pr.filter(x=>x.id!==p.id))} style={{ padding:"1px 6px", background:"transparent", border:"1px solid #1a1a1a", borderRadius:3, color:"#2a2a2a", fontSize:8.5, cursor:"pointer" }}>✕</button>
                      </div>
                    </div>
                    <p style={{ fontSize:9, color:"#3a3a3a", lineHeight:1.4, fontFamily:"'Crimson Pro', serif" }}>{p.content.substring(0,130)}…</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}