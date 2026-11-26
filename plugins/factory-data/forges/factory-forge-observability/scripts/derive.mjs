#!/usr/bin/env node
// derive — compare deux snapshots d'un même plan (le dernier vs N-1 par défaut) et rend
// les dérives par sonde. C'est le SEUL script qui juge ; observer.mjs ne fait qu'observer.
//
// Trois classes de dérive détectées :
//   - apparition   : sonde présente dans le nouveau snapshot, absente de l'ancien (info —
//                    une nouvelle sonde n'est pas en soi un défaut) ;
//   - disparition  : sonde présente dans l'ancien, absente du nouveau (bloquant — une sonde
//                    qui cesse silencieusement de tourner est exactement l'angle mort que
//                    cette forge existe pour combler, loi transverse « toute affordance est
//                    câblée ou n'existe pas ») ;
//   - franchissement de seuil : selon le type de sonde —
//       commande/manuel   : la valeur scalaire (ou son delta) franchit min/max/max_delta ;
//       rapport_json      : chaque champ suivi franchit son propre seuil (chemin → seuil) ;
//       oracle_externe    : le verdict régresse (PASS→autre chose) ou un compteur de
//                           findings (bloquant/majeur) augmente.
//   - une sonde passée de ok:true à ok:false entre les deux snapshots est aussi une dérive
//     (bloquant) : l'observation elle-même s'est cassée.
//   - job_planifie (TF-2767) : jugement d'état du dernier snapshot — job illisible, en échec,
//     muet (dernier passage plus vieux que max_age_heures), ou indicateur vide sur une
//     population non vide (tous bloquants).
//
// Contrat de sortie : {oracle:"derive", domaine, artefact, verdict, findings, non_juge}.
//   PASS (exit 0)                : aucune dérive.
//   FAIL (exit 1)                : au moins une dérive.
//   donnees_insuffisantes (exit 2): moins de deux snapshots disponibles, ou plan/fichier illisible.
//
// Usage : node derive.mjs <plan.json> <snapshots.jsonl> [--index N] [--json-only]
//   --index N : compare le dernier snapshot au snapshot N crans plus tôt (défaut 1, soit N-1).
import fs from "node:fs";

const DOM = "Observabilité continue : dérive entre deux snapshots d'un plan";
const NON_JUGE = [
  "la cause de la dérive (déploiement légitime, incident, dérive silencieuse) — un constat, jamais un diagnostic",
  "la correction de la dérive — cette forge observe et alerte, ne corrige jamais (doctrine TF-0112)",
  "la pertinence des seuils choisis par l'humain dans le plan",
  "l'exhaustivité des sondes déclarées — une sonde absente du plan n'est jugée par personne",
  "l'exactitude de ce qu'un job planifié déclare (sonde job_planifie) : seuls son passage, son erreur et le vide de son indicateur sont jugés",
];

const args = process.argv.slice(2);
const planPath = args[0];
const snapPath = args[1];
const jsonOnly = args.includes("--json-only");
const iIdx = args.indexOf("--index");
const n = iIdx >= 0 ? Number(args[iIdx + 1]) : 1;

const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });

function sortir(verdict, code, artefact) {
  process.stdout.write(JSON.stringify({
    oracle: "derive", domaine: DOM, artefact: artefact ?? snapPath ?? null, verdict,
    findings: F.length ? F : [{ sev: "info", regle: "—", msg: "aucune dérive entre les deux snapshots comparés", where: snapPath }],
    non_juge: NON_JUGE,
  }, null, jsonOnly ? 0 : 2));
  process.exit(code);
}

if (!planPath || !fs.existsSync(planPath)) { add("bloquant", "—", "plan introuvable", String(planPath)); sortir("donnees_insuffisantes", 2, planPath); }
let plan = null;
try { plan = JSON.parse(fs.readFileSync(planPath, "utf8")); } catch { add("bloquant", "—", "plan illisible (JSON invalide)", planPath); sortir("donnees_insuffisantes", 2, planPath); }
const seuilsParSonde = Object.fromEntries((plan.sondes || []).map(s => [s.nom, s]));

if (!snapPath || !fs.existsSync(snapPath)) { add("bloquant", "—", "fichier de snapshots introuvable", String(snapPath)); sortir("donnees_insuffisantes", 2, snapPath); }

const lignes = fs.readFileSync(snapPath, "utf8").split("\n").filter(Boolean);
const snapshots = [];
for (let i = 0; i < lignes.length; i++) {
  try { snapshots.push(JSON.parse(lignes[i])); }
  catch { add("bloquant", "ledger", `ligne ${i + 1} du journal de snapshots : JSON invalide`, `${snapPath}:${i + 1}`); }
}
if (F.some(f => f.sev === "bloquant")) sortir("donnees_insuffisantes", 2, snapPath);

let attendu = 1;
for (const s of snapshots) {
  if (s.seq !== attendu) add("bloquant", "ledger", `seq ${s.seq}, attendu ${attendu} (append-only rompu)`, snapPath);
  attendu = (s.seq ?? attendu) + 1;
}
if (F.some(f => f.sev === "bloquant")) sortir("donnees_insuffisantes", 2, snapPath);

if (snapshots.length < 2) { add("info", "—", `${snapshots.length} snapshot(s) disponible(s) — deux au minimum requis pour une dérive`, snapPath); sortir("donnees_insuffisantes", 2, snapPath); }
if (n < 1 || n >= snapshots.length) { add("bloquant", "—", `--index ${n} hors bornes (${snapshots.length} snapshots disponibles)`, snapPath); sortir("donnees_insuffisantes", 2, snapPath); }

const neuf = snapshots[snapshots.length - 1];
const ancien = snapshots[snapshots.length - 1 - n];
const artefact = `${snapPath} (seq ${ancien.seq} → seq ${neuf.seq})`;

const parNom = arr => Object.fromEntries((arr || []).map(s => [s.nom, s]));
const sondesAnciennes = parNom(ancien.sondes);
const sondesNeuves = parNom(neuf.sondes);
const tousLesNoms = new Set([...Object.keys(sondesAnciennes), ...Object.keys(sondesNeuves)]);

function verifierSeuil(sonde, chemin, ancienneValeur, nouvelleValeur, seuil) {
  if (!seuil || typeof nouvelleValeur !== "number") return;
  const ou = chemin ? `${sonde} · ${chemin}` : sonde;
  if (typeof seuil.max === "number" && nouvelleValeur > seuil.max)
    add("bloquant", "seuil", `${ou} = ${nouvelleValeur} > max ${seuil.max}`, ou);
  if (typeof seuil.min === "number" && nouvelleValeur < seuil.min)
    add("bloquant", "seuil", `${ou} = ${nouvelleValeur} < min ${seuil.min}`, ou);
  if (typeof seuil.max_delta === "number" && typeof ancienneValeur === "number") {
    const delta = nouvelleValeur - ancienneValeur;
    if (delta > seuil.max_delta)
      add("bloquant", "seuil", `${ou} : delta +${delta} (${ancienneValeur} → ${nouvelleValeur}) > max_delta ${seuil.max_delta}`, ou);
  }
}

// Sonde job_planifie (TF-2767) : un jugement d'ÉTAT sur le dernier relevé, pas une comparaison.
// Un job qui n'expose pas son passage, qui est en échec ou muet, et un indicateur vide sur une
// population non vide, sont des défauts bloquants même quand ils étaient déjà là au relevé
// précédent : c'est leur persistance (14 jours sans alerte) que cette règle rend visible.
function jugerJob(nom, b, planSonde) {
  if (b.ok === false) { add("bloquant", "job-non-lisible", `sonde « ${nom} » : état du job illisible — ${b.erreur}`, nom); return; }
  if (b.erreur !== null && b.erreur !== "" && b.erreur !== false)
    add("bloquant", "job-en-echec", `sonde « ${nom} » : le dernier passage du job porte une erreur (« ${typeof b.erreur === "string" ? b.erreur : JSON.stringify(b.erreur)} »)`, nom);
  const passage = b.dernier_passage == null ? NaN : Date.parse(b.dernier_passage);
  if (b.dernier_passage == null) add("bloquant", "job-muet", `sonde « ${nom} » : aucun passage du job enregistré (dernier_passage vide)`, nom);
  else if (Number.isNaN(passage)) add("bloquant", "job-muet", `sonde « ${nom} » : dernier_passage « ${b.dernier_passage} » illisible (ISO 8601 attendu)`, nom);
  else if (typeof planSonde?.max_age_heures !== "number") add("info", "job-muet", `sonde « ${nom} » : max_age_heures absent du plan, ancienneté du dernier passage non jugée`, nom);
  else {
    const age = (Date.parse(neuf.ts) - passage) / 3600000;
    if (age > planSonde.max_age_heures)
      add("bloquant", "job-muet", `sonde « ${nom} » : dernier passage il y a ${age.toFixed(1)} h > max_age_heures ${planSonde.max_age_heures}`, nom);
  }
  if (b.population > 0 && !b.indicateur)
    add("bloquant", "indicateur-vide", `sonde « ${nom} » : indicateur vide (${b.indicateur === null ? "null" : b.indicateur}) sur une population de ${b.population}`, nom);
}

for (const nom of tousLesNoms) {
  const a = sondesAnciennes[nom];
  const b = sondesNeuves[nom];
  const planSonde = seuilsParSonde[nom];

  if (!a && b) {
    add("info", "cycle-de-vie", `sonde « ${nom} » apparue (absente du snapshot précédent)`, nom);
    if (b.type === "job_planifie") jugerJob(nom, b, planSonde); // un job déjà vide à l'apparition de sa sonde n'attend pas un relevé de plus
    continue;
  }
  if (a && !b) { add("bloquant", "cycle-de-vie", `sonde « ${nom} » disparue du dernier snapshot — silence non observable sans cette comparaison`, nom); continue; }

  if (b.type === "job_planifie") { jugerJob(nom, b, planSonde); continue; }

  if (a.ok !== false && b.ok === false) { add("bloquant", "exécution", `sonde « ${nom} » : passée en erreur (« ${b.erreur} ») entre les deux snapshots`, nom); continue; }
  if (b.ok === false) continue; // déjà en erreur avant et après : signalé par observer.mjs, pas une nouvelle dérive

  if (b.type === "oracle_externe") {
    if (a.verdict === "PASS" && b.verdict !== "PASS")
      add("bloquant", "verdict", `sonde « ${nom} » : verdict de l'oracle sous surveillance régresse PASS → ${b.verdict}`, nom);
    for (const sev of ["bloquant", "majeur"]) {
      const av = a.compteurs?.[sev] ?? 0, nv = b.compteurs?.[sev] ?? 0;
      if (nv > av) add("majeur", "compteur", `sonde « ${nom} » : findings ${sev} ${av} → ${nv}`, nom);
    }
    continue;
  }
  if (b.type === "rapport_json") {
    for (const chemin of Object.keys(b.valeurs || {}))
      verifierSeuil(nom, chemin, a.valeurs?.[chemin], b.valeurs?.[chemin], planSonde?.seuils?.[chemin]);
    continue;
  }
  // commande / manuel : valeur scalaire
  verifierSeuil(nom, null, a.valeur, b.valeur, planSonde?.seuils);
}

const durs = F.filter(f => f.sev === "bloquant" || f.sev === "majeur");
sortir(durs.length ? "FAIL" : "PASS", durs.length ? 1 : 0, artefact);
