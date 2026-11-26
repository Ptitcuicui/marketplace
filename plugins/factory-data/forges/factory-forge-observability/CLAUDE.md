# factory-forge-observability — observabilité continue

Forge **transverse**, née de TF-0112 (décision humaine du 12/08/2026). Elle comble le trou
« one-shot vs continu » : tout le reste de l'écosystème vérifie à froid, à un instant T ;
cette forge surveille **entre les runs**. Trois verbes : **observer** (exécuter les sondes
d'un plan, produire un snapshot), **dériver** (comparer deux snapshots, rendre les
dérives), et une méthode **déclarée** (pas outillée) pour la veille de citation IA.

## Doctrine (non négociable)

- **Elle observe et alerte, ne corrige jamais.** Une dérive détectée est un constat,
  jamais un geste. La correction reste humaine, ou passe par la forge concernée.
- **Invocation par le pilot.** Cette forge ne se déclenche pas elle-même en continu (v0
  n'a pas de scheduler interne) — le pilot ou une tâche planifiée externe l'invoque.
- **Zéro API payante.** Aucun appel à un service tiers facturé ; seuls les modèles Claude
  via le harnais sont licites ailleurs dans l'écosystème.
- **Honnêteté du catalogue.** Chaque service se déclare `prouvé` (self-test exécuté,
  fixtures rouge/verte) ou `déclaré` (méthode documentée, pas d'automatisation) — jamais
  l'inverse implicite.

## Contrat de sortie

Chaque script rend un objet JSON unique sur stdout et un code de sortie 0/1/2 :

- `scripts/observer.mjs` : `{verbe:"observer", plan, verdict, findings, non_juge}` —
  OK (0) / PARTIEL (1, sonde en erreur mais snapshot quand même appendu) / ECHEC (2, plan
  invalide, rien n'est écrit).
- `scripts/derive.mjs` : `{oracle:"derive", domaine, artefact, verdict, findings,
  non_juge}` — PASS (0, aucune dérive) / FAIL (1, au moins une dérive) /
  donnees_insuffisantes (2, moins de deux snapshots ou fichiers illisibles).

`findings` : liste de `{sev, regle, msg, where}`, `sev` ∈ {bloquant, majeur, mineur, info}.

## Langue

Tout livrable et toute interaction en **français**.

Détail du format de plan, du catalogue de sondes et des exemples : `README.md`.
