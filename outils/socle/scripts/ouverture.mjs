#!/usr/bin/env node
// Hook SessionStart du plugin factory-socle.
// Il tourne dans TOUTES les sessions où le plugin est actif : il reste court, ne lit rien
// d'autre que des chemins, n'écrit rien, et ne fait jamais échouer l'ouverture.
// Il donne à la session :
//   1. la valeur du marqueur <socle-factory> (les plugins ne voient pas le dossier des autres) ;
//   2. où est le pilot factory-pilot, ou que les oracles des forges sont absents (mode dégradé).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function sortir(texte) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: texte } }));
  process.exit(0);
}

try {
  const parDefaut = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const socle = (process.argv[2] || process.env.CLAUDE_PLUGIN_ROOT || parDefaut).replace(/\\/g, "/");
  let entree = {};
  try { entree = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch {}
  const cwd = entree.cwd || process.cwd();

  const candidats = [
    process.env.FORGE_ROOT,
    path.dirname(cwd),
    path.join(os.homedir(), "factory"),
    path.join(os.homedir(), ".factory-forge"),
    "c:/dev",
  ].filter(Boolean);
  const racine = candidats.find((r) => fs.existsSync(path.join(r, "factory-pilot", "CLAUDE.md")));
  const instrumente = fs.existsSync(path.join(cwd, "forge"));

  const lignes = [
    `Factory — le marqueur <socle-factory> vaut : ${socle}. Remplace-le par ce chemin partout où un skill Factory le cite.`,
  ];
  if (racine) {
    lignes.push(`Pilot factory-pilot trouvé : ${path.join(racine, "factory-pilot").replace(/\\/g, "/")} (FORGE_ROOT = ${racine.replace(/\\/g, "/")}). Les oracles des forges sont disponibles.`);
  } else {
    lignes.push("Pilot factory-pilot absent de ce poste : les oracles des forges ne sont pas disponibles (mode dégradé). Un livrable qui exige un oracle de forge se déclare non jugé, jamais vert. Pour installer la factory : skill accueil-factory.");
  }
  if (instrumente) lignes.push("Ce projet est sous la factory (dossier forge/ présent) : sa doctrine et ses hooks de projet s'appliquent.");
  sortir(lignes.join("\n"));
} catch {
  process.exit(0);
}
