---
name: run-complet
description: Ouvre et conduit un run produit complet de la Factory, de l'idée à la mise en production — ouverture du run (socle, git local, oracles d'ouverture), conception (exigences scellées), design (système de marque, maquette), development sous gates, tests et boucle de fermeture, revue graphique, MEP avec GO humain, clôture et retours. Chaque étape suit le mode opératoire du pilot et se juge par ses oracles. Use when / déclencher quand l'utilisateur veut construire un nouveau produit ou logiciel avec la Factory, de bout en bout. Ne pas déclencher pour faire évoluer un produit déjà livré (→ run-version), pour un livrable qui est un document ou un verdict (→ mandat), ni pour une seule étape isolée (→ redige-les-exigences, systeme-de-marque, audit-qualite-tests…).
version: 1.0.0
---

# Run complet (produit neuf)

Enveloppe du **run produit** du pilot. Le mode opératoire fait foi : il est dans
`<pilot>/references/ETAPES-RUN.md`, chargé étape par étape, jamais d'un bloc. Ce skill ouvre le
bon document au bon moment et tient les invariants.

## 1. Prérequis (jamais simuler)

```bash
R="${FORGE_ROOT:-$HOME/factory}"; P="$R/factory-pilot"
test -f "$P/references/ETAPES-RUN.md" && echo "pilot présent : $P" || echo "pilot absent"
```

Pilot absent : le dire, et proposer la phrase d'usage dans le dossier du projet
(`Utilise https://github.com/Ptitcuicui/factory pour ce projet`), qui installe le pilot et les
forges. Sans pilot, aucun run ne s'ouvre : on ne singe pas ses oracles.

## 2. La séquence

La session s'ouvre **chez le produit**, jamais dans le pilot ; le run y vit (`forge/`, code à la
racine).

1. **Ouvrir le run** — oracles d'ouverture du pilot (un échec suspend l'ouverture), socle projet
   (`input/`, `output/`, `docs/`, `forge/`), git local, ledger, oracle de conformité PASS.
2. **Conception** — `qualifie-l-entrant`, `enumere-la-surface`, `redige-les-exigences`,
   `derive-les-vues` : `EXIGENCES.json` scellé, oracles verts.
3. **Design** — `systeme-de-marque` (tokens et `DESIGN.md`), maquette si interface.
4. **Development** — produit construit sous gates (playbook de forge-development).
5. **Tests** — `audit-qualite-tests`, boucle de fermeture bornée à 5 cycles ; en parallèle,
   revue graphique (`critique-le-design`).
6. **MEP** — `deploie-et-restaure`, oracle MEP, dossier de MEP, **GO humain**.
7. **Clore** — lot de retours remis au pilot, `run_close`, synthèse.

À l'ouverture de chaque étape, lire sa section dans `$P/references/ETAPES-RUN.md`.

## 3. Invariants

- **L'IA fait, l'humain décide** : les gates humains (GO de MEP, dépenses, publication) ne se
  sautent jamais.
- Un livrable n'est accepté que sur le verdict d'un oracle **exécuté** ; une question bloquante
  suspend, jamais de réponse inventée.
- Contrat « prêt client » : oracles verts, forge-tests sans finding bloquant, dossier de MEP
  complet, traçabilité exigences → tests à 100 %, ledger vérifié.
- Aucun livrable publié sur un service hébergé sans GO humain.

Contexte du parc : `$P/CLAUDE.md` et `$P/references/INDEX.md`.
