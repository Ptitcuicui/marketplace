/**
 * lib-porte-version.mjs — juge le relevé `forge-ops/porte-version@1` : une version qui touche une fonction centrale
 * (l'IA, le courrier) est-elle passée par la porte complète, et son smoke a-t-il parlé au vrai fournisseur ? (TF-2771,
 * Produit-12, lot 20261122c RS-42, ledger seq 386, 391, 400, 423). Classe : mise-en-production-sur-porte-allegee.
 *
 * LE FAIT. Les versions 0.8.1 et 0.9.0 d'un produit sont passées en production sur un staging « oracle léger », sans
 * audit ni qualification, alors qu'elles touchaient l'IA et le courrier. Le smoke enregistrait une boîte simulée et une
 * clé d'IA factice : il passait sans qu'aucun fournisseur ait répondu. Le brouillon d'essai de l'activation a été relu
 * pour sa présence, jamais pour son contenu.
 *
 * CE QUE JUGE CE MODULE (aucun appel réseau, aucun fournisseur appelé : un appel réel est une dépense, donc un geste
 * humain, R-29). Le relevé est écrit par le run depuis ses lectures ; le module n'en croit que ce qu'il porte :
 *  - une version qui touche une fonction centrale passe la porte COMPLÈTE, avec l'audit et la qualification nommés ;
 *  - pour chaque fonction centrale touchée, le smoke porte un appel RÉEL au fournisseur (mode « reel », clé « reelle »,
 *    identifiant de l'appel, heure de lecture, statut 2xx) : une boîte simulée ou une clé factice ne prouve rien ;
 *  - si le courrier est touché, le contrôle d'activation compare le CONTENU du brouillon d'essai à son modèle, et la
 *    liste des écarts est vide : une relecture « de présence » ne juge pas ce que le brouillon dit.
 * La liste des fonctions centrales se RENFORCE par la déclaration (`fonctions_centrales`), jamais ne se réduit.
 */

export const FORMAT = "forge-ops/porte-version@1";

// Fonctions centrales par défaut, avec les mots sous lesquels un run les nomme. Comparaison sans accent ni casse.
export const FONCTIONS_CENTRALES = {
  ia: ["ia", "ai", "llm", "intelligence artificielle"],
  courrier: ["courrier", "email", "e-mail", "mail", "messagerie", "smtp"],
};

const sansAccent = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const estTexte = (v) => typeof v === "string" && v.trim().length > 0;
const IDENTIFIANT_VIDE = /^(ok|oui|essai|test|factice|fictif|simule|simulee|n\/a|na|aucun|aucune|-+|x+)$/i;

/** La fonction centrale (clé de FONCTIONS_CENTRALES ou nom déclaré) qu'un mot désigne, ou null. */
export function fonctionCentrale(mot, declarees = []) {
  const m = sansAccent(mot);
  for (const [nom, mots] of Object.entries(FONCTIONS_CENTRALES)) if (mots.includes(m)) return nom;
  const d = declarees.map(sansAccent).find(x => x === m);
  return d ?? null;
}

// Rend { centrales, constats: [{ sev, msg }] }.
export function jugerPorteVersion(releve) {
  const constats = [];
  const bloquant = (msg) => constats.push({ sev: "bloquant", msg });
  const info = (msg) => constats.push({ sev: "info", msg });
  if (!releve || typeof releve !== "object" || releve.format !== FORMAT) {
    bloquant(`format inconnu « ${releve?.format} » (attendu ${FORMAT}) : le relevé s'écrit depuis les lectures du run de mise en production`);
    return { centrales: [], constats };
  }
  const version = estTexte(releve.version) ? releve.version.trim() : null;
  if (!version) bloquant("version absente : la porte se juge pour UNE version nommée");
  const quoi = version ? `version ${version}` : "version non nommée";

  if (!Array.isArray(releve.fonctions_touchees)) {
    bloquant(`${quoi} : fonctions_touchees absentes — la porte dépend de ce que la version touche, et un oubli n'est pas « rien » (une version qui ne touche aucune fonction centrale le déclare par une liste vide)`);
    return { centrales: [], constats };
  }
  const declarees = Array.isArray(releve.fonctions_centrales) ? releve.fonctions_centrales.filter(estTexte) : [];
  const centrales = [...new Set(releve.fonctions_touchees.map(f => fonctionCentrale(f, declarees)).filter(Boolean))];
  if (!centrales.length) {
    info(`${quoi} : aucune fonction centrale touchée (${releve.fonctions_touchees.length ? releve.fonctions_touchees.join(", ") : "liste vide"}) — la porte allégée reste permise ; les fonctions centrales sont : ${[...Object.keys(FONCTIONS_CENTRALES), ...declarees].join(", ")}`);
    return { centrales, constats };
  }
  const nomme = centrales.join(" et ");

  // 1. La porte complète : audit et qualification nommés.
  const porte = releve.porte && typeof releve.porte === "object" ? releve.porte : {};
  if (porte.niveau !== "complete")
    bloquant(`${quoi} touche ${nomme} et passe sur une porte « ${porte.niveau ?? "non déclarée"} » : aucune version d'IA ou de courrier ne part en production sur un oracle léger, elle passe la porte complète (audit et qualification) — TF-2771`);
  else {
    if (!estTexte(porte.audit)) bloquant(`${quoi} touche ${nomme} : la porte complète ne nomme pas son audit (champ porte.audit : le rapport ou l'identifiant de l'audit de la chaîne)`);
    if (!estTexte(porte.qualification)) bloquant(`${quoi} touche ${nomme} : la porte complète ne nomme pas sa qualification (champ porte.qualification : le rapport ou l'identifiant de la qualification)`);
  }

  // 2. Un appel réel au fournisseur, par fonction centrale touchée.
  const fournisseurs = Array.isArray(releve.smoke?.fournisseurs) ? releve.smoke.fournisseurs : [];
  for (const f of centrales) {
    const siens = fournisseurs.filter(x => fonctionCentrale(x?.fonction ?? "", declarees) === f);
    const reels = siens.filter(x => x.mode === "reel" && x.cle === "reelle");
    if (!siens.length) {
      bloquant(`${quoi} touche ${f} : le smoke ne dit rien du fournisseur de ${f} (smoke.fournisseurs sans entrée pour cette fonction) — il doit porter un appel réel`);
      continue;
    }
    if (!reels.length) {
      const dits = siens.map(x => `${x.fournisseur ?? "fournisseur non nommé"} en mode ${x.mode ?? "non déclaré"}, clé ${x.cle ?? "non déclarée"}`).join(" ; ");
      bloquant(`${quoi} touche ${f} : le smoke n'appelle pas le vrai fournisseur (${dits}) — une boîte simulée ou une clé factice passe sans qu'aucun fournisseur ait répondu ; il faut un appel réel (mode « reel », clé « reelle »)`);
      continue;
    }
    for (const r of reels) {
      const appel = r.appel && typeof r.appel === "object" ? r.appel : {};
      const nom = `${f} (${r.fournisseur ?? "fournisseur non nommé"})`;
      if (!estTexte(appel.identifiant) || IDENTIFIANT_VIDE.test(appel.identifiant.trim()))
        bloquant(`${quoi} : l'appel réel de ${nom} ne porte pas d'identifiant d'appel (appel.identifiant : l'identifiant ou l'URL que le fournisseur a rendu) — « ${appel.identifiant ?? ""} » n'est pas un identifiant`);
      if (Number.isNaN(Date.parse(appel.lu_le))) bloquant(`${quoi} : l'appel réel de ${nom} ne porte pas l'heure de sa lecture (appel.lu_le, ISO 8601 avec fuseau)`);
      if (!(typeof appel.statut === "number" && appel.statut >= 200 && appel.statut < 300))
        bloquant(`${quoi} : l'appel réel de ${nom} n'a pas rendu un statut 2xx (obtenu ${appel.statut ?? "aucun"}) : un appel qui échoue ne prouve pas le fournisseur`);
    }
    if (siens.length > reels.length) info(`${quoi} : ${f} garde aussi ${siens.length - reels.length} entrée(s) simulée(s) au smoke, admises à côté de l'appel réel`);
  }

  // 3. Le brouillon d'essai de l'activation (courrier) : son contenu contre son modèle, jamais sa présence.
  if (centrales.includes("courrier")) {
    const b = releve.activation?.brouillon_essai;
    if (!b || typeof b !== "object") bloquant(`${quoi} touche courrier : le contrôle d'activation ne porte aucun brouillon d'essai (activation.brouillon_essai) — le courrier n'est pas prouvé`);
    else {
      if (b.comparaison !== "contenu")
        bloquant(`${quoi} : le brouillon d'essai de l'activation est relu pour sa ${b.comparaison === "presence" ? "présence" : `« ${b.comparaison ?? "non déclarée"} »`}, pas pour son contenu — il se compare à son modèle (comparaison « contenu »)`);
      if (!estTexte(b.modele) || !estTexte(b.brouillon)) bloquant(`${quoi} : la comparaison ne nomme pas le modèle et le brouillon comparés (activation.brouillon_essai.modele et .brouillon)`);
      if (!Array.isArray(b.ecarts)) bloquant(`${quoi} : la liste des écarts du brouillon à son modèle est absente (activation.brouillon_essai.ecarts, vide si aucun) — une comparaison dont on ne lit pas le résultat ne prouve rien`);
      else for (const e of b.ecarts) bloquant(`${quoi} : le brouillon d'essai s'écarte de son modèle — ${typeof e === "string" ? e : JSON.stringify(e)}`);
    }
  }
  return { centrales, constats };
}
