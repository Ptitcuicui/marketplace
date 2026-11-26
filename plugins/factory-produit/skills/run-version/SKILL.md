---
name: run-version
description: Conduit un run de version de la Factory sur un produit déjà livré — retours consignés au ledger du run précédent et brief delta en entrée, run chaîné (run_precedent), rattrapage du socle par l'oracle de conformité, niveau d'intention touché (I, S, T ou O) qui dit quelle part de l'aval se rejoue, maquette validée avant toute vue nouvelle, puis les étapes du run jusqu'à la MEP. Use when / déclencher quand l'utilisateur veut faire évoluer, corriger ou reprendre un produit existant (y compris un dépôt importé jamais passé par un run). Ne pas déclencher pour un produit neuf (→ run-complet) ni pour un livrable qui est un document ou un verdict (→ mandat).
version: 1.0.0
---

# Run de version (produit existant)

Enveloppe du **run de version** du pilot. Le cycle après production n'est jamais improvisé : son
mode opératoire est `<pilot>/references/RUN-VERSION.md`, qui fait foi.

## 1. Prérequis (jamais simuler)

```bash
R="${FORGE_ROOT:-$HOME/factory}"; P="$R/factory-pilot"
test -f "$P/references/RUN-VERSION.md" && echo "pilot présent : $P" || echo "pilot absent"
```

Pilot absent : le dire, et proposer la phrase d'usage dans le dossier du projet
(`Utilise https://github.com/Ptitcuicui/factory pour ce projet`). Sans pilot, aucun run.

## 2. La séquence

1. **Entrant** : retours du ledger du run précédent (`type: retour`), lots de `forge/retours/`
   non traités, et le **brief delta** de l'humain.
2. **Ouvrir un run chaîné** : `run_open` avec `run_precedent` et `versions_forges`. Un champ
   oublié se rectifie **par ajout** au ledger, jamais en réécrivant l'entrée.
3. **Rattraper le socle** : `oracle-conformite-projet` sur le projet, chaque FAIL corrigé. Un
   produit importé suit le mode « rattrapage d'import » de `RUN-VERSION.md`.
4. **Niveau d'intention touché** : le brief delta déclare le plus haut niveau ISTO (I, S, T ou
   O) ; il dit quelle part de l'aval se rejoue. Une intention touchée se revalide avant toute
   exigence.
5. **Dérouler les étapes concernées** (`ETAPES-RUN.md`) ; une vue nouvelle ne se code pas sans
   maquette **validée**.
6. **MEP** avec GO humain, puis clôture et retours.

## 3. Invariants

- Le ledger du run N est l'entrée du run N+1 ; il est ajouté, jamais réécrit.
- Mise en conformité d'un produit antérieur aux règles : dans un run, jamais en masse silencieuse.
- Gates humains incompressibles ; verdicts d'oracle exécutés, jamais supposés.

Détail : `$P/references/RUN-VERSION.md` et `$P/references/ETAPES-RUN.md`.
