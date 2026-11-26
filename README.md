# Factory — marketplace des mallettes

Marketplace de plugins Claude des consultants Factory. Un plugin = une mallette.

| Plugin | Contenu |
|---|---|
| `factory-socle` | Contrôles qualité (oracles), pages HTML chartées, communication, prompts, contre-expertise, pilotage de mission, boussole, accueil de la factory, agents de la flotte. Requis par toutes les mallettes. |
| `factory-avant-vente` | Propales et revue, appels d'offres, PowerPoint, Word et PDF chartés, schémas, revue de CV, plan d'amélioration, qualification des entrants. |

## Installer (Claude Code)

```
/plugin marketplace add Ptitcuicui/marketplace
/plugin install factory-avant-vente@factory
```

Le socle s'installe tout seul : la mallette en dépend.

## Maintenir

**Ne modifiez jamais `plugins/` à la main.** Ce dossier est assemblé depuis les forges :

1. Corriger le skill dans sa forge (dépôt `factory-forge-*`), sous ses règles.
2. Depuis la racine des dépôts : `node factory-marketplace/outils/construire.mjs`.
3. `claude plugin validate .`, puis commit et push.

La liste des skills par plugin vit dans `outils/mallettes.json`. `PROVENANCE.json` de chaque
plugin dit de quel dépôt et de quel commit vient chaque skill. `outils/rapport-construction.json`
liste ce qui ne se résout pas encore dans un plugin (chemins en dur, dépendances au pilot).

Règles : zéro donnée client, zéro secret, aucun champ `version`, aucun dossier `bin/`.
