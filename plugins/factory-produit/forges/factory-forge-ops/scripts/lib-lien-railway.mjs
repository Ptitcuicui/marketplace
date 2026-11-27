/**
 * lib-lien-railway.mjs — retrouver le chemin sous lequel `railway link` a enregistré un dossier (TF-2784).
 *
 * LE DÉFAUT. Le CLI Railway garde ses liaisons dans `~/.railway/config.json`, sous le CHEMIN du dossier tel que
 * `railway link` l'a reçu (`projects.<chemin>.projectPath`). Il compare ensuite le dossier courant à cette chaîne sans
 * tenir compte de ce que Windows ne distingue pas : lancé depuis `c:\dev\factory.example`, `railway status` répond
 * « No linked project found » alors que le lien est enregistré sous `C:\dev\factory.example` ; depuis ce dernier
 * chemin, le statut et `railway up --ci` passent (16/11/2026, hors run, ledger seq 445). Même cause que TF-2443 : un
 * outil tiers lie un projet à un chemin sensible à la casse sous Windows.
 *
 * CE QUE FAIT CE FICHIER. Une fonction pure : elle lit les seuls CHEMINS enregistrés (clé et `projectPath` de chaque
 * entrée de `projects`) et rend celui qui désigne le dossier donné, à la casse près. Elle ne lit, ne rend et ne cite
 * jamais un autre champ du fichier : il porte le jeton de l'utilisateur.
 */

/** Forme comparable d'un chemin : sous Windows, la casse, le sens des barres et la barre finale ne distinguent rien. */
export function normaliser(chemin, casseInsensible) {
  let c = String(chemin);
  if (casseInsensible) c = c.replace(/\//g, "\\").toLowerCase();
  return c.replace(/[\\/]+$/, "");
}

/**
 * @param {object} config contenu de ~/.railway/config.json (seul `projects` est lu)
 * @param {string} dossier chemin absolu du dossier de lancement
 * @param {{casseInsensible?: boolean}} [options] vrai sous Windows
 * @returns {{verdict: "lie"|"lie-sous-une-autre-casse"|"absent"|"ambigu", chemin?: string, enregistres?: string[]}}
 */
export function trouverLien(config, dossier, { casseInsensible = false } = {}) {
  const projets = config && typeof config === "object" && config.projects && typeof config.projects === "object" ? config.projects : {};
  const enregistres = [...new Set(Object.entries(projets)
    .map(([cle, v]) => (v && typeof v === "object" && typeof v.projectPath === "string" && v.projectPath) || cle))];
  const cherche = normaliser(dossier, casseInsensible);
  const trouves = enregistres.filter(p => normaliser(p, casseInsensible) === cherche);
  if (trouves.length === 0) return { verdict: "absent" };
  if (trouves.length > 1) return { verdict: "ambigu", enregistres: trouves };
  return { verdict: trouves[0] === dossier ? "lie" : "lie-sous-une-autre-casse", chemin: trouves[0] };
}
