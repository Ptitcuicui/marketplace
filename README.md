# Factory — marketplace des mallettes

Marketplace de plugins Claude des consultants Factory. Un plugin = une mallette.

| Plugin | Contenu |
|---|---|
| `factory-socle` | Contrôles qualité (oracles), pages HTML chartées, communication, système de marque, prompts, contre-expertise, pilotage de mission, run de mandat, boussole, accueil de la factory, agents de la flotte. Requis par toutes les mallettes. |
| `factory-avant-vente` | Propales et revue, appels d'offres, PowerPoint, Word et PDF chartés, schémas, revue de CV, plan d'amélioration, qualification des entrants. |
| `factory-produit` | Run complet et run de version, surface fonctionnelle, exigences et vues, critique et amélioration du design, direction artistique, intégration de modèles d'IA, déploiement et restauration sous GO humain. |
| `factory-audit-securite` | Audit applicatif et fiche sécurité, sécurité du site livré, sécurité des agents IA, audit qualité des tests. Chaque audit part sur commande explicite. |
| `factory-data` | Profilage d'un jeu de données, discipline de la donnée (assertions, lineage, restitution sourcée, data contract, modèle Gold, migration de rapport, anonymisation), veille de dérive. |
| `factory-marketing` | Étude SEO et GEO d'un site (sur commande explicite), animation de réseaux sociaux avec accord humain par lot, clip de présentation. |

Les skills qui enveloppent une forge (audit, sécurité, data, ops, SEO, runs) la cherchent sous
`$FORGE_ROOT`, sinon `~/factory`. Forge absente : ils le disent et proposent la phrase d'usage de
la Factory, sans jamais simuler un verdict.

## Installer (Claude Code)

```
/plugin marketplace add Ptitcuicui/marketplace
/plugin install factory-avant-vente@factory
/plugin install factory-produit@factory
/plugin install factory-audit-securite@factory
/plugin install factory-data@factory
/plugin install factory-marketing@factory
```

Installer seulement les mallettes utiles. Le socle s'installe tout seul : chaque mallette en
dépend.

## Maintenir

**Ne modifiez jamais `plugins/` à la main.** Ce dossier est assemblé depuis les forges :

1. Corriger le skill dans sa forge (dépôt `factory-forge-*`), sous ses règles.
2. Depuis la racine des dépôts : `node factory-marketplace/outils/construire.mjs`.
3. `claude plugin validate .`, puis commit et push.

La liste des skills par plugin vit dans `outils/mallettes.json`. `PROVENANCE.json` de chaque
plugin dit de quel dépôt et de quel commit vient chaque skill. `outils/rapport-construction.json`
liste ce qui ne se résout pas encore dans un plugin (chemins en dur, dépendances au pilot).

Règles : zéro donnée client, zéro secret, aucun champ `version`, aucun dossier `bin/`.
