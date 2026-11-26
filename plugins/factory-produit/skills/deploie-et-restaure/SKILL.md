---
name: deploie-et-restaure
description: Outille l'étape de mise en production d'un run de la Factory avec forge-ops — plan de déploiement en quatre phases sans credential, déploiement en staging, canary, bascule, état déclaré et constaté, rollback prouvé, réinitialisation d'une base de qualification, journal de MEP jugé par l'oracle O1 à O6. La forge outille, le pilot décide, l'humain donne le GO de production. Lancé uniquement sur commande explicite, dans un run. Use when / déclencher quand l'utilisateur tape la commande de ce skill à l'étape MEP d'un run pour préparer, jouer ou défaire un déploiement. Ne pas déclencher hors d'un run de la Factory, ni pour décider d'une mise en production.
disable-model-invocation: true
version: 1.0.0
---

# Déployer et restaurer (forge-ops)

Enveloppe de **forge-ops**. Elle prépare et joue les gestes de déploiement ; **le GO de
production reste humain**, et les portes M de `ETAPE-MEP.md` du pilot restent la seule vérité
de l'étape.

## 1. Prérequis (jamais simuler)

```bash
R="${FORGE_ROOT:-$HOME/factory}"; F="$R/factory-forge-ops"; P="$R/factory-pilot"
test -f "$F/README.md" && test -f "$P/ETAPE-MEP.md" && echo "prêt" || echo "forge ou pilot absent"
```

- Absents : le dire, proposer la phrase d'usage de la Factory
  (`Utilise https://github.com/Ptitcuicui/factory pour ce projet`).
- **Hors d'un run ouvert** (pas de `forge/` ni de ledger chez le projet) : ne rien déployer ;
  proposer d'ouvrir un run (`run-complet` ou `run-version`).

## 2. Gestes

```bash
node "$F/scripts/ops.mjs" plan <cible> <build> --sortie plan.json
node "$F/oracles/oracle-ops.mjs" --plan plan.json          # 4 phases, rollback réel, zéro credential
node "$F/scripts/ops.mjs" deployer <dossier-build> <cible>  # staging
node "$F/scripts/ops.mjs" canary <dossier-build> <cible>
node "$F/scripts/ops.mjs" etat <cible>
node "$F/scripts/ops.mjs" restaurer <cible>                 # rollback
node "$F/oracles/oracle-ops.mjs" <cible>                    # O1..O4 : release, healthcheck, journal, rollback prouvable
```

## 3. Règles

- **Production : jamais sans GO humain explicite**, consigné au ledger du run.
- **Vers un environnement géré (cloud), le plan s'exécute dans la chaîne CI/CD du produit,
  jamais depuis un poste** : ses phases deviennent les étapes du pipeline, le jeton est un secret
  de la chaîne. `deployer` et `canary` ne servent qu'à une cible locale (staging sur le poste).
- Aucun credential dans un plan, un journal ou un livrable.
- Rendre les verdicts de l'oracle tels qu'ils sortent ; un rollback non prouvé bloque le GO.
- La réinitialisation d'une base ne s'exécute qu'avec `--executer`, sur une base de
  qualification locale déclarée.

Détail des règles O1 à O6 et des cibles : `$F/README.md` ; étape complète :
`$P/ETAPE-MEP.md`.
