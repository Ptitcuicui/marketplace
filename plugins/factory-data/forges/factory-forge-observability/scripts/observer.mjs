#!/usr/bin/env node
// observer — exécute les sondes d'un plan d'observation et APPEND un snapshot horodaté
// en JSONL (append-only, seq croissant — contrat ledger, même esprit que journal.jsonl
// de forge-ops). Ne compare rien : la comparaison est le rôle de derive.mjs.
//
// Format déclaratif consommé : forge-observability/plan@1
// {
//   "format": "forge-observability/plan@1",
//   "nom": "<identifiant du plan>",
//   "sondes": [
//     { "nom": "<identifiant unique>", "type": "commande", "cadence": "<libre, doc>",
//       "commande": ["node", "chemin/script.mjs", "arg"...],
//       "champ_valeur": "<chemin.pointe dans le JSON stdout, optionnel>",
//       "seuils": { "max": N } | { "min": N } | { "max_delta": N } (combinables) },
//
//     { "nom": "<identifiant unique>", "type": "oracle_externe", "cadence": "<libre, doc>",
//       "commande": ["node", "<CHEMIN PARAMÉTRÉ, jamais codé en dur>", "arg", "--json-only"] },
//       // capture le contrat {verdict, findings[], ...} d'un oracle tiers (ex. oracle-profiler
//       // de forge-data) — la dérive de verdict ou de compteurs de findings est le signal.
//
//     { "nom": "<identifiant unique>", "type": "rapport_json", "cadence": "<libre, doc>",
//       "fichier": "chemin/rapport.json",
//       "champs": ["chemin.pointe.un", "chemin.pointe.deux"],
//       "seuils": { "chemin.pointe.un": { "max_delta": 3 } } },
//
//     { "nom": "<identifiant unique>", "type": "manuel", "cadence": "<libre, doc>",
//       "fichier": "chemin/consignation-manuelle.json", "champ_valeur": "<chemin>" }
//       // aucune automatisation : lit une valeur qu'un humain a consignée (veille citation
//       // IA, TF-0112 volet 4) — le format est snapshot-compatible, la collecte ne l'est pas.
//
//     { "nom": "<identifiant unique>", "type": "job_planifie", "cadence": "<libre, doc>",
//       "commande": ["node", "chemin/script.mjs"...]   // OU  "fichier": "chemin/etat-du-job.json",
//       "champs": { "dernier_passage": "<chemin ISO 8601>", "erreur": "<chemin, null si sain>",
//                   "indicateur": "<chemin, nombre d'éléments qui ont une issue>",
//                   "population": "<chemin, nombre d'éléments qui devraient en avoir une>" },
//       "max_age_heures": N }
//       // TF-2767 : un job planifié expose son dernier passage (heure, bilan, erreur) et
//       // l'indicateur qu'il alimente ; derive.mjs lève une dérive bloquante quand le job est
//       // muet, en échec, ou que l'indicateur est vide sur une population non vide.
//   ]
// }
//
// « cadence » est une annotation documentaire en v0 : observer.mjs exécute une fois, au
// déclenchement (par le pilot ou une tâche planifiée externe) — aucun scheduler interne.
//
// Contrat de sortie : {verbe:"observer", plan, verdict, findings, non_juge} · exit 0/1/2.
//   0 = toutes les sondes exécutées sans erreur (verdict OK)
//   1 = au moins une sonde en erreur d'exécution (verdict PARTIEL) — le snapshot est quand
//       même appendu (l'erreur elle-même est une observation, jamais un silence)
//   2 = plan illisible/invalide — rien n'est appendu
//
// Usage : node observer.mjs <plan.json> <snapshots.jsonl> [--json-only]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const TYPES_CONNUS = ["commande", "oracle_externe", "rapport_json", "manuel", "job_planifie"];
const ROLES_JOB = ["dernier_passage", "erreur", "indicateur", "population"];
const NON_JUGE = [
  "l'ordonnancement réel des cadences déclarées (quotidienne, par_commit...) — v0 exécute au déclenchement, aucun scheduler interne",
  "la pertinence métier des seuils choisis par l'humain dans le plan",
  "la dérive entre deux snapshots — rôle de derive.mjs, jamais de observer.mjs",
  "la véracité d'une valeur consignée manuellement (type manuel) — observer.mjs la transporte, ne la vérifie pas",
];

const args = process.argv.slice(2);
const planPath = args[0];
const snapPath = args[1];
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });

function sortir(verdict, code) {
  process.stdout.write(JSON.stringify({
    verbe: "observer", plan: planPath || null, verdict,
    findings: F.length ? F : [{ sev: "info", regle: "—", msg: "toutes les sondes exécutées sans erreur", where: planPath }],
    non_juge: NON_JUGE,
  }, null, jsonOnly ? 0 : 2));
  process.exit(code);
}

if (!planPath || !fs.existsSync(planPath)) { add("bloquant", "plan", "fichier de plan introuvable", String(planPath)); sortir("ECHEC", 2); }
if (!snapPath) { add("bloquant", "plan", "fichier de snapshots (destination) manquant en argument 2", "—"); sortir("ECHEC", 2); }

let plan = null;
try { plan = JSON.parse(fs.readFileSync(planPath, "utf8")); }
catch { add("bloquant", "plan", "JSON de plan invalide", planPath); sortir("ECHEC", 2); }

if (plan.format !== "forge-observability/plan@1")
  add("bloquant", "plan", `format « ${plan.format} » (attendu forge-observability/plan@1)`, planPath);
if (!Array.isArray(plan.sondes) || !plan.sondes.length)
  add("bloquant", "plan", "liste de sondes absente ou vide", planPath);
else {
  const noms = new Set();
  for (const s of plan.sondes) {
    if (!s.nom) { add("bloquant", "plan", "sonde sans nom", JSON.stringify(s)); continue; }
    if (noms.has(s.nom)) add("bloquant", "plan", `nom de sonde dupliqué « ${s.nom} »`, s.nom);
    noms.add(s.nom);
    if (!TYPES_CONNUS.includes(s.type))
      add("bloquant", "plan", `type « ${s.type} » hors du jeu connu {${TYPES_CONNUS.join(", ")}}`, s.nom);
    if ((s.type === "commande" || s.type === "oracle_externe") && (!Array.isArray(s.commande) || !s.commande.length))
      add("bloquant", "plan", "sonde exécutable sans « commande » (tableau non vide attendu)", s.nom);
    if ((s.type === "rapport_json" || s.type === "manuel") && !s.fichier)
      add("bloquant", "plan", "sonde de lecture sans « fichier »", s.nom);
    if (s.type === "rapport_json" && (!Array.isArray(s.champs) || !s.champs.length))
      add("bloquant", "plan", "sonde rapport_json sans « champs » (tableau non vide attendu)", s.nom);
    if (s.type === "job_planifie") {
      const hasCmd = Array.isArray(s.commande) && s.commande.length > 0;
      if (hasCmd === !!s.fichier)
        add("bloquant", "plan", "sonde job_planifie : « commande » (tableau non vide) OU « fichier » attendu, un seul des deux", s.nom);
      const manquants = ROLES_JOB.filter(r => !s.champs || typeof s.champs[r] !== "string" || !s.champs[r]);
      if (manquants.length)
        add("bloquant", "plan", `sonde job_planifie sans chemin déclaré pour : ${manquants.join(", ")} (« champs » = objet de ${ROLES_JOB.length} chemins)`, s.nom);
      if (typeof s.max_age_heures !== "number" || !(s.max_age_heures > 0))
        add("bloquant", "plan", "sonde job_planifie sans « max_age_heures » (nombre > 0 attendu : aucun délai par défaut)", s.nom);
    }
  }
}
if (F.some(f => f.sev === "bloquant")) sortir("ECHEC", 2);

const getChemin = (obj, chemin) => chemin.split(".").reduce((o, k) => (o && typeof o === "object" && k in o) ? o[k] : undefined, obj);

function executerSonde(s) {
  const base = { nom: s.nom, type: s.type, ok: true };
  try {
    if (s.type === "commande" || s.type === "oracle_externe") {
      const r = spawnSync(s.commande[0], s.commande.slice(1), { encoding: "utf8", timeout: 30000 });
      if (r.error) return { ...base, ok: false, erreur: `échec de lancement : ${r.error.message}` };
      let doc = null;
      try { doc = JSON.parse(r.stdout); } catch { return { ...base, ok: false, erreur: `stdout non-JSON (exit ${r.status})`, brut: (r.stdout || r.stderr || "").slice(0, 300) }; }
      if (s.type === "oracle_externe") {
        const findings = Array.isArray(doc.findings) ? doc.findings : [];
        const compteurs = { bloquant: 0, majeur: 0, mineur: 0, info: 0 };
        for (const f of findings) if (compteurs[f.sev] !== undefined) compteurs[f.sev]++;
        return { ...base, verdict: doc.verdict ?? null, compteurs };
      }
      const valeur = s.champ_valeur ? getChemin(doc, s.champ_valeur) : doc;
      return { ...base, valeur };
    }
    if (s.type === "job_planifie") {
      let doc = null;
      if (s.commande) {
        const r = spawnSync(s.commande[0], s.commande.slice(1), { encoding: "utf8", timeout: 30000 });
        if (r.error) return { ...base, ok: false, erreur: `échec de lancement : ${r.error.message}` };
        try { doc = JSON.parse(r.stdout); } catch { return { ...base, ok: false, erreur: `stdout non-JSON (exit ${r.status})`, brut: (r.stdout || r.stderr || "").slice(0, 300) }; }
      } else {
        if (!fs.existsSync(s.fichier)) return { ...base, ok: false, erreur: "fichier introuvable" };
        try { doc = JSON.parse(fs.readFileSync(s.fichier, "utf8")); } catch { return { ...base, ok: false, erreur: "fichier non-JSON" }; }
      }
      const lu = Object.fromEntries(ROLES_JOB.map(r => [r, getChemin(doc, s.champs[r])]));
      // une clé absente n'est pas une clé à null : l'absence est le défaut que la sonde cherche (le job n'expose pas son passage)
      const absents = ROLES_JOB.filter(r => lu[r] === undefined);
      if (absents.length) return { ...base, ok: false, erreur: `le job n'expose pas : ${absents.map(r => `${r} (${s.champs[r]})`).join(", ")}` };
      if (typeof lu.population !== "number") return { ...base, ok: false, erreur: `population non numérique (${s.champs.population})` };
      if (lu.indicateur !== null && typeof lu.indicateur !== "number") return { ...base, ok: false, erreur: `indicateur ni nombre ni null (${s.champs.indicateur})` };
      return { ...base, ...lu };
    }
    if (s.type === "rapport_json" || s.type === "manuel") {
      if (!fs.existsSync(s.fichier)) return { ...base, ok: false, erreur: "fichier introuvable" };
      let doc = null;
      try { doc = JSON.parse(fs.readFileSync(s.fichier, "utf8")); } catch { return { ...base, ok: false, erreur: "fichier non-JSON" }; }
      if (s.type === "manuel") {
        const valeur = s.champ_valeur ? getChemin(doc, s.champ_valeur) : doc;
        return { ...base, valeur };
      }
      const valeurs = {};
      for (const c of s.champs) valeurs[c] = getChemin(doc, c);
      return { ...base, valeurs };
    }
    return { ...base, ok: false, erreur: `type inconnu « ${s.type} »` };
  } catch (e) {
    return { ...base, ok: false, erreur: String(e.message || e) };
  }
}

const resultats = plan.sondes.map(executerSonde);
for (const r of resultats) if (r.ok === false) add("majeur", "exécution", `sonde « ${r.nom} » en erreur : ${r.erreur}`, r.nom);

// ── seq croissant depuis 1 (contrat ledger) ─────────────────────────────────
let seq = 1;
if (fs.existsSync(snapPath)) {
  const lignes = fs.readFileSync(snapPath, "utf8").split("\n").filter(Boolean);
  if (lignes.length) {
    try { seq = (JSON.parse(lignes[lignes.length - 1]).seq ?? 0) + 1; } catch { seq = lignes.length + 1; }
  }
}

const snapshot = { seq, ts: new Date().toISOString(), plan: plan.nom ?? path.basename(planPath), sondes: resultats };
fs.mkdirSync(path.dirname(path.resolve(snapPath)), { recursive: true });
fs.appendFileSync(snapPath, JSON.stringify(snapshot) + "\n", "utf8");

sortir(F.some(f => f.sev === "majeur") ? "PARTIEL" : "OK", F.some(f => f.sev === "majeur") ? 1 : 0);
