#!/usr/bin/env node
// Hook SessionStart du plugin factory-socle.
// Il tourne dans TOUTES les sessions où le plugin est actif et ne fait jamais échouer l'ouverture.
// Il donne à la session :
//   1. la valeur du marqueur <socle-factory> (les plugins ne voient pas le dossier des autres) ;
//   2. où est le pilot factory-pilot : le parc du poste, ou le pilot embarqué (mode consultant).
//
// Mode consultant (aucun parc sur le poste) : il pose ~/.factory-forge, une racine qui réunit la
// partie outil du pilot, livrée par ce socle, et les forges livrées par les mallettes installées.
// C'est sa seule écriture. La copie n'est refaite que quand une mallette change de version, et elle
// ne touche jamais à ce que le poste a écrit : seuls les fichiers du manifeste de la copie précédente
// sont remplacés ou retirés, un TODO ou un retour écrit sur le poste n'y figure jamais.
// Il exporte FORGE_ROOT vers les commandes de la session (CLAUDE_ENV_FILE), sans quoi les skills qui
// cherchent `${FORGE_ROOT:-$HOME/factory}` ne trouveraient pas la racine.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PILOT = "factory-pilot";
const MANIFESTE = ".embarque-version.json";
const MALLETTE = /^factory-[a-z0-9-]+?(~g\d+)?$/;
const unix = (p) => p.replace(/\\/g, "/");

function sortir(texte) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: texte } }));
  process.exit(0);
}

function lister(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...lister(p, base));
    else if (e.isFile()) out.push(unix(path.relative(base, p)));
  }
  return out;
}

const lireJson = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };

// Les forges livrées par les mallettes installées : le socle et ses voisines, dans le même dossier
// de plugins synchronisés depuis claude.ai, ou dans le cache de la marketplace (une version par
// dossier). Une copie orpheline (ancienne version en attente de ménage) est ignorée ; entre deux
// copies d'une même forge, la plus récente l'emporte.
function forgesLivrees(socle) {
  const trouvees = new Map();
  const voir = (plugin) => {
    const dossier = path.join(plugin, "forges");
    if (!fs.existsSync(dossier) || fs.existsSync(path.join(plugin, ".orphaned_at"))) return;
    const provenance = lireJson(path.join(plugin, "PROVENANCE.json")) || {};
    const date = fs.statSync(plugin).mtimeMs;
    for (const nom of fs.readdirSync(dossier)) {
      const src = path.join(dossier, nom);
      if (!fs.existsSync(path.join(src, "README.md"))) continue;
      const deja = trouvees.get(nom);
      if (!deja || date > deja.date) trouvees.set(nom, { src, commit: provenance["forge:" + nom]?.commit || null, date });
    }
  };
  for (const d of new Set([path.dirname(socle), path.dirname(path.dirname(socle))])) {
    let noms = [];
    try { noms = fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { continue; }
    for (const n of noms) {
      if (!MALLETTE.test(n)) continue;
      const p = path.join(d, n);
      if (fs.existsSync(path.join(p, "forges")) || fs.existsSync(path.join(p, ".claude-plugin"))) voir(p);
      else {
        try { for (const v of fs.readdirSync(p, { withFileTypes: true })) if (v.isDirectory()) voir(path.join(p, v.name)); } catch {}
      }
    }
  }
  voir(socle);
  return trouvees;
}

// Copie src dans dest si sa version a changé. Un dossier dest sans manifeste est un vrai dépôt posé
// là par quelqu'un : on n'y touche pas.
function synchroniser(src, dest, commit) {
  const fichierManifeste = path.join(dest, MANIFESTE);
  const avant = lireJson(fichierManifeste);
  if (fs.existsSync(dest) && !avant) return "clone";
  const version = commit || `${unix(src)}@${Math.round(fs.statSync(src).mtimeMs)}`;
  if (avant && avant.version === version) return "a-jour";
  const fichiers = lister(src);
  const garde = new Set(fichiers);
  for (const rel of fichiers) {
    const cible = path.join(dest, rel);
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.copyFileSync(path.join(src, rel), cible);
  }
  for (const rel of avant?.fichiers || []) if (!garde.has(rel)) fs.rmSync(path.join(dest, rel), { force: true });
  const provisoire = fichierManifeste + ".tmp";
  fs.writeFileSync(provisoire, JSON.stringify({ schema: "factory/embarque-version@1", version, source: unix(src), le: new Date().toISOString(), fichiers }, null, 1) + "\n");
  fs.renameSync(provisoire, fichierManifeste);
  return "copie";
}

try {
  const parDefaut = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const socle = path.resolve(process.argv[2] || process.env.CLAUDE_PLUGIN_ROOT || parDefaut);
  let entree = {};
  try { entree = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch {}
  const cwd = entree.cwd || process.cwd();
  const instrumente = fs.existsSync(path.join(cwd, "forge"));
  const MAISON = path.join(os.homedir(), ".factory-forge");

  const lignes = [
    `Factory — le marqueur <socle-factory> vaut : ${unix(socle)}. Remplace-le par ce chemin partout où un skill Factory le cite.`,
  ];
  const finir = () => {
    if (instrumente) lignes.push("Ce projet est sous la factory (dossier forge/ présent) : sa doctrine et ses hooks de projet s'appliquent.");
    sortir(lignes.join("\n"));
  };

  const candidats = [
    process.env.FORGE_ROOT,
    path.dirname(cwd),
    path.join(os.homedir(), "factory"),
    MAISON,
    "c:/dev",
  ].filter(Boolean);
  const racine = candidats.find((r) => fs.existsSync(path.join(r, PILOT, "CLAUDE.md")));
  const embarque = racine && fs.existsSync(path.join(racine, PILOT, "EMBARQUE.json"));

  // 1. Un parc sur le poste : il prime, et rien n'est écrit.
  if (racine && !embarque) {
    lignes.push(`Pilot factory-pilot trouvé : ${unix(path.join(racine, PILOT))} (FORGE_ROOT = ${unix(racine)}). Les oracles des forges sont disponibles.`);
    finir();
  }

  // 2. Mode consultant : pilot embarqué dans ce socle, forges livrées par les mallettes.
  const livrees = forgesLivrees(socle);
  const pilot = livrees.get(PILOT);
  if (!pilot) {
    lignes.push("Pilot factory-pilot absent de ce poste : les oracles des forges ne sont pas disponibles (mode dégradé). Un livrable qui exige un oracle de forge se déclare non jugé, jamais vert. Pour installer la factory : skill accueil-factory.");
    finir();
  }
  let etat;
  try {
    etat = synchroniser(pilot.src, path.join(MAISON, PILOT), pilot.commit);
    for (const [nom, f] of livrees) if (nom !== PILOT) synchroniser(f.src, path.join(MAISON, nom), f.commit);
  } catch (e) {
    lignes.push(`Pilot embarqué présent, mais la racine ${unix(MAISON)} n'a pas pu être posée (${e.code || e.message}) : mode dégradé. Un livrable qui exige un oracle de forge se déclare non jugé, jamais vert.`);
    finir();
  }
  if (etat === "clone") {
    lignes.push(`${unix(path.join(MAISON, PILOT))} existe sans être une copie embarquée : je n'y touche pas. Sans CLAUDE.md dans ce dossier, la factory reste en mode dégradé.`);
    finir();
  }
  let exporte = false;
  if (process.env.CLAUDE_ENV_FILE) {
    try { fs.appendFileSync(process.env.CLAUDE_ENV_FILE, `export FORGE_ROOT="${unix(MAISON)}"\n`); exporte = true; } catch {}
  }
  const forges = [...livrees.keys()].filter((n) => n !== PILOT).sort();
  lignes.push(
    `Pilot embarqué (mode consultant) : ${unix(path.join(MAISON, PILOT))}, version ${(pilot.commit || "inconnue").slice(0, 7)}${etat === "copie" ? ", mise à jour à cette ouverture" : ""}. ` +
    `FORGE_ROOT = ${unix(MAISON)}${exporte ? " (posée pour les commandes de la session)" : ` : la poser (export FORGE_ROOT="${unix(MAISON)}") avant tout skill de la Factory`}. ` +
    `Forges livrées par les mallettes : ${forges.length ? forges.join(", ") : "aucune"}. Une forge absente se déclare non jugée, jamais verte. ` +
    "Ce que la session écrit dans le pilot (TODO, retours, ledger) reste sur ce poste et ne remonte pas au pilot central : un retour à faire remonter s'ouvre en issue sur github.com/Ptitcuicui/factory-retours, pour qui y a accès.",
  );
  finir();
} catch {
  process.exit(0);
}
