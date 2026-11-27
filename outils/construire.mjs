#!/usr/bin/env node
// Assemble la marketplace Factory depuis les forges.
//
//   node outils/construire.mjs [--racine <FORGE_ROOT>] [--check]
//
// Source unique : outils/mallettes.json. Les skills se corrigent dans leur forge ;
// plugins/ et .claude-plugin/marketplace.json sont régénérés à chaque passage.
// --check : n'écrit rien, rend 1 si la marketplace diffère de ce que l'assemblage produirait.
// Forges embarquées : une mallette qui déclare `forges` dans mallettes.json reçoit une copie de
// chaque forge sous plugins/<mallette>/forges/<forge>/. Ses skills la trouvent sans clone local,
// et elle se met à jour avec la marketplace. Une entrée est un nom de dossier, ou un objet
// { depot, inclure, exclure, marqueur } : inclure et exclure sont des expressions régulières sur le
// chemin relatif (séparateur /) ; marqueur pose forges/<depot>/EMBARQUE.json, qui distingue la copie
// embarquée d'un clone (le pilot embarqué dans le socle s'en sert pour ne rien cloner ni tirer).
// Fins de ligne : tout fichier texte (tout fichier sans octet nul) est rendu en LF, quel que soit
// le poste qui assemble (Windows en CRLF, Linux en LF) : deux postes produisent les mêmes octets.
// Seuls les fichiers suivis par git sont assemblés : l'état local d'un poste ne part jamais.
// Sortie : un rapport des références qui ne se résolvent pas dans un plugin (chemins en dur,
// dépendances au pilot) — outils/rapport-construction.json.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const MARKETPLACE = path.resolve(ICI, "..");
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const CHECK = args.includes("--check");
const RACINE = path.resolve(opt("--racine") || process.env.FORGE_ROOT || path.resolve(MARKETPLACE, ".."));

const conf = JSON.parse(fs.readFileSync(path.join(ICI, "mallettes.json"), "utf8"));

// Fichiers internes au système d'oracles de la factory : journaux, pas des outils.
const EXCLUS = [/\.oracles(-cache)?\.json$/, /\.oracles-historique\.jsonl$/, /(^|[\\/])__pycache__([\\/]|$)/,
  /(^|[\\/])node_modules([\\/]|$)/, /(^|[\\/])\.oracles([\\/]|$)/, /(^|[\\/])\.git([\\/]|$)/, /\.pyc$/];
const TEXTE = /\.(md|mjs|cjs|js|ts|py|json|jsonl|sh|ps1|txt|ya?ml|toml|html|css|svg|csv)$/i;
const MD = /\.md$/i;

// Quel plugin porte quel skill.
const proprietaire = new Map();
for (const p of conf.plugins) for (const s of p.skills) proprietaire.set(path.basename(s), p.name);
const SOCLE = conf.plugins[0].name;

const rapport = { racine: RACINE, plugins: {} };
const sortie = new Map(); // chemin relatif -> Buffer

function lister(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (EXCLUS.some((r) => r.test(p))) continue;
    if (e.isDirectory()) out.push(...lister(p)); else out.push(p);
  }
  return out;
}

// Sources : seuls les fichiers suivis par git (27/11/2026). Un fichier non suivi ou ignoré (TODO
// régénéré du pilot, hook git local, sortie d'un run) reste sur le poste qui assemble : deux postes
// produisent la même marketplace, et l'état d'un poste ne part jamais chez les consultants.
// Hors dépôt git, repli sur le listage du disque.
function listerSources(dir) {
  let suivis;
  try {
    suivis = execFileSync("git", ["-C", dir, "ls-files", "-z", "--cached", "--", "."], { encoding: "utf8", maxBuffer: 64e6 })
      .split("\0").filter(Boolean);
  } catch { return lister(dir); }
  return suivis.map((r) => path.join(dir, r))
    .filter((p) => !EXCLUS.some((r) => r.test(p)) && fs.existsSync(p) && fs.statSync(p).isFile());
}

// Fichier sans octet nul et hors liste TEXTE (LICENSE, .lock, .tf, hooks sans extension…) : texte
// aussi, rendu en LF octet par octet, sans décodage, pour ne toucher à aucun encodage.
function enLF(buf) {
  if (buf.includes(0) || !buf.includes(13)) return buf;
  return Buffer.from(buf.toString("latin1").replace(/\r\n/g, "\n"), "latin1");
}

function shaDepot(dossier) {
  try { return execFileSync("git", ["-C", dossier, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); }
  catch { return null; }
}

// Réécrit, dans le Markdown, les chemins absolus vers un skill installé à la main
// (~/.claude/skills/<x>) en chemins de plugin.
const RE_SKILL = /(?:~|\$HOME|%USERPROFILE%|\$env:USERPROFILE)[\\/]\.claude[\\/]skills[\\/]([a-z0-9-]+)((?:[\\/][^\s`'"()<>\]|]*)?)/g;

function transformer(texte, plugin, estMd, constats) {
  texte = texte.replace(/\r\n/g, "\n");
  for (const { de, vers } of conf.substitutions) texte = texte.split(de).join(vers);
  if (estMd) {
    texte = texte.replace(RE_SKILL, (m, skill, reste) => {
      const chez = proprietaire.get(skill);
      const suite = reste.replace(/\\/g, "/");
      if (chez === plugin) return "${CLAUDE_PLUGIN_ROOT}/skills/" + skill + suite;
      if (chez === SOCLE) return "<socle-factory>/skills/" + skill + suite;
      if (chez) return `<plugin ${chez}>/skills/` + skill + suite;
      constats.skills_hors_marketplace[skill] = (constats.skills_hors_marketplace[skill] || 0) + 1;
      return m;
    });
  }
  return texte;
}

function compter(texte, fichier, constats) {
  const add = (k) => { constats[k][fichier] = (constats[k][fichier] || 0) + 1; };
  if (!MD.test(fichier) && /\.claude[\\/]+skills/.test(texte)) add("chemin_skill_dans_code");
  for (const _ of texte.matchAll(/<pilot>|factory-pilot|FORGE_ROOT/g)) add("depend_du_pilot");
  for (const _ of texte.matchAll(/[cC]:[\\/]+dev[\\/]/g)) add("chemin_c_dev");
}

function poser(rel, contenu) { sortie.set(rel.split(path.sep).join("/"), Buffer.isBuffer(contenu) ? contenu : Buffer.from(contenu)); }

function copierDossier(src, dest, plugin, constats, ignorer = () => false) {
  for (const f of listerSources(src)) {
    if (ignorer(path.relative(src, f))) continue;
    const rel = path.join(dest, path.relative(src, f));
    if (TEXTE.test(f)) {
      let t = fs.readFileSync(f, "utf8");
      t = transformer(t, plugin, MD.test(f), constats);
      compter(t, rel, constats);
      poser(rel, t);
    } else poser(rel, enLF(fs.readFileSync(f)));
  }
}

// Dans une forge embarquée, on ne reprend pas ce qui sert au dépôt et pas à l'outil : ses skills
// (déjà assemblés par mallettes.json), sa config Claude Code, sa CI et ses réglages git.
const forgeIgnoree = (rel) => /^(skills|\.claude|\.github)([\\/]|$)/.test(rel) || /^\.git(ignore|attributes)$/.test(rel);
// Limites d'un plugin chargé dans claude.ai (claude.com/docs/cowork/guide/plugins, « Limits »).
const LIMITE = { fichiers: 5000, octets: 200e6 };

const entrees = [];
for (const p of conf.plugins) {
  const base = path.join("plugins", p.name);
  const constats = { skills_hors_marketplace: {}, chemin_skill_dans_code: {}, depend_du_pilot: {}, chemin_c_dev: {} };
  const provenance = {};
  for (const s of p.skills) {
    const src = path.join(RACINE, s);
    if (!fs.existsSync(path.join(src, "SKILL.md"))) throw new Error(`skill introuvable : ${src}`);
    const depot = s.split("/")[0];
    provenance[path.basename(s)] = { depot, chemin: s.split("/").slice(1).join("/"), commit: shaDepot(path.join(RACINE, depot)) };
    copierDossier(src, path.join(base, "skills", path.basename(s)), p.name, constats);
  }
  if (p.agents) {
    const src = path.join(RACINE, p.agents);
    for (const f of fs.readdirSync(src).filter((f) => f.endsWith(".md"))) {
      let t = transformer(fs.readFileSync(path.join(src, f), "utf8"), p.name, true, constats);
      compter(t, path.join(base, "agents", f), constats);
      poser(path.join(base, "agents", f), t);
    }
    provenance["agents"] = { depot: p.agents.split("/")[0], chemin: p.agents.split("/").slice(1).join("/"), commit: shaDepot(path.join(RACINE, p.agents.split("/")[0])) };
  }
  if (p.extra) copierDossier(path.join(MARKETPLACE, p.extra), base, p.name, constats);
  for (const entree of p.forges || []) {
    const spec = typeof entree === "string" ? { depot: entree } : entree;
    const forge = spec.depot;
    const src = path.join(RACINE, forge);
    if (!fs.existsSync(path.join(src, "README.md"))) throw new Error(`forge introuvable : ${src}`);
    const inclure = (spec.inclure || []).map((m) => new RegExp(m));
    const exclure = (spec.exclure || []).map((m) => new RegExp(m));
    // garder : ce que forgeIgnoree retirerait mais que la forge doit livrer (les agents que le pilot
    // fait hériter aux produits vivent sous .claude/agents/).
    const garder = (spec.garder || []).map((m) => new RegExp(m));
    const ignorer = (rel) => {
      const r = rel.split(path.sep).join("/");
      if (forgeIgnoree(rel) && !garder.some((m) => m.test(r))) return true;
      if (inclure.length && !inclure.some((m) => m.test(r))) return true;
      return exclure.some((m) => m.test(r));
    };
    copierDossier(src, path.join(base, "forges", forge), p.name, constats, ignorer);
    const commit = shaDepot(src);
    provenance["forge:" + forge] = { depot: forge, chemin: ".", commit };
    if (spec.marqueur) {
      poser(path.join(base, "forges", forge, "EMBARQUE.json"), JSON.stringify({
        schema: "factory/embarque@1", mode: "embarque", mallette: p.name, depot: forge, commit,
        note: spec.marqueur,
      }, null, 2) + "\n");
    }
  }
  const fichiers = [...sortie.keys()].filter((k) => k.startsWith(base.split(path.sep).join("/") + "/"));
  const octets = fichiers.reduce((n, k) => n + sortie.get(k).length, 0);
  if (fichiers.length > LIMITE.fichiers || octets > LIMITE.octets)
    throw new Error(`${p.name} dépasse la limite d'un plugin claude.ai : ${fichiers.length} fichiers, ${(octets / 1e6).toFixed(1)} Mo (max ${LIMITE.fichiers} fichiers, ${LIMITE.octets / 1e6} Mo)`);

  const manifeste = { name: p.name, displayName: p.displayName, description: p.description, author: conf.marketplace.owner, license: "MIT" };
  if (p.dependencies) manifeste.dependencies = p.dependencies;
  poser(path.join(base, ".claude-plugin", "plugin.json"), JSON.stringify(manifeste, null, 2) + "\n");
  poser(path.join(base, "PROVENANCE.json"), JSON.stringify(provenance, null, 2) + "\n");

  const entree = { name: p.name, source: "./" + base.split(path.sep).join("/"), description: p.description };
  if (p.dependencies) entree.dependencies = p.dependencies;
  entrees.push(entree);
  rapport.plugins[p.name] = {
    skills: p.skills.length,
    skills_hors_marketplace: constats.skills_hors_marketplace,
    fichiers_de_code_avec_chemin_skill: Object.keys(constats.chemin_skill_dans_code).length,
    references_au_pilot: Object.values(constats.depend_du_pilot).reduce((a, b) => a + b, 0),
    chemins_c_dev: constats.chemin_c_dev,
  };
}
poser(path.join(".claude-plugin", "marketplace.json"),
  JSON.stringify({ name: conf.marketplace.name, description: conf.marketplace.description, owner: conf.marketplace.owner, plugins: entrees }, null, 2) + "\n");

// Comparaison avec l'existant (plugins/ et le catalogue seulement).
const existant = new Map();
for (const d of ["plugins", ".claude-plugin"]) {
  const abs = path.join(MARKETPLACE, d);
  if (fs.existsSync(abs)) for (const f of lister(abs)) existant.set(path.relative(MARKETPLACE, f).split(path.sep).join("/"), fs.readFileSync(f));
}
const h = (b) => crypto.createHash("sha256").update(b).digest("hex");
const differences = [...new Set([...sortie.keys(), ...existant.keys()])]
  .filter((k) => !existant.has(k) || !sortie.has(k) || h(existant.get(k)) !== h(sortie.get(k)));

if (CHECK) {
  if (differences.length) { console.error(`FAIL : ${differences.length} fichier(s) diffèrent de l'assemblage, relancer sans --check.`); for (const d of differences.slice(0, 20)) console.error("  " + d); process.exit(1); }
  console.log("PASS : la marketplace est à jour avec les forges."); process.exit(0);
}

// Retire seulement les fichiers périmés (un dossier ouvert par un shell sous Windows
// ne se supprime pas), puis les dossiers devenus vides.
for (const rel of existant.keys()) if (!sortie.has(rel)) fs.rmSync(path.join(MARKETPLACE, rel), { force: true });
const viderVides = (d) => {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) viderVides(path.join(d, e.name));
  try { if (!fs.readdirSync(d).length) fs.rmdirSync(d); } catch {}
};
viderVides(path.join(MARKETPLACE, "plugins"));
for (const [rel, buf] of sortie) {
  const abs = path.join(MARKETPLACE, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buf);
}
fs.writeFileSync(path.join(ICI, "rapport-construction.json"), JSON.stringify(rapport, null, 2) + "\n");
console.log(`Assemblé : ${conf.plugins.length} plugins, ${sortie.size} fichiers, ${differences.length} changés.`);
for (const [n, r] of Object.entries(rapport.plugins))
  console.log(`  ${n} : ${r.skills} skills · réf. au pilot ${r.references_au_pilot} · code avec chemin de skill ${r.fichiers_de_code_avec_chemin_skill} · skills hors marketplace ${JSON.stringify(r.skills_hors_marketplace)}`);
