import React, { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// ARNOLD FOOTBALL AI v5 — SÉCURISÉ + ROBUSTE
// ============================================================

// Proxy Vercel — évite les erreurs CORS
const API = "/api/arnold";

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
  FC26_5v5: {
    label: "FC26 · 5v5 Rush", game: "EA FC 26", players: 5,
    goalkeeper: true, corners: true, penalties: false,
    goalSize: "Cages 11v11 standard", fieldSize: "63.7 × 46.6 m",
    offside: "Dernier tiers uniquement", blueCard: false,
    cards: "Cartons standards", extraTime: "—",
    style: "Compétitif · passes latérales · pressing · collectif",
    notes: "Gardien IA · Course au ballon · CF indirects · Pas de penalty · Pas de carton bleu · Pas de prolongation",
    color: "#00D4AA", colorDim: "rgba(0,212,170,0.1)"
  },
  FC25_3v3: {
    label: "FC25 · 3v3 Rush", game: "EA FC 26", players: 3,
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
function buildSystem(extraPrompts = [], agentMode = "arnold") {
  const ctx = getLiveContext();

  const base = `Tu es ARNOLD, expert mondial en analyse football.

## CONTEXTE TEMPOREL — INJECTÉ AUTOMATIQUEMENT
⏰ Date exacte aujourd'hui : ${ctx.dateFR} (${ctx.dateISO})
📚 Historique des prédictions passées : ${(() => {
  try {
    const fb = JSON.parse(localStorage.getItem("arnold_feedback") || "[]").slice(0, 20);
    if (!fb.length) return "Aucun feedback encore.";
    const correct = fb.filter(f => {
      const winner_pred = f.real1 > f.real2 ? "t1" : f.real1 < f.real2 ? "t2" : "nul";
      return winner_pred === (f.real1 > f.real2 ? "t1" : f.real1 < f.real2 ? "t2" : "nul");
    }).length;
    return fb.slice(0, 5).map(f => f.team1 + " " + f.real1 + "-" + f.real2 + " " + f.team2 + " (" + f.date + ")").join(" | ") + " | Précision: " + Math.round(correct/fb.length*100) + "%";
  } catch { return "N/A"; }
}
)()}
📅 Saison football en cours : ${ctx.footballSeason}
🏆 Phase UCL approximative : ${ctx.uclPhase}
🌍 Année : ${ctx.year}

## COMPÉTITIONS SUPPORTÉES — Connaissance interne enrichie
Europe: UCL, UEL, UECL, Supercoupe UEFA
Internationales: FIFA World Cup, EURO, CAN, Copa América, Ligue des Nations, Qualifications WC/EURO/CAN
France: Ligue 1, Ligue 2, Coupe de France, Trophée des Champions
Angleterre: Premier League, Championship, EFL League One/Two, FA Cup, Carabao Cup
Espagne: La Liga, La Liga 2, Copa del Rey, Supercopa de España
Allemagne: Bundesliga, 2. Bundesliga, DFB Pokal, DFL Supercup
Italie: Serie A, Serie B, Coppa Italia, Supercoppa
Portugal: Primeira Liga, Segunda Liga, Taça de Portugal
Pays-Bas: Eredivisie, Eerste Divisie, KNVB Cup
Arabie Saoudite: Saudi Pro League, King Cup, Saudi Super Cup
USA/Canada: MLS, USL Championship, US Open Cup
Mexique: Liga MX, Copa MX, Liga de Expansión
Brésil: Série A, Série B, Copa do Brasil
Argentine: Liga Profesional, Copa de la Liga
Colombie: Liga BetPlay
Chili: Primera División
Pérou: Liga 1
Uruguay: Primera División
Copa Libertadores, Copa Sudamericana, Recopa Sudamericana
Turquie: Süper Lig, TFF First League, Turkish Cup
Russie: Premier League RPL
Japon: J1 League, J2 League, Emperor's Cup
Chine: Chinese Super League
Australie: A-League
Afrique du Sud: Premier Soccer League (PSL)
Belgique: Jupiler Pro League, First Amateur
Suisse: Super League, Challenge League
Grèce: Super League
Suède: Allsvenskan
Norvège: Eliteserien
Danemark: Superliga
Écosse: Scottish Premiership, Scottish Cup
Irlande: League of Ireland

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

## GESTION MULTI-MATCHS
Si la demande contient PLUSIEURS matchs (ex: "PSG vs Arsenal + Bayern vs Dortmund"), tu DOIS :
1. Effectuer 6 recherches web pour CHAQUE match
2. Retourner UN SEUL JSON VALIDE contenant un tableau "analyses" :
{ "type": "multi", "analyses": [ {JSON match 1}, {JSON match 2}, ... ] }
Chaque match a son propre JSON analysis complet.
JAMAIS de texte libre entre les JSONs. JAMAIS de markdown. JSON pur uniquement.

## WEB SEARCH OBLIGATOIRE — 6 REQUÊTES MINIMUM POUR UN MATCH RÉEL
AVANT de répondre, tu DOIS effectuer ces recherches web :
1. "[équipe1] résultats ${ctx.year} forme récente derniers matchs"
2. "[équipe2] résultats ${ctx.year} forme récente derniers matchs"  
3. "[équipe1] blessés absents suspendus ${ctx.year}"
4. "[équipe2] blessés absents suspendus ${ctx.year}"
5. "[équipe1] [équipe2] confrontations historique H2H"
6. "[équipe1] [équipe2] statistiques corners tirs cadrés cartons ${ctx.footballSeason}"

PUIS utilise tes connaissances internes pour compléter les stats manquantes.

## FORMAT DE RÉPONSE — JSON STRICT ET COMPLET
RÈGLE ABSOLUE : Chaque champ DOIT être rempli avec de VRAIES données numériques, jamais null, jamais 0 partout.
Si le web search ne trouve pas une stat précise, utilise ta connaissance interne de l'équipe.

{
  "type": "analysis",
  "meta": {
    "team1": "Nom exact",
    "team2": "Nom exact",
    "competition": "Nom complet",
    "matchDate": "Date ou À venir",
    "season": "${ctx.footballSeason}",
    "analysisDate": "${ctx.dateISO}",
    "mode": "real",
    "webQueries": ["requête 1 effectuée", "requête 2", "requête 3", "requête 4", "requête 5", "requête 6"]
  },
  "liveData": {
    "team1": {
      "last10": [
        {"date":"${ctx.year}-MM-DD","opponent":"Nom adversaire","score":"2-1","result":"V","competition":"Ligue 1"},
        {"date":"${ctx.year}-MM-DD","opponent":"Nom adversaire","score":"0-0","result":"N","competition":"UCL"},
        {"date":"${ctx.year}-MM-DD","opponent":"Nom adversaire","score":"1-2","result":"D","competition":"Ligue 1"}
      ],
      "injuries": [
        {"name":"Prénom Nom","position":"ATT","returnDate":"15 juin","severity":"grave"},
        {"name":"Prénom Nom","position":"MIL","returnDate":"inconnue","severity":"modérée"}
      ],
      "suspensions": [{"name":"Prénom Nom","reason":"3 cartons jaunes","matchesMissed":1}],
      "recentTransfers": [{"name":"Prénom Nom","type":"arrivée","from":"Club","impact":"important"}]
    },
    "team2": {
      "last10": [],
      "injuries": [],
      "suspensions": [],
      "recentTransfers": []
    },
    "h2h": {
      "last5": [
        {"date":"YYYY-MM-DD","score":"2-1","winner":"équipe1","competition":"UCL"},
        {"date":"YYYY-MM-DD","score":"1-1","winner":"nul","competition":"Ligue 1"},
        {"date":"YYYY-MM-DD","score":"0-2","winner":"équipe2","competition":"UCL"}
      ],
      "team1Wins": 3,
      "team2Wins": 1,
      "draws": 1,
      "avgGoals": 2.6,
      "lastMeeting": "YYYY-MM-DD",
      "h2hNote": "Explication tendance H2H en 1-2 phrases avec chiffres"
    }
  },
  "internalData": {
    "team1": {
      "avgGoalsScored": 2.3,
      "avgGoalsConceded": 0.8,
      "avgCorners": 7.2,
      "avgShotsOnTarget": 6.4,
      "avgPossession": 64,
      "yellowCardsPerMatch": 1.8,
      "yellowCardsTotal": 42,
      "redCards": 2,
      "xGPerMatch": 2.4,
      "xGConcededPerMatch": 0.9,
      "cleanSheets": 14,
      "scoringFirstRate": 68,
      "winWhenScoringFirst": 89,
      "composition": "4-3-3",
      "tacticalStyle": "Pressing haut intense, possession longue, transitions rapides",
      "strengths": ["Pressing haut efficace", "Jeu de possession", "Efficacité offensive"],
      "weaknesses": ["Vulnérable en transition", "Défense haute risquée"],
      "keyPlayers": [
        {"name":"Prénom Nom","role":"Attaquant","stat":"24 buts 8 passes","impact":"crucial"},
        {"name":"Prénom Nom","role":"Milieu","stat":"12 passes décisives","impact":"crucial"},
        {"name":"Prénom Nom","role":"Défenseur","stat":"89% duels gagnés","impact":"important"}
      ]
    },
    "team2": {
      "avgGoalsScored": 1.9,
      "avgGoalsConceded": 1.1,
      "avgCorners": 5.8,
      "avgShotsOnTarget": 5.1,
      "avgPossession": 54,
      "yellowCardsPerMatch": 2.1,
      "yellowCardsTotal": 48,
      "redCards": 3,
      "xGPerMatch": 1.8,
      "xGConcededPerMatch": 1.3,
      "cleanSheets": 9,
      "scoringFirstRate": 52,
      "winWhenScoringFirst": 74,
      "composition": "4-2-3-1",
      "tacticalStyle": "Bloc médian, contre-attaques rapides",
      "strengths": ["Solidité défensive", "Efficacité en contre"],
      "weaknesses": ["Manque de créativité", "Dépendance aux titulaires"],
      "keyPlayers": [
        {"name":"Prénom Nom","role":"Attaquant","stat":"18 buts","impact":"crucial"},
        {"name":"Prénom Nom","role":"Milieu","stat":"7 passes décisives","impact":"important"}
      ]
    }
  },
  "prediction": {
    "score1": 2,
    "score2": 1,
    "winner": "Équipe 1",
    "confidence": 68,
    "resultProbs": {"team1Win": 58, "draw": 22, "team2Win": 20},
    "btts": true,
    "over25": true,
    "predictedCorners": {"team1": 7, "team2": 5, "total": 12, "over85": true, "over105": false},
    "predictedYellowCards": {"team1": 2, "team2": 2, "total": 4, "over35": true},
    "predictedShotsOnTarget": {"team1": 6, "team2": 4},
    "keyReason": "Supériorité offensive de l'équipe 1 confirmée par 7 victoires sur 10 et xG de 2.4"
  },
  "keyFactors": [
    {"icon":"🔄","label":"Forme récente","tag":"LIVE","detail":"Éq1: 7V 2N 1D sur 10 matchs, 23 buts marqués. Éq2: 5V 3N 2D, 16 buts. CHIFFRES RÉELS."},
    {"icon":"🚑","label":"Blessés/Suspendus","tag":"LIVE","detail":"Éq1: Nom1 (ATT, grave), Nom2 (MIL). Éq2: Nom3 suspendu 1 match."},
    {"icon":"🤝","label":"H2H","tag":"LIVE","detail":"5 dernières confrontations: 3-1-1 en faveur Éq1. Moyenne 2.6 buts/match. Dernière: 2-1 le DD/MM/AAAA."},
    {"icon":"📐","label":"Corners","tag":"LOCAL","detail":"Éq1: 7.2 corners/match (2ème division). Éq2: 5.8/match. Prédiction: 12 corners total, Over 8.5 ✓"},
    {"icon":"🎯","label":"Tirs cadrés","tag":"LOCAL","detail":"Éq1: 6.4 tirs cadrés/match vs Éq2: 5.1. xG: 2.4 vs 1.8. Éq1 favorisée offensivement."},
    {"icon":"🟨","label":"Cartons jaunes","tag":"LOCAL","detail":"Éq1: 1.8 CJ/match (42 total). Éq2: 2.1 CJ/match (48 total). Total prédit: 4 CJ, Over 3.5 ✓"},
    {"icon":"⚖️","label":"Enjeux","tag":"LIVE","detail":"Enjeu précis : qualification, titre, maintien ou autre avec impact psychologique."},
    {"icon":"🏠","label":"Avantage terrain","tag":"LOCAL","detail":"% victoire à domicile/extérieur avec chiffres précis de la saison."}
  ],
  "tacticalNote": "Note tactique de 4-5 phrases avec chiffres : comment les systèmes s'affrontent, qui domine au milieu, quel est le plan B, impact des absences sur le dispositif.",
  "sources": ["source web utilisée 1", "source web 2"]
}

## RÈGLES CRITIQUES POUR LES STATS :
- avgCorners : JAMAIS null. Utilise ta connaissance de l'équipe si web search vide.
- avgShotsOnTarget : JAMAIS null. 
- yellowCardsPerMatch : JAMAIS null.
- keyPlayers : TOUJOURS au moins 2-3 joueurs avec de vraies stats de la saison.
- h2h.last5 : TOUJOURS au moins 3 matchs récents réels.
- last10 : TOUJOURS au moins 5 matchs récents réels.
- predictedCorners/YellowCards : TOUJOURS rempli avec chiffres précis.
- keyFactors details : TOUJOURS avec chiffres numériques précis, jamais "N/A" ou "...".

## POUR LES MODES FC (meta.mode = FC24_4v4 / FC26_5v5 / FC25_3v3) :
- PAS de web search (données jeu vidéo non dispo en ligne)
- Utilise les moyennes de buts du mode (FC24_4v4: ~12 total, FC26_5v5: ~5.5, FC25_3v3: ~15)
- Adapte les stats aux mécaniques FC spécifiques
- FC26_5v5 : inclure prédiction corners, PAS de penalty ni carton bleu

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
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [3000, 8000, 15000]; // 3s, 8s, 15s

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4000,
          system,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages
        })
      });

      // Si surchargé (529) ou rate limit (429) → retry automatique
      if (res.status === 529 || res.status === 429) {
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt];
          console.warn(`⏳ API surchargée — tentative ${attempt + 1}/${MAX_RETRIES}, attente ${delay/1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error(`⏳ API Anthropic surchargée. Réessaie dans 1-2 minutes.`);
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || `Erreur HTTP ${res.status}`;
        // Retry sur erreurs serveur (5xx)
        if (res.status >= 500 && attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
          continue;
        }
        throw new Error(`Erreur API Anthropic: ${errorMsg}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "Erreur API inconnue");
      
      const textContent = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
      if (!textContent) throw new Error("Aucune réponse texte reçue de l'API");
      
      return textContent;

    } catch (err) {
      // Ne pas retry sur les erreurs d'auth ou de syntaxe
      if (err.message.includes("Clé API") || err.message.includes("401") || err.message.includes("400")) {
        throw err;
      }
      if (attempt === MAX_RETRIES) {
        console.error("Erreur lors de l'appel à l'API:", err);
        throw err;
      }
      // Retry sur autres erreurs réseau
      console.warn(`Erreur réseau, tentative ${attempt + 1}/${MAX_RETRIES}:`, err.message);
      await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
    }
  }
}

// ── JSON Parser (ROBUSTE) ─────────────────────────────────────
function parseJSON(raw) {
  if (!raw || typeof raw !== "string") {
    return { type: "chat", message: "Aucune réponse reçue de l'IA." };
  }

  // Nettoyage markdown
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  // Tentative 1 : JSON unique direct
  try {
    if (cleaned.startsWith("{")) return JSON.parse(cleaned);
  } catch {}

  // Tentative 2 : Extraire TOUS les JSONs valides (multi-matchs)
  const jsonObjects = [];
  let depth = 0, start = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          const obj = JSON.parse(cleaned.slice(start, i + 1));
          if (obj.type === "analysis" || obj.type === "chat") jsonObjects.push(obj);
        } catch {}
        start = -1;
      }
    }
  }

  // Si plusieurs analyses trouvées → retourner un objet multi
  if (jsonObjects.length > 1) {
    return { type: "multi", analyses: jsonObjects };
  }
  if (jsonObjects.length === 1) return jsonObjects[0];

  // Tentative 3 : premier { au dernier }
  try {
    const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
    if (s !== -1 && e > s) return JSON.parse(cleaned.slice(s, e + 1));
  } catch {}

  // Fallback texte brut
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

  // Multi-matchs : afficher chaque analyse séparément
  if (data.type === "multi") return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {data.analyses.map((analysis, i) => (
        <div key={i}>
          <div style={{ fontSize:9, color:"#00D4AA", letterSpacing:2, fontFamily:"'DM Mono', monospace", marginBottom:6 }}>
            ⚽ MATCH {i+1}/{data.analyses.length}
          </div>
          <AnalysisCard data={analysis} />
        </div>
      ))}
    </div>
  );

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
  const W = mode === "FC26_5v5" ? 280 : mode === "FC24_4v4" ? 205 : 162;
  const H = mode === "FC26_5v5" ? 188 : mode === "FC24_4v4" ? 136 : 108;
  const cx = W / 2, cy = H / 2;
  const gW = mode === "FC26_5v5" ? 38 : 16, gD = mode === "FC26_5v5" ? 9 : 6;
  const pos = {
    FC26_5v5: [[.14,.5],[.25,.23],[.25,.77],[.38,.38],[.38,.62]],
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
          {mode === "FC26_5v5" && <>
            <rect x={0} y={cy - H * .27} width={W * .2} height={H * .54} fill="none" stroke={m.color} strokeWidth={.7} strokeOpacity={.28} />
            <rect x={W - W * .2} y={cy - H * .27} width={W * .2} height={H * .54} fill="none" stroke={m.color} strokeWidth={.7} strokeOpacity={.28} />
            <line x1={W * .33} y1={0} x2={W * .33} y2={H} stroke="#FFD700" strokeWidth={.8} strokeDasharray="5,4" strokeOpacity={.48} />
            <line x1={W * .67} y1={0} x2={W * .67} y2={H} stroke="#FFD700" strokeWidth={.8} strokeDasharray="5,4" strokeOpacity={.48} />
            <text x={W * .165} y={H + 13} textAnchor="middle" fontSize={7} fill="#FFD700" fontFamily="monospace">hors-jeu →</text>
            <text x={W * .835} y={H + 13} textAnchor="middle" fontSize={7} fill="#FFD700" fontFamily="monospace">← hors-jeu</text>
          </>}
          <rect x={-gD} y={cy - gW / 2} width={gD} height={gW} fill="none" stroke="#ccc" strokeWidth={mode === "FC26_5v5" ? 2 : 1.3} />
          <rect x={W} y={cy - gW / 2} width={gD} height={gW} fill="none" stroke="#ccc" strokeWidth={mode === "FC26_5v5" ? 2 : 1.3} />
          {mode === "FC26_5v5" && <>
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

// ── Competition Selector Component ───────────────────────────
function CompSelector({ send, C }) {
  const [selCat, setSelCat] = useState("Europe");
  const COMPS = {
    "Europe": [
      ["🏆 UCL","Champions League","Analyse un match de Champions League. Effectue 6 recherches web : forme récente, blessés, H2H, corners, tirs cadrés, cartons. JSON strict."],
      ["🟠 EL","Europa League","Analyse un match d'Europa League. Recherche forme, blessés, H2H, stats. JSON strict."],
      ["🔵 ECL","Conference League","Analyse un match de Conference League. Web search complet. JSON strict."],
    ],
    "Intl": [
      ["🌍 WC","Coupe du Monde","Analyse un match de Coupe du Monde FIFA. Web search : forme, blessés, H2H, stats défensives. JSON strict."],
      ["🇪🇺 EURO","EURO","Analyse un match du Championnat d'Europe UEFA. Web search complet. JSON strict."],
      ["🌍 CAN","CAN","Analyse un match de la Coupe d'Afrique des Nations. Web search. JSON strict."],
      ["🌎 Copa","Copa América","Analyse un match de Copa América. Web search complet. JSON strict."],
      ["🌍 LDN","Ligue des Nations","Analyse un match de Ligue des Nations UEFA. Web search. JSON strict."],
      ["🌍 WCQ","Qualif. WC","Analyse un match de qualification Coupe du Monde. Web search. JSON strict."],
      ["🌍 WCAN","Qualif. CAN","Analyse un match de qualification CAN. Web search. JSON strict."],
      ["🌍 WEURO","Qualif. EURO","Analyse un match de qualification EURO. Web search. JSON strict."],
      ["🌍 GC","Gold Cup","Analyse un match de Gold Cup CONCACAF. Web search. JSON strict."],
      ["🏅 OL","JO Football","Analyse un match de football aux Jeux Olympiques. Web search. JSON strict."],
    ],
    "🤝 Amicaux": [
      ["🌍 AI","Amical Pays","Analyse ce match amical international entre sélections nationales. Web search : forme récente, compositions probables, blessés, H2H. IMPORTANT : c'est un amical — tiens compte des rotations probables, de la motivation réduite et des tests tactiques du coach. meta.competition='Amical International'. JSON strict."],
      ["🏟️ AC","Amical Clubs","Analyse ce match amical entre clubs. Web search : forme, effectif, objectifs de préparation. IMPORTANT : amical de clubs — titulaires souvent ménagés, rotations fréquentes, résultats moins prévisibles. meta.competition='Amical Club'. JSON strict."],
      ["🏆 SC","Supercoupe","Analyse ce match de Supercoupe (nationale ou UEFA). Web search complet. JSON strict."],
      ["🏟️ TR","Tournoi amical","Analyse ce match de tournoi amical ou de préparation estivale. Web search. JSON strict."],
    ],
    "🇫🇷": [
      ["🇫🇷 L1","Ligue 1","Analyse un match important de Ligue 1. Web search : forme 10 matchs, blessés, H2H. JSON strict."],
      ["🇫🇷 L2","Ligue 2","Analyse un match de Ligue 2 française. Web search complet. JSON strict."],
      ["🇫🇷 CDL","Coupe de France","Analyse un match de Coupe de France. Web search. JSON strict."],
    ],
    "🇬🇧": [
      ["🇬🇧 PL","Premier League","Analyse un match de Premier League. Web search complet : forme, blessés, H2H, stats. JSON strict."],
      ["🇬🇧 EFL","Championship","Analyse un match de Championship anglais. Web search. JSON strict."],
      ["🇬🇧 FA","FA Cup","Analyse un match de FA Cup. Web search. JSON strict."],
    ],
    "🇪🇸": [
      ["🇪🇸 Liga","La Liga","Analyse un match de La Liga espagnole. Web search complet. JSON strict."],
      ["🇪🇸 L2","La Liga 2","Analyse un match de La Liga 2. Web search. JSON strict."],
      ["🇪🇸 CR","Copa del Rey","Analyse un match de Copa del Rey. Web search. JSON strict."],
    ],
    "🇩🇪": [
      ["🇩🇪 BL","Bundesliga","Analyse un match de Bundesliga allemande. Web search complet. JSON strict."],
      ["🇩🇪 BL2","Bundesliga 2","Analyse un match de 2. Bundesliga. Web search. JSON strict."],
      ["🇩🇪 DFB","DFB Pokal","Analyse un match de DFB Pokal. Web search. JSON strict."],
    ],
    "🇮🇹": [
      ["🇮🇹 SA","Serie A","Analyse un match de Serie A italienne. Web search complet. JSON strict."],
      ["🇮🇹 SB","Serie B","Analyse un match de Serie B. Web search. JSON strict."],
      ["🇮🇹 CP","Coppa Italia","Analyse un match de Coppa Italia. Web search. JSON strict."],
    ],
    "🇵🇹": [
      ["🇵🇹 PL","Primeira Liga","Analyse un match de Primeira Liga portugaise. Web search. JSON strict."],
    ],
    "🇳🇱": [
      ["🇳🇱 ED","Eredivisie","Analyse un match d'Eredivisie néerlandaise. Web search complet. JSON strict."],
      ["🇳🇱 E1","Eerste Divisie","Analyse un match d'Eerste Divisie. Web search. JSON strict."],
    ],
    "🇸🇦": [
      ["🇸🇦 SPL","Saudi Pro League","Analyse un match de Saudi Pro League. Web search complet. JSON strict."],
      ["🇸🇦 KC","King Cup","Analyse un match de King Cup Arabie Saoudite. Web search. JSON strict."],
    ],
    "🌎 Am.": [
      ["🌎 MLS","MLS","Analyse un match de Major League Soccer. Web search complet. JSON strict."],
      ["🌎 Liga MX","Liga MX","Analyse un match de Liga MX mexicaine. Web search. JSON strict."],
      ["🌎 LPA","Liga Profesional","Analyse un match de Liga Profesional Argentine. Web search. JSON strict."],
      ["🌎 CB","Brasileirao","Analyse un match de Série A brésilienne. Web search. JSON strict."],
      ["🌎 CL","Copa Lib.","Analyse un match de Copa Libertadores. Web search. JSON strict."],
      ["🌎 CS","Copa Sud.","Analyse un match de Copa Sudamericana. Web search. JSON strict."],
    ],
    "🌍 Autres": [
      ["🇹🇷 SL","Süper Lig","Analyse un match de Süper Lig turque. Web search. JSON strict."],
      ["🇷🇺 RPL","RPL","Analyse un match de Premier League russe. Web search. JSON strict."],
      ["🇯🇵 JL","J-League","Analyse un match de J-League japonaise. Web search. JSON strict."],
      ["🇨🇳 CSL","CSL","Analyse un match de Chinese Super League. Web search. JSON strict."],
      ["🇦🇺 AL","A-League","Analyse un match d'A-League australienne. Web search. JSON strict."],
      ["🇿🇦 PSL","PSL","Analyse un match de Premier Soccer League sud-africaine. Web search. JSON strict."],
      ["🇧🇪 JPL","Pro League","Analyse un match de Jupiler Pro League belge. Web search. JSON strict."],
      ["🇨🇭 SSL","Super League","Analyse un match de Super League suisse. Web search. JSON strict."],
      ["🇬🇷 SL","Super League","Analyse un match de Super League grecque. Web search. JSON strict."],
      ["🇸🇪 AL","Allsvenskan","Analyse un match d'Allsvenskan suédoise. Web search. JSON strict."],
    ],
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5, width:"100%" }}>
      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
        {Object.keys(COMPS).map(cat => (
          <button key={cat} onClick={() => setSelCat(cat)} style={{ padding:"2px 8px", borderRadius:8, border:`1px solid ${selCat===cat ? C.acc : C.bdr}`, background: selCat===cat ? `${C.acc}18` : "transparent", color: selCat===cat ? C.acc : C.muted, fontSize:9, cursor:"pointer", fontFamily:"'DM Mono', monospace", letterSpacing:0.5, transition:"all .15s" }}>{cat}</button>
        ))}
      </div>
      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
        {(COMPS[selCat]||[]).map(([l,,m]) => (
          <button key={l} onClick={() => send(m)} style={{ padding:"3px 9px", borderRadius:9, border:`1px solid ${C.bdr}`, background:"transparent", color:"#555", fontSize:9.5, cursor:"pointer", fontFamily:"'DM Mono', monospace", transition:"all .2s", whiteSpace:"nowrap" }}>{l}</button>
        ))}
      </div>
    </div>
  );
}


// ── Feedback Score Réel ───────────────────────────────────────
function FeedbackBox({ msgIndex, prediction, meta, onSave, C }) {
  const [r1, setR1] = useState("");
  const [r2, setR2] = useState("");
  const [saved, setSaved] = useState(false);

  if (saved) return (
    <div style={{ marginTop:8, padding:"7px 12px", background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:7, display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ fontSize:11, color:"#22c55e" }}>✅ Score réel enregistré</span>
      <span style={{ fontSize:10, color:"#3a4848", fontFamily:"'DM Mono', monospace" }}>
        Prédit: {prediction?.score1}-{prediction?.score2} · Réel: {r1}-{r2}
        {prediction?.score1 === parseInt(r1) && prediction?.score2 === parseInt(r2)
          ? " 🎯 Score exact !"
          : (prediction?.score1 > prediction?.score2) === (parseInt(r1) > parseInt(r2)) || (prediction?.score1 === prediction?.score2) === (parseInt(r1) === parseInt(r2))
          ? " ✓ Vainqueur correct"
          : " ✗ Prédiction incorrecte"}
      </span>
    </div>
  );

  return (
    <div style={{ marginTop:8, padding:"9px 12px", background:"rgba(0,212,170,0.04)", border:"1px solid rgba(0,212,170,0.12)", borderRadius:7 }}>
      <div style={{ fontSize:9, color:"#00D4AA", letterSpacing:1.5, marginBottom:7, fontFamily:"'DM Mono', monospace" }}>
        📝 SCORE RÉEL — Aide Arnold à apprendre
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:9, color:"#3a4848", fontFamily:"'DM Mono', monospace", minWidth:60, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{meta?.team1?.slice(0,8)}</span>
        <input
          value={r1} onChange={e => setR1(e.target.value)}
          type="number" min="0" max="30" placeholder="0"
          style={{ width:42, padding:"5px 0", textAlign:"center", background:"#090c0e", border:"1px solid #192022", borderRadius:5, color:"#3B82F6", fontSize:16, fontWeight:900, fontFamily:"'DM Mono', monospace" }}
        />
        <span style={{ color:"#1a2a2a", fontSize:14, fontWeight:900 }}>–</span>
        <input
          value={r2} onChange={e => setR2(e.target.value)}
          type="number" min="0" max="30" placeholder="0"
          style={{ width:42, padding:"5px 0", textAlign:"center", background:"#090c0e", border:"1px solid #192022", borderRadius:5, color:"#EF4444", fontSize:16, fontWeight:900, fontFamily:"'DM Mono', monospace" }}
        />
        <span style={{ fontSize:9, color:"#3a4848", fontFamily:"'DM Mono', monospace", minWidth:60, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{meta?.team2?.slice(0,8)}</span>
        <button
          onClick={() => {
            if (r1 === "" || r2 === "") return;
            onSave(msgIndex, parseInt(r1), parseInt(r2), meta);
            setSaved(true);
          }}
          disabled={r1 === "" || r2 === ""}
          style={{ marginLeft:"auto", padding:"5px 12px", borderRadius:5, border:"none", background: r1===""||r2==="" ? "#141414" : "linear-gradient(135deg,#00D4AA,#0077FF)", color:"#fff", fontSize:9.5, fontWeight:800, cursor: r1===""||r2==="" ? "not-allowed":"pointer", fontFamily:"'DM Mono', monospace", letterSpacing:1 }}
        >VALIDER</button>
      </div>
      <div style={{ fontSize:8.5, color:"#2a3838", marginTop:5, fontFamily:"'Crimson Pro', serif", fontStyle:"italic" }}>
        Prédit : {prediction?.score1 ?? "?"} – {prediction?.score2 ?? "?"} · Saisis le vrai résultat pour améliorer les prochaines analyses
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
  const [fcMode, setFcMode] = useState("FC26_5v5");
  const [fcT1, setFcT1] = useState("");
  const [fcT2, setFcT2] = useState("");
  const [fcS1, setFcS1] = useState("");
  const [fcS2, setFcS2] = useState("");
  const [fcRealS1, setFcRealS1] = useState("");
  const [fcRealS2, setFcRealS2] = useState("");
  const [fcLastPred, setFcLastPred] = useState(null); // { score1, score2, t1, t2, mode }
  const [fcFeedbackSaved, setFcFeedbackSaved] = useState(false);
  const [fcHist, setFcHist] = useState({ FC24_4v4: [], FC26_5v5: [], FC25_3v3: [] });
  const [adminPrompts, setAdminPrompts] = useState([]);
  const [pName, setPName] = useState("");
  const [pContent, setPContent] = useState("");
  // Clé API intégrée — pas besoin de la saisir
  const endRef = useRef(null);
  const [feedbacks, setFeedbacks] = useState({});

  const saveFeedbackResult = (msgIndex, real1, real2, meta) => {
    const key = `${msgIndex}`;
    setFeedbacks(prev => ({ ...prev, [key]: { real1, real2, meta } }));
    // Stocker dans localStorage pour apprentissage futur
    try {
      const stored = JSON.parse(localStorage.getItem("arnold_feedback") || "[]");
      stored.unshift({
        date: new Date().toISOString().slice(0,10),
        team1: meta?.team1, team2: meta?.team2,
        competition: meta?.competition, mode: meta?.mode,
        real1, real2,
      });
      localStorage.setItem("arnold_feedback", JSON.stringify(stored.slice(0, 500)));
    } catch {}
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  useEffect(() => {
    const ctx = getLiveContext();
    setMsgs([{ role: "intro", parsed: { type: "chat", message: `Bonjour ! Je suis ARNOLD ⚽\n\n📅 Nous sommes le ${ctx.dateFR} — Saison ${ctx.footballSeason}\n\nMon contexte temporel est injecté à chaque requête. Je suis toujours à jour, peu importe quand tu me consultes.\n\nWeb search ciblé sur :\n🔄 Forme récente (10 derniers matchs)\n🚑 Blessés & suspendus actuels\n🤝 Confrontations directes (H2H)\n🔁 Transferts & absences récents\n\nStats générales, tactique et prédiction : modèle interne.\n\nQuel match analyser ?` } }]);
  }, []);


  const send = useCallback(async (override) => {
    const text = override || input.trim();
    if (!text || loading) return;

    setInput("");
    setMsgs(prev => [...prev, { role: "user", content: text, parsed: { type: "chat", message: text } }, { role: "typing" }]);
    setLoading(true);
    try {
      const system = buildSystem(adminPrompts, agent);
      const hist = [...msgs.filter(m => (m.role === "user" || m.role === "assistant") && m.content).map(m => ({ role: m.role, content: m.content })), { role: "user", content: text }];
      const raw = await callArnold(hist, system);
      const parsed = parseJSON(raw);
      if (tab === "fc" && fcT1 && fcT2 && parsed?.prediction) {
        const newEntry = { t1: fcT1, t2: fcT2, s1: parsed.prediction.score1 ?? 0, s2: parsed.prediction.score2 ?? 0, id: Date.now() };
        setFcHist(prev => ({ ...prev, [fcMode]: [...prev[fcMode], newEntry] }));
        setFcLastPred({ score1: parsed.prediction.score1, score2: parsed.prediction.score2, t1: fcT1, t2: fcT2, mode: fcMode, entryId: newEntry.id });
        setFcRealS1(""); setFcRealS2(""); setFcFeedbackSaved(false);
      }
      setMsgs(prev => [...prev.filter(m => m.role !== "typing"), { role: "assistant", content: raw, parsed }]);
    } catch (err) {
      const errorMsg = err.message || "Erreur inconnue lors de l'appel à l'IA";
      setMsgs(prev => [...prev.filter(m => m.role !== "typing"), { role: "assistant", content: "", parsed: { type: "chat", message: `⚠️ ${errorMsg}` } }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, adminPrompts, agent, tab, fcT1, fcT2, fcMode, msgs]);



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
            {/* Selector compétition */}
            <CompSelector send={send} C={C} />
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {msg.parsed && <AnalysisCard data={msg.parsed} />}
                    {/* Feedback score réel — uniquement pour les analyses (pas intro, pas multi) */}
                    {msg.role === "assistant" && msg.parsed?.type === "analysis" && msg.parsed?.prediction && (
                      <FeedbackBox
                        msgIndex={i}
                        prediction={msg.parsed.prediction}
                        meta={msg.parsed.meta}
                        onSave={saveFeedbackResult}
                        C={C}
                      />
                    )}
                    {/* Multi-matchs : feedback pour chaque match */}
                    {msg.role === "assistant" && msg.parsed?.type === "multi" && (
                      <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:4 }}>
                        {msg.parsed.analyses.map((analysis, ai) => analysis.prediction && (
                          <FeedbackBox
                            key={ai}
                            msgIndex={`${i}_${ai}`}
                            prediction={analysis.prediction}
                            meta={analysis.meta}
                            onSave={saveFeedbackResult}
                            C={C}
                          />
                        ))}
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
              {/* Score réel FC — visible après une prédiction */}
              {fcLastPred && !fcFeedbackSaved && (
                <div style={{ padding:"10px 12px", background:"rgba(0,212,170,0.05)", border:"1px solid rgba(0,212,170,0.2)", borderRadius:8, marginBottom:10 }}>
                  <div style={{ fontSize:9, color:"#00D4AA", letterSpacing:1.5, marginBottom:7, fontFamily:"'DM Mono', monospace" }}>
                    📝 SCORE RÉEL — Arnold apprend
                  </div>
                  <div style={{ fontSize:8.5, color:"#3a4848", marginBottom:6, fontFamily:"'DM Mono', monospace" }}>
                    Prédit : {fcLastPred.score1}–{fcLastPred.score2} · {fcLastPred.t1} vs {fcLastPred.t2}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <input
                      value={fcRealS1} onChange={e=>setFcRealS1(e.target.value)}
                      type="number" min="0" max="99" placeholder="0"
                      style={{ width:46, padding:"5px 0", textAlign:"center", background:"#090c0e", border:"1px solid #192022", borderRadius:5, color:"#3B82F6", fontSize:16, fontWeight:900, fontFamily:"'DM Mono', monospace" }}
                    />
                    <span style={{ color:"#1a2a2a", fontSize:14, fontWeight:900 }}>–</span>
                    <input
                      value={fcRealS2} onChange={e=>setFcRealS2(e.target.value)}
                      type="number" min="0" max="99" placeholder="0"
                      style={{ width:46, padding:"5px 0", textAlign:"center", background:"#090c0e", border:"1px solid #192022", borderRadius:5, color:"#EF4444", fontSize:16, fontWeight:900, fontFamily:"'DM Mono', monospace" }}
                    />
                    <button
                      onClick={() => {
                        if (fcRealS1 === "" || fcRealS2 === "") return;
                        const r1 = parseInt(fcRealS1), r2 = parseInt(fcRealS2);
                        // Mettre à jour l'entrée dans fcHist avec le vrai score
                        setFcHist(prev => {
                          const hist = [...(prev[fcLastPred.mode] || [])];
                          const idx = hist.findIndex(h => h.id === fcLastPred.entryId);
                          if (idx !== -1) {
                            hist[idx] = { ...hist[idx], realS1: r1, realS2: r2,
                              exact: hist[idx].s1 === r1 && hist[idx].s2 === r2,
                              winnerOk: (hist[idx].s1 > hist[idx].s2) === (r1 > r2) && !(hist[idx].s1 === hist[idx].s2 && r1 !== r2)
                            };
                          }
                          return { ...prev, [fcLastPred.mode]: hist };
                        });
                        setFcFeedbackSaved(true);
                      }}
                      disabled={fcRealS1 === "" || fcRealS2 === ""}
                      style={{ marginLeft:"auto", padding:"6px 14px", borderRadius:5, border:"none", background: fcRealS1===""||fcRealS2==="" ? "#141414" : "linear-gradient(135deg,#00D4AA,#0077FF)", color:"#fff", fontSize:9.5, fontWeight:800, cursor: fcRealS1===""||fcRealS2==="" ? "not-allowed":"pointer", fontFamily:"'DM Mono', monospace" }}
                    >✓ VALIDER</button>
                  </div>
                </div>
              )}
              {fcFeedbackSaved && fcLastPred && (
                <div style={{ padding:"8px 12px", background:"rgba(34,197,94,0.07)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:8, marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:13 }}>
                    {fcLastPred.score1 === parseInt(fcRealS1) && fcLastPred.score2 === parseInt(fcRealS2) ? "🎯" : (fcLastPred.score1 > fcLastPred.score2) === (parseInt(fcRealS1) > parseInt(fcRealS2)) ? "✓" : "✗"}
                  </span>
                  <span style={{ fontSize:9.5, color:"#22c55e", fontFamily:"'DM Mono', monospace" }}>
                    Score enregistré — Arnold apprend de ce résultat
                  </span>
                </div>
              )}
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