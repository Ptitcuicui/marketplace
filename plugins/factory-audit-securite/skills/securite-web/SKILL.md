---
name: securite-web
description: Juge la sécurité d'un produit web livré avec forge-websec — exposition HTTP (en-têtes, cookies, surface), en-têtes déclarés d'un site statique, dépendances vulnérables (SCA), workflows CI, et DAST sur une recette autorisée. Gate pré-MEP optionnel ou mission post-MEP à livrable différentiel. Lancé uniquement sur mandat explicite. Use when / déclencher quand l'utilisateur tape la commande de ce skill pour vérifier la sécurité d'un site, d'un dépôt ou d'une recette avant ou après mise en production. Ne pas déclencher pour la sécurité des agents IA (→ securite-agentique), un audit de gouvernance (→ audit-applicatif) ni un audit de tests (→ audit-qualite-tests).
disable-model-invocation: true
version: 1.0.0
---

# Sécurité web (forge-websec)

Enveloppe de **forge-websec**. Elle joue les oracles de la forge et rend leurs verdicts ; la
doctrine complète (gate R-33 bis, portes M de la MEP) est dans le README de la forge.

## 1. Trouver la forge (jamais simuler)

Dans cet ordre : la forge du poste (`$FORGE_ROOT`, sinon `~/factory`), puis la copie livrée
avec la mallette `factory-audit-securite`.

```bash
R="${FORGE_ROOT:-$HOME/factory}"; F="$R/factory-forge-websec"
[ -f "$F/README.md" ] || F="${CLAUDE_PLUGIN_ROOT}/forges/factory-forge-websec"
test -f "$F/README.md" && echo "forge présente : $F" || echo "forge absente"
```

Hors Claude Code, quand `${CLAUDE_PLUGIN_ROOT}` n'est pas remplacé, la copie livrée est dans
`../../forges/factory-forge-websec` à partir du dossier de ce skill : la chercher là avant de
conclure à son absence.

Forge absente : le dire, proposer la phrase d'usage de la Factory
(`Utilise https://github.com/Ptitcuicui/factory pour ce projet`). Aucun verdict inventé.

## 2. Choisir l'angle avec l'humain

| Besoin | Commande |
| --- | --- |
| Exposition d'un site en ligne | `node "$F/scripts/capturer.mjs" https://site --sortie capture.json` puis `node "$F/oracles/oracle-exposition.mjs" capture.json` |
| En-têtes d'un site statique | `node "$F/oracles/oracle-exposition-statique.mjs" <_headers ou dossier>` |
| Dépendances vulnérables | `node "$F/oracles/oracle-sca.mjs" <dossier-cible>` |
| Workflows CI | `node "$F/oracles/oracle-workflows.mjs" <dépôt ou fichier.yml>` |
| DAST | `node "$F/oracles/oracle-dast.mjs" --cible https://recette… --autorisation <autorisation.json> --mode passif` |

## 3. Règles

- **DAST uniquement sur une cible nommée dans un fichier d'autorisation daté et en cours de
  validité** : sans lui, l'oracle rend FAIL et n'émet rien (garde-fou qui ne se désactive pas).
  Jamais la production d'un tiers. Le mode actif se déclare ; passif par défaut.
- SCA et DAST utilisent l'outillage déjà présent (npm, pip-audit ou uvx, OWASP ZAP) et ne
  l'installent jamais : sans lui, SKIP motivé.
- Le verdict de gate est **présent et non bloquant par défaut** au dossier de MEP ; il devient
  bloquant si le produit le déclare (`websec_bloquant`).
- Rendre chaque verdict tel qu'il sort ; un SKIP se nomme avec sa cause.
- Aucun livrable publié sur un service hébergé sans GO humain.

Détail et limites : `$F/README.md`.
