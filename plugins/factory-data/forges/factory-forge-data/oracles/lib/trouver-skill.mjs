// trouver-skill.mjs — OÙ EST LE DOSSIER D'UN SKILL DU PARC, sans rien installer dans la configuration Claude (25/11/2026).
//
// Décision humaine du 25/11/2026 : les skills du parc arrivent dans Claude par la marketplace de plugins, jamais par une copie
// dans `~/.claude/skills`. Les scripts qui ont besoin des FICHIERS d'un skill (un oracle, `render_page.py`, `check_html.py`…)
// les cherchaient pourtant à cette seule adresse, écrite en dur. Ce module est l'unique façon de les trouver, dans cet ordre :
//   1. `FORGE_SKILLS_INSTALLES/<nom>`      — la variable des recettes (dossier jetable), qui prime sur tout ;
//   2. les SOURCES des forges du parc     — `<racine>/factory-forge-*/{.claude/skills,skills}/<nom>`, la racine étant
//                                           `FORGE_ROOT`, sinon le parent du dépôt qui porte ce fichier ;
//   3. les PLUGINS installés              — `<config>/plugins/cache/<marketplace>/<plugin>/<version>/skills/<nom>`, la version
//                                           la plus récente (`<config>` = `CLAUDE_CONFIG_DIR`, sinon `~/.claude`) ;
//   4. l'adresse HISTORIQUE               — `<config>/skills/<nom>`, pour un poste qui n'a pas encore migré.
// Un skill n'est trouvé que si son dossier porte un `SKILL.md`. Introuvable : `null`, et l'appelant dit lui-même ce qui manque.
//
// Copie partagée : ce fichier a des copies identiques dans le pilot et dans les forges qui en ont besoin (`trouver-skill.mjs`).
// La version de référence est celle-ci ; une copie qui diverge est un défaut.

import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Le dépôt git qui porte un dossier : le premier ancêtre qui contient `.git`. */
function depotDe(dossier) {
  let d = resolve(dossier);
  for (;;) {
    if (existsSync(join(d, ".git"))) return d;
    const parent = dirname(d);
    if (parent === d) return null;
    d = parent;
  }
}

const porteSkill = (d) => { try { return existsSync(join(d, "SKILL.md")); } catch { return false; } };
const sousDossiers = (d) => { try { return readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return []; } };

/** La racine du parc : FORGE_ROOT, sinon le parent du dépôt qui porte `depuis` (ce fichier par défaut). */
export function racineDuParc({ env = process.env, depuis = ICI } = {}) {
  if (env.FORGE_ROOT && env.FORGE_ROOT.trim()) return resolve(env.FORGE_ROOT.trim());
  const depot = depotDe(depuis);
  return depot ? dirname(depot) : null;
}

/** Le dossier de configuration Claude : CLAUDE_CONFIG_DIR, sinon ~/.claude (null si le dossier personnel est illisible). */
export function configClaude({ env = process.env } = {}) {
  if (env.CLAUDE_CONFIG_DIR && env.CLAUDE_CONFIG_DIR.trim()) return resolve(env.CLAUDE_CONFIG_DIR.trim());
  try { return join(homedir(), ".claude"); } catch { return null; }
}

/** Les dossiers candidats pour `nom`, dans l'ordre de la recherche, avec leur voie. */
export function candidats(nom, { env = process.env, depuis = ICI } = {}) {
  const liste = [];
  if (env.FORGE_SKILLS_INSTALLES && env.FORGE_SKILLS_INSTALLES.trim()) liste.push({ voie: "variable", chemin: join(resolve(env.FORGE_SKILLS_INSTALLES.trim()), nom) });
  const racine = racineDuParc({ env, depuis });
  if (racine) {
    for (const depot of sousDossiers(racine).filter((n) => /^factory-forge-/.test(n)).sort()) {
      for (const sous of [join(".claude", "skills"), "skills"]) liste.push({ voie: "forge", chemin: join(racine, depot, sous, nom) });
    }
  }
  const config = configClaude({ env });
  if (config) {
    const cache = join(config, "plugins", "cache");
    const versions = [];
    for (const marketplace of sousDossiers(cache)) {
      for (const plugin of sousDossiers(join(cache, marketplace))) {
        for (const version of sousDossiers(join(cache, marketplace, plugin))) {
          const chemin = join(cache, marketplace, plugin, version, "skills", nom);
          if (porteSkill(chemin)) { let t = 0; try { t = statSync(chemin).mtimeMs; } catch { /* date illisible : la plus ancienne */ } versions.push({ voie: "plugin", chemin, t }); }
        }
      }
    }
    versions.sort((a, b) => b.t - a.t).forEach(({ voie, chemin }) => liste.push({ voie, chemin }));
    liste.push({ voie: "historique", chemin: join(config, "skills", nom) });
  }
  return liste;
}

/** Toutes les RACINES de skills (dossiers qui contiennent des skills), dans l'ordre de la recherche, sans doublon ni dossier absent. */
export function racinesDeSkills({ env = process.env, depuis = ICI } = {}) {
  const vues = new Set(); const racines = [];
  const ajouter = (r) => { if (r && !vues.has(r) && existsSync(r)) { vues.add(r); racines.push(r); } };
  if (env.FORGE_SKILLS_INSTALLES && env.FORGE_SKILLS_INSTALLES.trim()) ajouter(resolve(env.FORGE_SKILLS_INSTALLES.trim()));
  const racine = racineDuParc({ env, depuis });
  if (racine) for (const depot of sousDossiers(racine).filter((n) => /^factory-forge-/.test(n)).sort()) { ajouter(join(racine, depot, ".claude", "skills")); ajouter(join(racine, depot, "skills")); }
  const config = configClaude({ env });
  if (config) {
    const cache = join(config, "plugins", "cache");
    for (const m of sousDossiers(cache)) for (const p of sousDossiers(join(cache, m))) for (const v of sousDossiers(join(cache, m, p))) ajouter(join(cache, m, p, v, "skills"));
    ajouter(join(config, "skills"));
  }
  return racines;
}

/** Le dossier du skill `nom` : `{ chemin, voie }`, ou `null` s'il n'est nulle part. */
export function trouverSkill(nom, options = {}) {
  for (const c of candidats(nom, options)) if (porteSkill(c.chemin)) return c;
  return null;
}

/** Un fichier d'un skill (`trouverFichier("quality-oracles", "scripts", "oracle-a11y.py")`), ou `null`. */
export function trouverFichier(nom, ...relatif) {
  const opts = relatif.length && typeof relatif[relatif.length - 1] === "object" ? relatif.pop() : {};
  for (const c of candidats(nom, opts)) {
    if (!porteSkill(c.chemin)) continue;
    const f = join(c.chemin, ...relatif);
    if (existsSync(f)) return f;
  }
  return null;
}

/** Le chemin à afficher quand rien n'est trouvé : l'adresse où le skill serait cherché en premier, pour un message lisible. */
export function cheminAttendu(nom, ...relatif) {
  const c = candidats(nom)[0];
  return c ? join(c.chemin, ...relatif) : join("~", ".claude", "skills", nom, ...relatif);
}
