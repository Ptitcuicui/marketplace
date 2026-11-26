#!/usr/bin/env node
// Fixture — sonde de type « commande ». Simule une métrique réelle (CPU, latence, taille
// de file...) : lit un fichier d'état JSON {"valeur": N} et le réémet tel quel sur stdout.
// Faire varier ce fichier d'état entre deux exécutions simule l'évolution réelle d'une
// métrique dans le temps — c'est ce que le self-test mute pour prouver la détection de
// franchissement de seuil par derive.mjs.
// Usage : node commande-metrique.mjs <etat.json>
import fs from "node:fs";

const etatPath = process.argv[2];
if (!etatPath || !fs.existsSync(etatPath)) {
  process.stderr.write(`fichier d'état introuvable : ${etatPath}\n`);
  process.exit(1);
}
process.stdout.write(fs.readFileSync(etatPath, "utf8"));
