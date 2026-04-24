import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// ARNOLD FOOTBALL AI v6 — COMPOSITIONS + FAVORIS + CHARGEMENT
// ============================================================

const API = "https://api.anthropic.com/v1/messages";

// ── FC Modes — moyennes réelles confirmées ────────────────────
const FC_MODES = {
  FC24_4v4: {
    label: "FC24 · 4v4 Rush", game: "EA FC 24", players: 4,
    goalkeeper: false, corners: false, penalties: false,
    goalSize: "Petites cages Volta", fieldSize: "~35 × 25 m",
    offside: false, blueCard: false,
    cards: "Jaunes/rouges standard", extraTime: "—",
    style: "Arcade / street / skill moves / créativité individuelle",
    notes: "Pas de gardien · Pas de corners · Pas de penaltys · Style Volta freestyle",
    color: "#FF6B35", colorDim: "rgba(255,107,53,0.1)",
    // Moyennes terrain réelles (confirmées)
    avgTotalGoals: 12,
    // ATTENTION : c'est une MOYENNE. Une équipe peut marquer 2 comme 10.
    // Cas typique : ~5-7 par équipe | Cas poussé : 6-8 | Cas max : 8+
    // L'historique de l'équipe prime sur la moyenne générale
    scoringNotes: "Moyenne 12 buts/match TOTAL. Répartition variable : une équipe peut dominer 9-3 ou match serré 6-6. L'historique individuel de chaque équipe est le vrai indicateur.",
    typicalScores: ["6-6","7-5","6-4","8-4","5-7","5-4","8-5","4-6","7-3","9-4"],
    keyMetric: "buts",
    cornersPerMatch: 0,
  },
  FC25_5v5: {
    label: "FC25 · 5v5 Rush", game: "EA FC 25", players: 5,
    goalkeeper: true, corners: true, penalties: false,
    goalSize: "Cages 11v11 standard", fieldSize: "63.7 × 46.6 m",
    offside: "Dernier tiers uniquement", blueCard: false,
    cards: "Cartons standards", extraTime: "—",
    style: "Compétitif · passes latérales · pressing · collectif",
    notes: "Gardien IA · Course au ballon · CF indirects · Pas de penalty · Pas de carton bleu · Pas de prolongation",
    color: "#00D4AA", colorDim: "rgba(0,212,170,0.1)",
    avgTotalGoals: 5.5,
    // Gardien IA réduit fortement les buts vs modes sans GK
    // Scores typiques 2-3, 3-2, 4-3 — Rarement au-delà de 5 par équipe
    scoringNotes: "Moyenne ~5.5 buts/match TOTAL. Le gardien IA est décisif. Précision, corners et sang-froid comptent plus que la puissance brute. L'historique corners/buts de chaque équipe est essentiel.",
    typicalScores: ["3-2","2-3","4-3","3-1","2-2","4-2","3-3","2-1","3-4","4-1"],
    keyMetric: "buts+corners",
    cornersPerMatch: 4.5,
  },
  FC25_3v3: {
    label: "FC25 · 3v3 Rush", game: "EA FC 25", players: 3,
    goalkeeper: false, corners: false, penalties: false,
    goalSize: "Petites cages Volta", fieldSize: "~28 × 20 m",
    offside: false, blueCard: false,
    cards: "Cartons standards", extraTime: "—",
    style: "Ultra-rapide · individuel · skill moves · 1v1",
    notes: "Pas de gardien · Pas de corners · Plus arcade que le 4v4",
    color: "#A855F7", colorDim: "rgba(168,85,247,0.1)",
    avgTotalGoals: 15,
    // ATTENTION : c'est une MOYENNE. Répartition très variable.
    // Cas typique : ~6-7 par équipe | Cas poussé : 7-8 | Cas max : 9+
    // Une équipe peut scorer 3 comme 12 — l'historique prime
    scoringNotes: "Moyenne 15 buts/match TOTAL. Le mode le plus prolifique. Terrain ultra-réduit + pas de GK = buts en rafale. MAIS : une équipe peut scorer 3 comme 12 — la moyenne ne garantit rien sans regarder l'historique.",
    typicalScores: ["8-7","7-8","9-6","6-9","8-6","7-5","9-7","6-7","10-6","8-5"],
    keyMetric: "buts",
    cornersPerMatch: 0,
  }
};

// ── Moteur d'analyse FC basé sur l'historique ─────────────────
function buildFCHistoryContext(fcHist, mode, t1Name, t2Name) {
  const hist = (fcHist && fcHist[mode]) ? fcHist[mode] : [];
  const m = FC_MODES[mode];
  if (!m) return "";

  const computeTeamStats = (name) => {
    if (!name || !hist.length) return null;
    const asT1 = hist.filter(h => h.t1 === name);
    const asT2 = hist.filter(h => h.t2 === name);
    const allMatches = [
      ...asT1.map(h => ({ scored: h.s1||0, conceded: h.s2||0, corners: h.c1||0 })),
      ...asT2.map(h => ({ scored: h.s2||0, conceded: h.s1||0, corners: h.c2||0 })),
    ];
    if (!allMatches.length) return null;

    const scored = allMatches.map(x => x.scored);
    const conceded = allMatches.map(x => x.conceded);
    const cornersArr = allMatches.map(x => x.corners).filter(c => c > 0);
    const wins = allMatches.filter(x => x.scored > x.conceded).length;
    const draws = allMatches.filter(x => x.scored === x.conceded).length;
    const losses = allMatches.filter(x => x.scored < x.conceded).length;
    const avg = arr => arr.length ? (arr.reduce((a,b) => a+b,0) / arr.length).toFixed(1) : "—";
    const last5Scored = scored.slice(-5);
    const neverScored2InLast5 = last5Scored.length >= 3 && last5Scored.every(g => g < 2);
    const bestGame = scored.length ? Math.max(...scored) : 0;
    const worstGame = scored.length ? Math.min(...scored) : 0;

    let trend = "—";
    if (last5Scored.length >= 3) {
      const last = last5Scored[last5Scored.length - 1];
      const prev = last5Scored[last5Scored.length - 2];
      trend = last > prev ? "↑" : last < prev ? "↓" : "=";
    }

    return {
      matches: allMatches.length, wins, draws, losses,
      avgScored: avg(scored), avgConceded: avg(conceded),
      avgCorners: cornersArr.length ? avg(cornersArr) : null,
      bestGame, worstGame, last5Scored, neverScored2InLast5, trend,
    };
  };

  const t1Stats = computeTeamStats(t1Name);
  const t2Stats = computeTeamStats(t2Name);

  const h2h = hist.filter(h =>
    (h.t1 === t1Name && h.t2 === t2Name) ||
    (h.t1 === t2Name && h.t2 === t1Name)
  );

  // Build context using string concatenation (no template literal nesting issues)
  let ctx = "\n\n## HISTORIQUE FC — MODE " + mode + " (DONNÉES RÉELLES)\n";
  ctx += "Moyenne globale ce mode : ~" + m.avgTotalGoals + " buts/match total.\n";
  ctx += "RÈGLE : c'est une MOYENNE. Une équipe peut scorer 0 comme 15. L'historique individuel prime.\n";
  ctx += "Mécaniques : " + (m.scoringNotes || "") + "\n\n";

  if (t1Stats) {
    ctx += "📊 " + t1Name + " (" + t1Stats.matches + " matchs en " + mode + "):\n";
    ctx += "  Buts marqués/match : " + t1Stats.avgScored + " (min:" + t1Stats.worstGame + " / max:" + t1Stats.bestGame + ")\n";
    ctx += "  Buts encaissés/match : " + t1Stats.avgConceded + "\n";
    ctx += "  Bilan : " + t1Stats.wins + "V " + t1Stats.draws + "N " + t1Stats.losses + "D\n";
    if (t1Stats.avgCorners) ctx += "  Corners/match : " + t1Stats.avgCorners + "\n";
    if (t1Stats.last5Scored.length) {
      ctx += "  5 derniers matchs (buts marqués) : [" + t1Stats.last5Scored.join(", ") + "] tendance:" + t1Stats.trend + "\n";
    }
    if (t1Stats.neverScored2InLast5) {
      ctx += "  ⚠️ ALERTE : " + t1Name + " n'a pas marqué 2+ buts sur ses 5 derniers matchs en " + mode + " — déficit offensif récent.\n";
    }
  } else if (t1Name) {
    ctx += "📊 " + t1Name + " : Aucun historique en " + mode + " — base-toi sur les moyennes du mode.\n";
  }

  if (t2Stats) {
    ctx += "📊 " + t2Name + " (" + t2Stats.matches + " matchs en " + mode + "):\n";
    ctx += "  Buts marqués/match : " + t2Stats.avgScored + " (min:" + t2Stats.worstGame + " / max:" + t2Stats.bestGame + ")\n";
    ctx += "  Buts encaissés/match : " + t2Stats.avgConceded + "\n";
    ctx += "  Bilan : " + t2Stats.wins + "V " + t2Stats.draws + "N " + t2Stats.losses + "D\n";
    if (t2Stats.avgCorners) ctx += "  Corners/match : " + t2Stats.avgCorners + "\n";
    if (t2Stats.last5Scored.length) {
      ctx += "  5 derniers matchs (buts marqués) : [" + t2Stats.last5Scored.join(", ") + "] tendance:" + t2Stats.trend + "\n";
    }
    if (t2Stats.neverScored2InLast5) {
      ctx += "  ⚠️ ALERTE : " + t2Name + " n'a pas marqué 2+ buts sur ses 5 derniers matchs en " + mode + " — déficit offensif.\n";
    }
  } else if (t2Name) {
    ctx += "📊 " + t2Name + " : Aucun historique en " + mode + " — base-toi sur les moyennes du mode.\n";
  }

  if (h2h.length) {
    ctx += "\n🤝 H2H en " + mode + " (derniers " + Math.min(h2h.length, 5) + " matchs) :\n";
    h2h.slice(-5).forEach(h => {
      const isT1first = h.t1 === t1Name;
      const s1 = isT1first ? (h.s1||0) : (h.s2||0);
      const s2 = isT1first ? (h.s2||0) : (h.s1||0);
      ctx += "  " + t1Name + " " + s1 + "-" + s2 + " " + t2Name + "\n";
    });
  }

  ctx += "\nINSTRUCTION : Utilise cet historique pour le score prédit.\n";
  ctx += "Si une équipe marque habituellement 3 buts max, ne prédit pas 9 pour elle.\n";
  ctx += "Scores typiques dans ce mode : " + (m.typicalScores || []).join(", ") + "\n";

  return ctx;
}
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

  let uclPhase = "";
  const m = now.getMonth() + 1;
  if (m >= 9 && m <= 12) uclPhase = "Phase de ligue (sept-déc)";
  else if (m === 1 || m === 2) uclPhase = "Playoffs / 8e de finale aller (jan-fév)";
  else if (m === 3) uclPhase = "8e de finale retour / Quarts aller";
  else if (m === 4) uclPhase = "Quarts retour / Demis aller";
  else if (m === 5) uclPhase = "Demis retour / Finale";
  else uclPhase = "Intersaison / Qualifications";

  return {
    dateISO: `${year}-${month}-${day}`,
    dateFR: `${dayName} ${day} ${monthName} ${year}`,
    year, month: parseInt(month), day: parseInt(day),
    footballSeason, uclPhase,
    timestamp: now.toISOString()
  };
}

// ── Dynamic System Prompt ─────────────────────────────────────
function buildSystem(extraPrompts = [], agentMode = "arnold", compo = null, fcHistCtx = "") {
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

  if (compo?.team1Players || compo?.team2Players) {
    system += `\n\n## COMPOSITIONS SAISIES PAR L'UTILISATEUR — PRIORITÉ MAXIMALE\n`;
    if (compo.team1Players) system += `Équipe 1 (${compo.team1Name || "Équipe 1"}) — Joueurs : ${compo.team1Players}\nAnalyse la compatibilité de ces joueurs ensemble : style de jeu commun, complémentarité, risques de chevauchement, joueur pivot.\n`;
    if (compo.team2Players) system += `Équipe 2 (${compo.team2Name || "Équipe 2"}) — Joueurs : ${compo.team2Players}\nMême analyse de compatibilité.\n`;
    system += `Intègre ces compositions dans internalData.team1.compatibilityNote et internalData.team2.compatibilityNote avec un compatibilityScore précis basé sur ces joueurs réels.`;
  }

  if (fcHistCtx) system += fcHistCtx;
  return system;
}

function monthName(m) {
  return ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"][m-1];
}

// ── API Call (SÉCURISÉ) ───────────────────────────────────────
async function callArnold(messages, system, apiKey) {
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("❌ Clé API manquante. Veuillez entrer votre clé Anthropic dans les paramètres.");
  }

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
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
  } catch (e) {
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
  } catch (e) {
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

function Timeline({ matches, color }) {
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
          <Timeline matches={lv.last10} color={color} />
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
            {(h.c1 !== undefined || h.c2 !== undefined) && <span style={{ fontSize:9, color:"#00D4AA", fontFamily:"'DM Mono', monospace" }}>📐{h.c1||0}-{h.c2||0}</span>}
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

// ── API Key Modal (contrôlé, robuste) ────────────────────────
function ApiKeyModal({ current, onSave, onClose, C }) {
  const [val, setVal] = useState(current || "");
  const [err, setErr] = useState("");
  const handleSave = () => {
    if (!val.trim().startsWith("sk-")) {
      setErr("La clé doit commencer par 'sk-ant-…'");
      return;
    }
    onSave(val.trim());
  };
  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
      <div style={{ background:C.surf, border:`1px solid ${C.bdr}`, borderRadius:13, padding:24, width:"100%", maxWidth:420, boxShadow:"0 20px 60px rgba(0,0,0,0.6)" }}>
        <h2 style={{ fontSize:18, fontWeight:900, marginBottom:10, color:C.acc }}>🔐 Clé API Anthropic</h2>
        <p style={{ fontSize:11, color:C.muted, marginBottom:14, lineHeight:1.6 }}>
          Entrez votre clé Anthropic (<span style={{color:C.acc, fontFamily:"'DM Mono', monospace"}}>sk-ant-…</span>). Stockée uniquement dans votre navigateur, jamais envoyée ailleurs.
        </p>
        <input
          type="password"
          placeholder="sk-ant-api03-..."
          value={val}
          onChange={e => { setVal(e.target.value); setErr(""); }}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
          autoFocus
          style={{ width:"100%", padding:"10px 12px", background:"#090c0e", border:`1px solid ${err ? "#ef4444" : C.bdr}`, borderRadius:7, color:C.t, fontSize:12, fontFamily:"'DM Mono', monospace", marginBottom: err ? 4 : 12 }}
        />
        {err && <div style={{ fontSize:9.5, color:"#ef4444", marginBottom:10, fontFamily:"'DM Mono', monospace" }}>⚠ {err}</div>}
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={handleSave} style={{ flex:1, padding:"10px", background:"linear-gradient(135deg,#00D4AA,#0077FF)", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", letterSpacing:1 }}>
            ✓ CONFIRMER
          </button>
          <button onClick={onClose} style={{ flex:1, padding:"10px", background:"transparent", border:`1px solid ${C.bdr}`, borderRadius:7, color:C.muted, fontSize:11, fontWeight:700, cursor:"pointer", letterSpacing:1 }}>
            ✕ ANNULER
          </button>
        </div>
        <p style={{ fontSize:9, color:"#555", marginTop:12, textAlign:"center" }}>
          Clé disponible sur{" "}
          <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{ color:C.acc, textDecoration:"none" }}>console.anthropic.com</a>
        </p>
      </div>
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
  const [fcC1, setFcC1] = useState("");
  const [fcC2, setFcC2] = useState(""); // corners FC25_5v5
  const [fcHist, setFcHist] = useState({ FC24_4v4: [], FC25_5v5: [], FC25_3v3: [] });
  const [adminPrompts, setAdminPrompts] = useState([]);
  const [pName, setPName] = useState("");
  const [pContent, setPContent] = useState("");
  // Compositions
  const [showCompo, setShowCompo] = useState(false);
  const [compoT1, setCompoT1] = useState("");
  const [compoT2, setCompoT2] = useState("");
  // Favoris
  const [favorites, setFavorites] = useState(() => { try { return JSON.parse(localStorage.getItem("arnold_favorites") || "[]"); } catch { return []; } });
  const [showFavs, setShowFavs] = useState(false);
  // Progression chargement
  const [loadProgress, setLoadProgress] = useState(0);
  const getStoredKey = () => { try { return localStorage.getItem("arnold_api_key") || ""; } catch { return ""; } };
  const [apiKey, setApiKey] = useState(getStoredKey);
  const [showApiInput, setShowApiInput] = useState(() => !getStoredKey());
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  useEffect(() => {
    const ctx = getLiveContext();
    setMsgs([{ role: "intro", parsed: { type: "chat", message: `Bonjour ! Je suis ARNOLD ⚽\n\n📅 Nous sommes le ${ctx.dateFR} — Saison ${ctx.footballSeason}\n\nMon contexte temporel est injecté à chaque requête. Je suis toujours à jour, peu importe quand tu me consultes.\n\nWeb search ciblé sur :\n🔄 Forme récente (10 derniers matchs)\n🚑 Blessés & suspendus actuels\n🤝 Confrontations directes (H2H)\n🔁 Transferts & absences récents\n\nStats générales, tactique et prédiction : modèle interne.\n\nQuel match analyser ?` } }]);
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
    setLoadProgress(0);
    setMsgs(prev => [...prev, { role: "user", content: text, parsed: { type: "chat", message: text } }, { role: "typing" }]);
    setLoading(true);
    // Animation de progression réaliste
    const stages = [15, 35, 55, 75, 88, 95];
    let si = 0;
    const progressTimer = setInterval(() => {
      if (si < stages.length) { setLoadProgress(stages[si]); si++; }
      else clearInterval(progressTimer);
    }, 600);
    try {
      const compo = (compoT1 || compoT2) ? { team1Players: compoT1, team2Players: compoT2, team1Name: undefined, team2Name: undefined } : null;
      const fcCtx = (tab === "fc" && fcT1 && fcT2) ? buildFCHistoryContext(fcHist, fcMode, fcT1, fcT2) : "";
      const system = buildSystem(adminPrompts, agent, compo, fcCtx);
      const hist = [...getHistory(), { role: "user", content: text }];
      const raw = await callArnold(hist, system, apiKey);
      const parsed = parseJSON(raw);
      if (tab === "fc" && fcT1 && fcT2 && parsed?.prediction) {
        setFcHist(prev => ({ ...prev, [fcMode]: [...prev[fcMode], { t1: fcT1, t2: fcT2, s1: parsed.prediction.score1 ?? 0, s2: parsed.prediction.score2 ?? 0, c1: fcC1 ? parseInt(fcC1) : undefined, c2: fcC2 ? parseInt(fcC2) : undefined }] }));
      }
      setMsgs(prev => [...prev.filter(m => m.role !== "typing"), { role: "assistant", content: raw, parsed }]);
      setLoadProgress(100);
      setTimeout(() => setLoadProgress(0), 600);
    } catch (err) {
      clearInterval(progressTimer);
      setLoadProgress(0);
      const errorMsg = err.message || "Erreur inconnue lors de l'appel à l'IA";
      setMsgs(prev => [...prev.filter(m => m.role !== "typing"), { role: "assistant", content: "", parsed: { type: "chat", message: `⚠️ ${errorMsg}` } }]);
    } finally {
      clearInterval(progressTimer);
      setLoading(false);
    }
  }, [input, loading, adminPrompts, agent, tab, fcT1, fcT2, fcMode, apiKey, msgs]);

  const saveApiKey = (key) => {
    if (!key || !key.trim()) return;
    try { localStorage.setItem("arnold_api_key", key); } catch {}
    setApiKey(key);
    setShowApiInput(false);
  };

  const saveFavorite = (text) => {
    const trimmed = text.trim();
    if (!trimmed || favorites.some(f => f.text === trimmed)) return;
    const updated = [{ id: Date.now(), text: trimmed, date: new Date().toLocaleDateString("fr-FR") }, ...favorites].slice(0, 20);
    setFavorites(updated);
    try { localStorage.setItem("arnold_favorites", JSON.stringify(updated)); } catch {}
  };

  const removeFavorite = (id) => {
    const updated = favorites.filter(f => f.id !== id);
    setFavorites(updated);
    try { localStorage.setItem("arnold_favorites", JSON.stringify(updated)); } catch {}
  };

  const launchFC = () => {
    if (!fcT1 || !fcT2) return;
    const m = FC_MODES[fcMode];
    const ctx = getLiveContext();
    const histCtx = buildFCHistoryContext(fcHist, fcMode, fcT1, fcT2);
    const p = `Analyse ce match ${m.label} — ${ctx.dateFR} :
Équipe 1 : ${fcT1} | Équipe 2 : ${fcT2}
${fcS1 && fcS2 ? `Score saisi : ${fcS1}–${fcS2}` : "Match à venir / prédiction demandée"}
${fcMode === "FC25_5v5" && (fcC1 || fcC2) ? `Corners saisis : Éq1=${fcC1||0} | Éq2=${fcC2||0}` : ""}
Mode : ${fcMode} | Terrain : ${m.fieldSize} | Gardien : ${m.goalkeeper ? "Oui IA" : "Non"} | Corners actifs : ${m.corners ? "Oui" : "Non"}
Moyenne buts ce mode : ~${m.avgTotalGoals} total (ATTENTION : c'est une moyenne, l'historique prime)
Style : ${m.style}
${histCtx || "Aucun historique enregistré pour ces équipes — base-toi sur les moyennes du mode."}
⚠️ PAS de web search (jeu vidéo). meta.mode = "${fcMode}". JSON strict.
RAPPEL PRÉDICTION : une équipe peut scorer 0 comme 12 — utilise son historique réel avant les moyennes générales.`;
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
        <ApiKeyModal
          current={apiKey}
          onSave={saveApiKey}
          onClose={() => setShowApiInput(false)}
          C={C}
        />
      )}

      {/* Barre de progression */}
      {loadProgress > 0 && (
        <div style={{ position:"fixed", top:0, left:0, right:0, height:2, zIndex:200, background:"#0d1114" }}>
          <div style={{
            height:"100%", background:"linear-gradient(90deg,#00D4AA,#0077FF,#A855F7)",
            width:`${loadProgress}%`,
            transition: loadProgress === 100 ? "width .15s ease" : "width .55s cubic-bezier(.4,0,.2,1)",
            boxShadow:"0 0 8px rgba(0,212,170,0.6)"
          }}/>
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
          <div style={{ padding: "7px 16px", borderBottom: `1px solid ${C.bdr}`, display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            {[
              ["🏆 UCL", "Analyse un match de Champions League de cette semaine. Recherche la forme récente des deux équipes (10 derniers matchs), les blessés actuels, les suspensions et le H2H. Stats et tactique en interne."],
              ["🇫🇷 Ligue 1", "Analyse un match important Ligue 1 cette semaine. Web search : forme 10 matchs, blessés, H2H. Modèle prédictif en local."],
              ["🇬🇧 Premier League", "Analyse un match clé Premier League en ce moment. Données web : forme récente, absences, H2H. Tactique et compatibilité en local."],
              ["🇪🇸 La Liga", "Analyse un match La Liga de la journée. Web : forme, blessés, transferts récents. Local : stats, prédiction, tactique."],
              ["🎮 FC25 5v5", "Analyse FC25 5v5 Rush : PSG vs Real Madrid. Pas de web search sur la forme (jeu vidéo). meta.mode='FC25_5v5'."],
            ].map(([l, m]) => (
              <button key={l} onClick={() => send(m)} style={{ padding: "3.5px 10px", borderRadius: 11, border: `1px solid ${C.bdr}`, background: "transparent", color: "#444", fontSize: 9.5, cursor: "pointer", fontFamily: "'DM Mono', monospace", transition: "all .2s", whiteSpace: "nowrap" }}>{l}</button>
            ))}
            <div style={{ marginLeft:"auto", display:"flex", gap:5 }}>
              <button onClick={() => setShowCompo(v => !v)} style={{ padding:"3.5px 10px", borderRadius:11, border:`1px solid ${showCompo ? "#00D4AA" : C.bdr}`, background: showCompo ? "rgba(0,212,170,0.1)" : "transparent", color: showCompo ? "#00D4AA" : "#444", fontSize:9.5, cursor:"pointer", fontFamily:"'DM Mono', monospace", whiteSpace:"nowrap" }}>
                📋 {compoT1 || compoT2 ? "✓ Compo" : "Composition"}
              </button>
              <button onClick={() => setShowFavs(v => !v)} style={{ padding:"3.5px 10px", borderRadius:11, border:`1px solid ${showFavs ? "#f59e0b" : C.bdr}`, background: showFavs ? "rgba(245,158,11,0.1)" : "transparent", color: showFavs ? "#f59e0b" : "#444", fontSize:9.5, cursor:"pointer", fontFamily:"'DM Mono', monospace", whiteSpace:"nowrap" }}>
                ⭐ {favorites.length > 0 ? `Favoris (${favorites.length})` : "Favoris"}
              </button>
            </div>
          </div>

          {/* Panel composition */}
          {showCompo && (
            <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.bdr}`, background:"rgba(0,212,170,0.03)" }}>
              <div style={{ fontSize:8.5, color:"#00D4AA", letterSpacing:1.5, marginBottom:8, fontFamily:"'DM Mono', monospace" }}>📋 COMPOSITIONS — améliore l'analyse de compatibilité</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <div>
                  <div style={{ fontSize:8.5, color:"#3B82F6", marginBottom:4, fontFamily:"'DM Mono', monospace" }}>ÉQUIPE 1</div>
                  <textarea value={compoT1} onChange={e=>setCompoT1(e.target.value)} placeholder={"Ex: Donnarumma, Hakimi, Marquinhos, Pacho, Nuno Mendes, Vitinha, Joao Neves, Fabian Ruiz, Dembele, Asensio, Ramos"} rows={3} style={{ width:"100%", padding:"6px 8px", background:"#090c0e", border:`1px solid ${C.bdr}`, borderRadius:5, color:"#aaa", fontSize:9.5, fontFamily:"'Crimson Pro', serif", lineHeight:1.4, resize:"none" }}/>
                </div>
                <div>
                  <div style={{ fontSize:8.5, color:"#EF4444", marginBottom:4, fontFamily:"'DM Mono', monospace" }}>ÉQUIPE 2</div>
                  <textarea value={compoT2} onChange={e=>setCompoT2(e.target.value)} placeholder={"Ex: Courtois, Carvajal, Militao, Rudiger, Mendy, Tchouameni, Valverde, Bellingham, Rodrygo, Vinicius Jr, Mbappe"} rows={3} style={{ width:"100%", padding:"6px 8px", background:"#090c0e", border:`1px solid ${C.bdr}`, borderRadius:5, color:"#aaa", fontSize:9.5, fontFamily:"'Crimson Pro', serif", lineHeight:1.4, resize:"none" }}/>
                </div>
              </div>
              {(compoT1 || compoT2) && (
                <div style={{ display:"flex", justifyContent:"flex-end", marginTop:6 }}>
                  <button onClick={() => { setCompoT1(""); setCompoT2(""); }} style={{ fontSize:9, color:"#555", background:"transparent", border:"1px solid #222", borderRadius:4, padding:"2px 8px", cursor:"pointer", fontFamily:"'DM Mono', monospace" }}>✕ Effacer</button>
                </div>
              )}
            </div>
          )}

          {/* Panel favoris */}
          {showFavs && (
            <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.bdr}`, background:"rgba(245,158,11,0.03)", maxHeight:180, overflowY:"auto" }}>
              <div style={{ fontSize:8.5, color:"#f59e0b", letterSpacing:1.5, marginBottom:8, fontFamily:"'DM Mono', monospace" }}>⭐ MATCHS SAUVEGARDÉS</div>
              {favorites.length === 0 ? (
                <div style={{ fontSize:9.5, color:"#333", fontFamily:"'Crimson Pro', serif", fontStyle:"italic" }}>Aucun favori. Utilise ⭐ sous un message pour sauvegarder.</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  {favorites.map(f => (
                    <div key={f.id} style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 8px", background:"#0d1114", borderRadius:5 }}>
                      <div onClick={() => { send(f.text); setShowFavs(false); }} style={{ flex:1, fontSize:10, color:"#888", cursor:"pointer", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis", fontFamily:"'Crimson Pro', serif" }}>{f.text}</div>
                      <span style={{ fontSize:8.5, color:"#252525", fontFamily:"'DM Mono', monospace", flexShrink:0 }}>{f.date}</span>
                      <button onClick={() => removeFavorite(f.id)} style={{ background:"transparent", border:"none", color:"#2a2a2a", cursor:"pointer", fontSize:10, flexShrink:0 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {msg.parsed && <AnalysisCard data={msg.parsed} />}
                    {msg.role === "assistant" && msg.content && (
                      <div style={{ display:"flex", gap:5, marginTop:6 }}>
                        <button onClick={() => { const prev = msgs[i-1]; if (prev?.content) saveFavorite(prev.content); }} style={{ fontSize:8.5, color:"#555", background:"transparent", border:"1px solid #1a1a1a", borderRadius:4, padding:"2px 8px", cursor:"pointer", fontFamily:"'DM Mono', monospace", display:"flex", alignItems:"center", gap:3 }}>
                          ⭐ Sauvegarder
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
              return null;
            })}
            <div ref={endRef} />
          </div>

          <div style={{ padding: "11px 16px", borderTop: `1px solid ${C.bdr}`, background: C.surf }}>
            {(compoT1 || compoT2) && (
              <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:6, padding:"4px 8px", background:"rgba(0,212,170,0.06)", border:"1px solid rgba(0,212,170,0.15)", borderRadius:5 }}>
                <span style={{ fontSize:8.5, color:"#00D4AA", fontFamily:"'DM Mono', monospace" }}>📋 Compositions actives</span>
                {compoT1 && <span style={{ fontSize:8.5, color:"#3B82F6", fontFamily:"'DM Mono', monospace" }}>Éq.1 ✓</span>}
                {compoT2 && <span style={{ fontSize:8.5, color:"#EF4444", fontFamily:"'DM Mono', monospace" }}>Éq.2 ✓</span>}
                <span style={{ fontSize:8.5, color:"#555", fontFamily:"'Crimson Pro', serif", fontStyle:"italic", marginLeft:2 }}>— compatibilité précise activée</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", background: "#090c0e", border: `1px solid ${loading ? C.acc : C.bdr}`, borderRadius: 10, padding: "7px 10px", transition: "border-color .25s" }}>
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Quel match analyser ? (Entrée pour envoyer)" rows={1} style={{ flex: 1, background: "transparent", border: "none", color: C.t, fontSize: 12.5, fontFamily: "'Crimson Pro', serif", resize: "none", maxHeight: 90, lineHeight: 1.5 }} />
              <button onClick={() => send()} disabled={loading || !input.trim()} style={{ width: 29, height: 29, borderRadius: 6, border: "none", background: loading || !input.trim() ? "#141414" : "linear-gradient(135deg,#00D4AA,#0077FF)", color: "#fff", fontSize: 13, cursor: loading || !input.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{loading ? "⏳" : "↑"}</button>
            </div>
            <div style={{ fontSize: 8, color: "#141e1e", marginTop: 3.5, textAlign: "center", fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>
              {loading
                ? <span style={{ color:"#00D4AA" }}>⚡ {loadProgress}% — traitement en cours…</span>
                : <span>{agent.toUpperCase()} · Date injectée automatiquement · Web Search ciblé · Entrée pour envoyer</span>
              }
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
              </div>
              {/* Corners — FC25_5v5 uniquement */}
              {fcMode === "FC25_5v5" && (
                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
                  <span style={{ fontSize:9, color:"#00D4AA" }}>📐 CORNERS :</span>
                  <input value={fcC1} onChange={e=>setFcC1(e.target.value)} placeholder="0" type="number" style={{ width:46, padding:"4px 0", textAlign:"center", background:"#090c0e", border:`1px solid rgba(0,212,170,0.3)`, borderRadius:4, color:"#3B82F6", fontSize:15, fontWeight:900, fontFamily:"'DM Mono', monospace" }}/>
                  <span style={{ color:"#2a3838", fontSize:12 }}>–</span>
                  <input value={fcC2} onChange={e=>setFcC2(e.target.value)} placeholder="0" type="number" style={{ width:46, padding:"4px 0", textAlign:"center", background:"#090c0e", border:`1px solid rgba(0,212,170,0.3)`, borderRadius:4, color:"#EF4444", fontSize:15, fontWeight:900, fontFamily:"'DM Mono', monospace" }}/>
                  <span style={{ fontSize:9, color:"#2a3838", fontFamily:"'DM Mono', monospace", fontStyle:"italic" }}>optionnel — enrichit l'analyse</span>
                </div>
              )}
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
                <button onClick={launchFC} disabled={loading || !fcT1 || !fcT2} style={{ flex:1, padding:"10px", borderRadius:5, border:"none", background:loading||!fcT1||!fcT2?"#141414":"linear-gradient(135deg,#00D4AA,#0077FF)", color:"#fff", fontSize:10, fontWeight:800, letterSpacing:2, cursor:loading||!fcT1||!fcT2?"not-allowed":"pointer", fontFamily:"'DM Mono', monospace" }}>⚡ LANCER LA PRÉDICTION</button>
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
