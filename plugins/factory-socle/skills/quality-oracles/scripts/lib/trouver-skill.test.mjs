#!/usr/bin/env node
// trouver-skill.test.mjs — recette à double sens du résolveur de skills (25/11/2026). Tout vit dans un dossier temporaire :
// un parc factice (deux forges), un faux dossier de configuration Claude (plugins en cache, adresse historique), un dossier
// de variable. Aucune lecture du vrai `~/.claude` : chaque cas fixe FORGE_ROOT et CLAUDE_CONFIG_DIR.
//
//   node trouver-skill.test.mjs     exit 0 si tous les cas tiennent

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { trouverSkill, trouverFichier, candidats, racineDuParc, racinesDeSkills } from "./trouver-skill.mjs";

const base = realpathSync.native(mkdtempSync(join(tmpdir(), "trouver-skill-")));
let ok = 0; const echecs = [];
const cas = (nom, fn) => { try { fn(); ok++; console.log(`  [PASS] ${nom}`); } catch (e) { echecs.push(nom); console.log(`  [FAIL] ${nom} — ${e.message}`); } };
const att = (c, m) => { if (!c) throw new Error(m); };
const skill = (dossier, ...fichiers) => { mkdirSync(dossier, { recursive: true }); writeFileSync(join(dossier, "SKILL.md"), "---\nname: x\n---\n"); for (const f of fichiers) { mkdirSync(join(dossier, f, ".."), { recursive: true }); writeFileSync(join(dossier, f), "x"); } };

try {
  const parc = join(base, "parc"), config = join(base, "config"), variable = join(base, "variable");
  skill(join(parc, "factory-forge-agents", ".claude", "skills", "quality-oracles"), "scripts/oracle-a11y.py");
  skill(join(parc, "factory-forge-design", "skills", "systeme-de-marque"));
  mkdirSync(join(parc, "factory-forge-agents", ".claude", "skills", "sans-skill-md"), { recursive: true });
  skill(join(parc, "autre-depot", ".claude", "skills", "hors-forge"));
  const v1 = join(config, "plugins", "cache", "factory", "factory-socle", "aaa111", "skills", "factory-page-html");
  const v2 = join(config, "plugins", "cache", "factory", "factory-socle", "bbb222", "skills", "factory-page-html");
  skill(v1, "scripts/render_page.py"); skill(v2, "scripts/render_page.py");
  utimesSync(v1, new Date("2026-01-01"), new Date("2026-01-01")); utimesSync(v2, new Date("2026-11-01"), new Date("2026-11-01"));
  skill(join(config, "skills", "ancien-skill"));
  skill(join(variable, "quality-oracles"));
  const env = { FORGE_ROOT: parc, CLAUDE_CONFIG_DIR: config };

  cas("VERT — un skill d'une forge (.claude/skills) se trouve dans ses SOURCES, voie « forge »", () => {
    const r = trouverSkill("quality-oracles", { env });
    att(r && r.voie === "forge" && r.chemin === join(parc, "factory-forge-agents", ".claude", "skills", "quality-oracles"), JSON.stringify(r));
  });
  cas("VERT — un skill d'une forge rangé sous skills/ (forge-design) se trouve aussi", () => {
    const r = trouverSkill("systeme-de-marque", { env });
    att(r && r.voie === "forge" && r.chemin.endsWith(join("factory-forge-design", "skills", "systeme-de-marque")), JSON.stringify(r));
  });
  cas("ROUGE → VERT — la variable FORGE_SKILLS_INSTALLES PRIME sur les sources (les recettes gardent leur dossier jetable)", () => {
    const r = trouverSkill("quality-oracles", { env: { ...env, FORGE_SKILLS_INSTALLES: variable } });
    att(r && r.voie === "variable" && r.chemin === join(variable, "quality-oracles"), JSON.stringify(r));
  });
  cas("VERT — un skill absent des forges vient d'un PLUGIN installé, et de sa version la PLUS RÉCENTE", () => {
    const r = trouverSkill("factory-page-html", { env });
    att(r && r.voie === "plugin" && r.chemin === v2, JSON.stringify(r));
  });
  cas("VERT — l'adresse historique ~/.claude/skills ne sert qu'en DERNIER recours", () => {
    const r = trouverSkill("ancien-skill", { env });
    att(r && r.voie === "historique", JSON.stringify(r));
    const ordre = candidats("quality-oracles", { env }).map((c) => c.voie);
    att(ordre.indexOf("historique") === ordre.length - 1, `ordre : ${ordre.join(" > ")}`);
  });
  cas("ROUGE — un dossier sans SKILL.md n'est pas un skill", () => {
    att(trouverSkill("sans-skill-md", { env }) === null, "un dossier sans SKILL.md a été pris pour un skill");
  });
  cas("ROUGE — un dépôt qui n'est pas une forge (autre-depot) n'est pas fouillé", () => {
    att(trouverSkill("hors-forge", { env }) === null, "un dépôt hors forge a été fouillé");
  });
  cas("ROUGE — un skill introuvable rend null, jamais un chemin inventé", () => {
    att(trouverSkill("n-existe-pas", { env }) === null, "un skill inexistant a été trouvé");
  });
  cas("VERT — trouverFichier rend le fichier du premier skill qui le porte", () => {
    const f = trouverFichier("factory-page-html", "scripts", "render_page.py", { env });
    att(f === join(v2, "scripts", "render_page.py"), String(f));
    att(trouverFichier("quality-oracles", "scripts", "absent.mjs", { env }) === null, "un fichier absent a été rendu");
  });
  cas("VERT — racinesDeSkills rend toutes les racines dans l'ordre (variable, forges, plugins, historique), sans dossier absent", () => {
    const r = racinesDeSkills({ env: { ...env, FORGE_SKILLS_INSTALLES: variable } });
    const attendu = [variable, join(parc, "factory-forge-agents", ".claude", "skills"), join(parc, "factory-forge-design", "skills"),
      join(config, "plugins", "cache", "factory", "factory-socle", "aaa111", "skills"), join(config, "plugins", "cache", "factory", "factory-socle", "bbb222", "skills"), join(config, "skills")];
    att(JSON.stringify(r) === JSON.stringify(attendu), JSON.stringify(r));
    att(!r.some((x) => x.includes("autre-depot")), "un dépôt hors forge est une racine");
  });
  cas("VERT — sans FORGE_ROOT, la racine du parc est le parent du dépôt qui porte le fichier appelant", () => {
    const depot = join(parc, "factory-forge-agents"); mkdirSync(join(depot, ".git"), { recursive: true });
    const r = racineDuParc({ env: {}, depuis: join(depot, ".claude", "skills", "quality-oracles", "scripts", "lib") });
    att(r === parc, String(r));
  });
} finally {
  rmSync(base, { recursive: true, force: true });
}
console.log(`trouver-skill : ${ok} PASS, ${echecs.length} FAIL`);
process.exit(echecs.length ? 1 : 0);
