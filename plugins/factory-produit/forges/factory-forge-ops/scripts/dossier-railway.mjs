#!/usr/bin/env node
// dossier-railway.mjs — le chemin sous lequel `railway link` a enregistré un dossier (TF-2784, G-10).
//
//   node scripts/dossier-railway.mjs <dossier> [--config <config.json>] [--casse-insensible]
//
// `railway status` lancé depuis `c:\dev\<produit>` répond « No linked project found » quand le CLI a enregistré le lien sous
// `C:\dev\<produit>` : il compare le chemin tel quel. L'outil lit le fichier de liaisons du CLI (par défaut
// `~/.railway/config.json`), ne regarde que les CHEMINS enregistrés (jamais le jeton que le fichier porte) et ÉCRIT sur la
// sortie standard le chemin enregistré ; le run lance ensuite toute commande `railway` depuis ce dossier.
// Il ne lance pas `railway`, n'appelle aucun service et ne lit aucune variable d'environnement.
// `--casse-insensible` force la comparaison de Windows (défaut : vraie sous Windows seulement).
// Exit 0 : lien enregistré (sortie standard : le chemin ; la sortie d'erreur dit si la casse diffère du dossier donné) ·
// 1 : aucun lien enregistré pour ce dossier (le geste est `railway link`, voir le plan railway) ·
// 2 : usage, fichier absent ou illisible, ou deux chemins enregistrés qui désignent le même dossier.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { trouverLien } from "./lib-lien-railway.mjs";

const args = process.argv.slice(2);
const dit = m => process.stderr.write(`[DOSSIER-RAILWAY] ${m}\n`);
const fail = m => { dit(m); process.exit(2); };
const valeur = nom => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : undefined; };

const dossier = args[0] && !args[0].startsWith("--") ? args[0] : null;
if (!dossier) fail("usage : <dossier> [--config <config.json>] [--casse-insensible] — aucun dossier donné");
const inconnue = args.slice(1).find(a => a.startsWith("--") && a !== "--config" && a !== "--casse-insensible");
if (inconnue) fail(`option inconnue « ${inconnue} »`);
if (args.includes("--config") && (!valeur("--config") || valeur("--config").startsWith("--"))) fail("usage : --config <config.json>");

const casseInsensible = args.includes("--casse-insensible") || process.platform === "win32";
const config = path.resolve(valeur("--config") ?? path.join(os.homedir(), ".railway", "config.json"));
if (!fs.existsSync(config)) fail(`fichier de liaisons du CLI introuvable : ${config} (aucun \`railway link\` joué sur ce poste ?)`);
let contenu;
try { contenu = JSON.parse(fs.readFileSync(config, "utf8")); } catch { fail(`${config} ne contient pas du JSON (contenu non cité : il porte un jeton)`); }

const cible = (casseInsensible ? path.win32 : path).resolve(dossier);
const lien = trouverLien(contenu, cible, { casseInsensible });
if (lien.verdict === "absent") {
  dit(`aucun lien enregistré pour ${cible} : \`railway link <PROJET> --environment <ENVIRONNEMENT>\` depuis ce dossier, puis relancer`);
  process.exit(1);
}
if (lien.verdict === "ambigu") fail(`${lien.enregistres.length} chemins enregistrés désignent ${cible} à la casse près (${lien.enregistres.join(" ; ")}) : un seul doit rester dans le fichier de liaisons, le choix est celui du poste`);
if (lien.verdict === "lie-sous-une-autre-casse") dit(`lien enregistré sous ${lien.chemin}, pas sous ${cible} : lancer railway depuis le chemin enregistré (TF-2784)`);
process.stdout.write(lien.chemin + "\n");
