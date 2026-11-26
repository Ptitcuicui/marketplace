#!/usr/bin/env node
// Fixture — sonde de type « oracle_externe ». Simule un oracle tiers à contrat JSON
// {oracle,domaine,artefact,verdict,findings,non_juge} (même forme que oracle-profiler.mjs
// de forge-data, dont le chemin réel serait déclaré — PARAMÉTRÉ, jamais codé en dur — dans
// le champ « commande » d'une sonde de plan réel). Lit un fichier d'état JSON {"verdict":
// "PASS"|"FAIL"} et rend le contrat correspondant. Faire varier ce fichier entre deux
// exécutions simule un vrai oracle qui se dégrade (ex. assertions data qui commencent à
// échouer) — c'est ce que le self-test mute pour prouver la détection de régression de
// verdict par derive.mjs.
// Usage : node faux-oracle-data.mjs <etat.json> [--json-only]
import fs from "node:fs";

const etatPath = process.argv[2];
const jsonOnly = process.argv.includes("--json-only");
if (!etatPath || !fs.existsSync(etatPath)) {
  process.stderr.write(`fichier d'état introuvable : ${etatPath}\n`);
  process.exit(2);
}
const etat = JSON.parse(fs.readFileSync(etatPath, "utf8"));
const verdict = etat.verdict === "PASS" ? "PASS" : "FAIL";
const findings = verdict === "PASS"
  ? [{ sev: "info", regle: "F1", msg: "assertions synthétiques satisfaites", where: etatPath }]
  : [{ sev: "bloquant", regle: "F1", msg: "assertion synthétique en échec (fixture pilotée par état)", where: etatPath }];

process.stdout.write(JSON.stringify({
  oracle: "faux-oracle-data", domaine: "Fixture : oracle de données synthétique (self-test forge-observability)",
  artefact: etatPath, verdict, findings, non_juge: ["tout ce qui n'est pas la fixture elle-même"],
}, null, jsonOnly ? 0 : 2));
process.exit(verdict === "PASS" ? 0 : 1);
